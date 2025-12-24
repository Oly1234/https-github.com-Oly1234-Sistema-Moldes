
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Search, Wand2, UploadCloud, Layers, Move, Eraser, Check, Loader2, Image as ImageIcon, Shirt, RefreshCw, X, Download, MousePointer2, ChevronRight, RotateCw, Sun, Droplets, Zap, Sliders, Sparkles, Brush, PenTool, Focus, ShieldCheck, Hand, ZoomIn, ZoomOut, RotateCcw, BrainCircuit, Maximize, Undo2, Grid, ScanLine, ArrowLeft, MoreHorizontal, CheckCircle2, Play, Plus, Minus, PlusCircle, Target, Move3d, Trash2, RefreshCcw, ImagePlus, User, SlidersHorizontal, Brain, MoveDiagonal } from 'lucide-react';
import { ModuleHeader, ModuleLandingPage } from '../components/Shared';
import { RunwayEngine, RunwayMaskSnapshot } from '../services/runwayEngine';

const RunwayModelCard: React.FC<{ match: any, onSelect: (img: string) => void }> = ({ match, onSelect }) => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        let active = true;
        const fetchImage = async () => {
            try {
                const res = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'GET_LINK_PREVIEW', 
                        targetUrl: match.url,
                        backupSearchTerm: match.backupSearchTerm,
                        linkType: match.linkType
                    })
                });
                const data = await res.json();
                if (active && data.success && data.image) {
                    setImgSrc(data.image);
                }
            } catch (e) { console.error(e); } finally { if (active) setLoading(false); }
        };
        fetchImage();
        return () => { active = false; };
    }, [match]);

    return (
        <div 
            onClick={() => imgSrc && onSelect(imgSrc)}
            className="aspect-[3/4] bg-white rounded-xl overflow-hidden cursor-pointer hover:ring-4 ring-vingi-500 transition-all shadow-md group relative border border-gray-200"
        >
            {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                    <Loader2 size={20} className="animate-spin text-gray-300"/>
                </div>
            ) : imgSrc ? (
                <>
                    <img src={imgSrc} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Check size={32} className="text-white mb-2"/>
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-black/50 px-2 py-1 rounded">Selecionar Base</span>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[8px] font-bold px-2 py-1 rounded backdrop-blur-md max-w-[90%] truncate">
                        {match.source}
                    </div>
                </>
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-400">
                    <ImagePlus size={24} className="mb-1 opacity-50"/>
                    <span className="text-[9px]">Sem Preview</span>
                </div>
            )}
        </div>
    );
};

const compressImage = (base64Str: string, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
    });
};

export const VirtualRunway: React.FC<{ onNavigateToCreator: () => void }> = ({ onNavigateToCreator }) => {
    const [step, setStep] = useState<'SEARCH_BASE' | 'STUDIO'>('SEARCH_BASE');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [searchReferenceImage, setSearchReferenceImage] = useState<string | null>(null);
    const [whiteModelMatches, setWhiteModelMatches] = useState<any[]>([]);
    const [visibleCount, setVisibleCount] = useState(20); // Aumentado para mostrar mais opções de cara
    
    // Core Refs
    const canvasRef = useRef<HTMLCanvasElement>(null); 
    const containerRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null); 
    const [baseImgObj, setBaseImgObj] = useState<HTMLImageElement | null>(null);
    const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);
    
    // Mask State (Runway Engine)
    const [maskData, setMaskData] = useState<Uint8Array | null>(null);
    const [undoStack, setUndoStack] = useState<RunwayMaskSnapshot[]>([]);
    
    // Tools
    const [activeTool, setActiveTool] = useState<'WAND' | 'BRUSH' | 'ERASER' | 'HAND' | 'PATTERN_MOVE'>('WAND');
    const [wandTolerance, setWandTolerance] = useState(30);
    const [brushSize, setBrushSize] = useState(40);
    const [toolMode, setToolMode] = useState<'ADD' | 'SUB'>('ADD'); 
    const [smartBrush, setSmartBrush] = useState(true); 
    
    // Pattern Transform & Lighting
    const [view, setView] = useState({ x: 0, y: 0, k: 1 });
    const [patternScale, setPatternScale] = useState(0.5);
    const [patternRotation, setPatternRotation] = useState(0);
    const [patternOffset, setPatternOffset] = useState({ x: 0, y: 0 });
    
    // Lighting Lab
    const [edgeFeather, setEdgeFeather] = useState(1.5);
    const [shadowIntensity, setShadowIntensity] = useState(0.8);
    const [structureIntensity, setStructureIntensity] = useState(0.5); 
    const [brightness, setBrightness] = useState(1.0);

    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [showPatternModal, setShowPatternModal] = useState(false);
    const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
    
    const isDrawingRef = useRef(false);
    const startColorRef = useRef<{r:number, g:number, b:number} | null>(null);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);
    const refFileInput = useRef<HTMLInputElement>(null);

    // --- RENDERER ---
    const renderCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !baseImgObj) return;
        
        if (canvas.width !== baseImgObj.naturalWidth || canvas.height !== baseImgObj.naturalHeight) {
            canvas.width = baseImgObj.naturalWidth;
            canvas.height = baseImgObj.naturalHeight;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const w = canvas.width, h = canvas.height;
        
        // 1. Base Layer
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(baseImgObj, 0, 0, w, h);
        
        // 2. Mask Preview
        if (maskData && !patternImgObj) {
            const tempC = document.createElement('canvas'); tempC.width = w; tempC.height = h;
            const tCtx = tempC.getContext('2d')!;
            const mData = tCtx.createImageData(w, h);
            for(let i=0; i<maskData.length; i++) {
                if (maskData[i] > 0) {
                    mData.data[i*4] = 59; 
                    mData.data[i*4+1] = 130; 
                    mData.data[i*4+2] = 246; 
                    mData.data[i*4+3] = 120; // Mais visível
                }
            }
            tCtx.putImageData(mData, 0, 0);
            ctx.drawImage(tempC, 0, 0);
        }

        // 3. Pattern Application
        if (patternImgObj && maskData) {
            const tempC = document.createElement('canvas'); tempC.width = w; tempC.height = h;
            const tCtx = tempC.getContext('2d')!;
            
            const maskImgData = tCtx.createImageData(w, h);
            for(let i=0; i<maskData.length; i++) maskImgData.data[i*4 + 3] = maskData[i]; 
            tCtx.putImageData(maskImgData, 0, 0);
            
            if (edgeFeather > 0) tCtx.filter = `blur(${edgeFeather}px)`;
            
            tCtx.globalCompositeOperation = 'source-in';
            tCtx.save();
            tCtx.translate(w/2 + patternOffset.x, h/2 + patternOffset.y);
            tCtx.rotate((patternRotation * Math.PI) / 180);
            tCtx.scale(patternScale, patternScale);
            const pat = tCtx.createPattern(patternImgObj, 'repeat');
            if (pat) { tCtx.fillStyle = pat; tCtx.fillRect(-w*8, -h*8, w*16, h*16); }
            tCtx.restore();

            if (brightness !== 1.0) {
                tCtx.filter = `brightness(${brightness})`;
                tCtx.globalCompositeOperation = 'source-atop'; 
                tCtx.fillRect(0,0,w,h);
                tCtx.filter = 'none';
            }

            ctx.save(); ctx.drawImage(tempC, 0, 0); ctx.restore();
            
            // Shadows & Structure
            const shadowC = document.createElement('canvas'); shadowC.width = w; shadowC.height = h;
            const sCtx = shadowC.getContext('2d')!;
            sCtx.putImageData(maskImgData, 0, 0); 
            sCtx.globalCompositeOperation = 'source-in';
            sCtx.filter = `grayscale(100%) contrast(120%)`; 
            sCtx.drawImage(baseImgObj, 0, 0);
            
            ctx.save(); 
            ctx.globalCompositeOperation = 'multiply'; 
            ctx.globalAlpha = shadowIntensity; 
            ctx.drawImage(shadowC, 0, 0); 
            ctx.restore();

            if (structureIntensity > 0) {
                const structC = document.createElement('canvas'); structC.width = w; structC.height = h;
                const stCtx = structC.getContext('2d')!;
                stCtx.putImageData(maskImgData, 0, 0);
                stCtx.globalCompositeOperation = 'source-in';
                stCtx.filter = `grayscale(100%) high-pass(2px)`; 
                stCtx.drawImage(baseImgObj, 0, 0);

                ctx.save();
                ctx.globalCompositeOperation = 'hard-light'; 
                ctx.globalAlpha = structureIntensity * 0.6;
                ctx.drawImage(structC, 0, 0);
                ctx.restore();
            }
        }
    }, [baseImgObj, patternImgObj, patternScale, patternRotation, patternOffset, edgeFeather, shadowIntensity, structureIntensity, brightness, maskData]);

    useEffect(() => { if(step === 'STUDIO') requestAnimationFrame(renderCanvas); }, [renderCanvas, step, maskData]);

    useEffect(() => {
        if (referenceImage) {
            const img = new Image(); img.src = referenceImage; img.crossOrigin = "anonymous";
            img.onload = () => {
                setBaseImgObj(img);
                setMaskData(new Uint8Array(img.naturalWidth * img.naturalHeight)); 
                setUndoStack([]);
                if (canvasRef.current) { canvasRef.current.width = img.naturalWidth; canvasRef.current.height = img.naturalHeight; }
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight) * 0.9;
                    setView({ x: 0, y: 0, k: scale || 0.5 });
                }
            };
        }
    }, [referenceImage]);

    // Handle Upload for White Model Search
    const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setSearchReferenceImage(ev.target?.result as string);
                performSearch(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const performSearch = async (imgBase64?: string) => {
        if (!searchQuery.trim() && !imgBase64) return;
        setIsSearching(true);
        setWhiteModelMatches([]);
        setVisibleCount(20);
        try {
            let bodyPayload: any = { action: 'FIND_WHITE_MODELS', prompt: searchQuery };
            if (imgBase64) {
                const compressed = await compressImage(imgBase64);
                bodyPayload.mainImageBase64 = compressed.split(',')[1];
                bodyPayload.mainMimeType = 'image/jpeg';
            }
            const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyPayload) });
            const data = await res.json();
            if (data.success && data.queries) {
                setWhiteModelMatches(data.queries);
                if (data.detectedStructure && !searchQuery) setSearchQuery(data.detectedStructure);
            }
        } catch(e) { console.error(e); } 
        finally { setIsSearching(false); }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if(!rect || !baseImgObj) return;
        
        // Use pointerCapture to track movement even if it goes outside div
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        
        const cx = rect.width / 2; const cy = rect.height / 2;
        const px = (e.clientX - rect.left - cx - view.x) / view.k + baseImgObj.naturalWidth / 2;
        const py = (e.clientY - rect.top - cy - view.y) / view.k + baseImgObj.naturalHeight / 2;
        
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
        isDrawingRef.current = true;

        if (activeTool === 'HAND' || e.button === 1) return;
        if (activeTool === 'PATTERN_MOVE') return;

        // IMPORTANTE: Salva histórico apenas no INÍCIO do traço, não durante
        if (maskData) setUndoStack(prev => RunwayEngine.pushHistory(prev, maskData));

        const ctx = canvasRef.current!.getContext('2d')!;
        
        if (smartBrush) {
            const p = ctx.getImageData(Math.floor(px), Math.floor(py), 1, 1).data;
            startColorRef.current = { r: p[0], g: p[1], b: p[2] };
        } else {
            startColorRef.current = null;
        }
        
        // Aplicação inicial (Clique)
        if (activeTool === 'WAND') {
            const newMask = RunwayEngine.magicWand(
                ctx, baseImgObj.naturalWidth, baseImgObj.naturalHeight, 
                px, py, 
                { tolerance: wandTolerance, contiguous: true, mode: toolMode, existingMask: maskData || undefined }
            );
            setMaskData(newMask);
        } else if (activeTool === 'BRUSH' || activeTool === 'ERASER') {
            const mode = activeTool === 'ERASER' ? 'SUB' : toolMode;
            const newMask = RunwayEngine.paintMask(
                maskData || new Uint8Array(baseImgObj.naturalWidth * baseImgObj.naturalHeight),
                smartBrush ? ctx : null, 
                baseImgObj.naturalWidth, baseImgObj.naturalHeight,
                px, py,
                { size: brushSize, hardness: 80, opacity: 100, mode, smart: smartBrush, startColor: startColorRef.current }
            );
            setMaskData(newMask);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        // ZERO LATENCY CURSOR UPDATE (Direct DOM)
        const isTouch = e.pointerType === 'touch';
        if (cursorRef.current && (activeTool === 'BRUSH' || activeTool === 'ERASER') && !isTouch) {
            cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
            cursorRef.current.style.display = 'block';
        } else if (cursorRef.current) {
            cursorRef.current.style.display = 'none';
        }

        if (!isDrawingRef.current || !lastPointerPos.current || !baseImgObj) return;
        
        // Ferramentas de Movimento
        if (activeTool === 'HAND') {
            const dx = e.clientX - lastPointerPos.current.x;
            const dy = e.clientY - lastPointerPos.current.y;
            setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (activeTool === 'PATTERN_MOVE') {
            const dx = (e.clientX - lastPointerPos.current.x) / view.k;
            const dy = (e.clientY - lastPointerPos.current.y) / view.k;
            setPatternOffset(p => ({ x: p.x + dx, y: p.y + dy }));
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        // PINTURA CONTÍNUA (ARRASTAR)
        // Correção Crítica: O cálculo deve acontecer a cada movimento se isDrawingRef for true
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const cx = rect.width / 2; const cy = rect.height / 2;
        const px = (e.clientX - rect.left - cx - view.x) / view.k + baseImgObj.naturalWidth / 2;
        const py = (e.clientY - rect.top - cy - view.y) / view.k + baseImgObj.naturalHeight / 2;

        if (activeTool === 'BRUSH' || activeTool === 'ERASER') {
             const mode = activeTool === 'ERASER' ? 'SUB' : toolMode;
             const ctx = canvasRef.current!.getContext('2d')!;
             
             // Otimização: Não usar setMaskData funcional (prev => ...) em loop rápido se possível, 
             // mas aqui precisamos da versão anterior. O React 18 faz batching, então ok.
             setMaskData(prev => {
                 if (!prev) return new Uint8Array(baseImgObj.naturalWidth * baseImgObj.naturalHeight);
                 return RunwayEngine.paintMask(
                    prev,
                    smartBrush ? ctx : null,
                    baseImgObj.naturalWidth, baseImgObj.naturalHeight,
                    px, py,
                    { size: brushSize, hardness: 80, opacity: 100, mode, smart: smartBrush, startColor: startColorRef.current }
                );
             });
        }
        
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDrawingRef.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    const handleUndo = () => {
        if (undoStack.length > 0) {
            const last = undoStack[undoStack.length - 1];
            setMaskData(last.data);
            setUndoStack(prev => prev.slice(0, -1));
        }
    };

    const getCursorStyle = () => {
        if (activeTool === 'HAND') return 'cursor-grab active:cursor-grabbing';
        if (activeTool === 'WAND') return 'cursor-crosshair';
        if (activeTool === 'BRUSH' || activeTool === 'ERASER') return 'cursor-none'; 
        if (activeTool === 'PATTERN_MOVE') return 'cursor-move';
        return 'cursor-default';
    };

    return (
        <div className="flex flex-col h-full bg-[#080808] text-white overflow-hidden font-sans">
            {step === 'SEARCH_BASE' ? (
                <div className="flex-1 bg-[#f0f2f5] overflow-y-auto text-gray-800">
                    <ModuleHeader icon={Camera} title="Provador Mágico" subtitle="Busca Global" />
                    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-24">
                        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col md:flex-row gap-8">
                            <div className="flex-1 space-y-4">
                                <h3 className="text-xl font-black uppercase tracking-wider text-gray-900">Encontre o Modelo Ideal</h3>
                                <p className="text-sm text-gray-500">Faça o upload de uma referência para encontrarmos modelos usando roupas brancas com a mesma silhueta, ou descreva o que procura.</p>
                                <div className="flex gap-2">
                                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && performSearch()} placeholder="Ex: Vestido longo seda, Camisa social..." className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-vingi-500 font-bold" />
                                    <button onClick={() => performSearch()} className="bg-vingi-900 text-white px-6 rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 min-w-[60px]"><Search size={20}/></button>
                                </div>
                            </div>
                            <div className="w-px bg-gray-100 hidden md:block"></div>
                            <div className="flex-1">
                                <input type="file" ref={refFileInput} onChange={handleRefUpload} accept="image/*" className="hidden" />
                                <div onClick={() => refFileInput.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl h-full min-h-[120px] flex flex-col items-center justify-center cursor-pointer hover:border-vingi-500 hover:bg-vingi-50 transition-all group relative overflow-hidden">
                                    {searchReferenceImage ? (
                                        <>
                                            <img src={searchReferenceImage} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                                            <div className="relative z-10 bg-white/90 px-4 py-2 rounded-full shadow-lg flex items-center gap-2"><RefreshCw size={14} className="text-vingi-600"/> <span className="text-xs font-bold text-gray-800">Trocar Referência</span></div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-gray-100 p-3 rounded-full mb-2 group-hover:scale-110 transition-transform"><ImagePlus size={24} className="text-gray-400 group-hover:text-vingi-500"/></div>
                                            <p className="text-xs font-bold text-gray-500 uppercase">Carregar Referência (IA)</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {isSearching && (
                            <div className="text-center py-12"><Loader2 size={48} className="animate-spin text-vingi-500 mx-auto mb-4"/><p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Varrendo Marketplaces (Pinterest, Vogue, Google...)</p></div>
                        )}
                        {!isSearching && whiteModelMatches.length > 0 && (
                            <div className="animate-fade-in space-y-6">
                                <div className="flex items-center justify-between"><h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><User size={20}/> Modelos Disponíveis ({whiteModelMatches.length})</h3></div>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {whiteModelMatches.slice(0, visibleCount).map((match, i) => ( <RunwayModelCard key={i} match={match} onSelect={(img) => { setReferenceImage(img); setShowPatternModal(true); }} /> ))}
                                </div>
                                {visibleCount < whiteModelMatches.length && (
                                    <div className="text-center pt-8"><button onClick={() => setVisibleCount(p => p + 20)} className="px-8 py-3 bg-white border border-gray-300 rounded-xl font-bold shadow-sm hover:bg-gray-50 hover:border-gray-400 text-gray-600 transition-all flex items-center gap-2 mx-auto"><Plus size={16}/> Carregar Mais Modelos (+20)</button></div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col relative overflow-hidden bg-[#050505]">
                    {/* TOP BAR */}
                    <div className="bg-[#111] h-14 border-b border-white/5 px-4 flex items-center justify-between shrink-0 z-50">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/10 p-1.5 rounded-lg"><Camera size={18} className="text-vingi-400"/></div>
                            <div><h2 className="text-xs font-bold uppercase tracking-widest leading-none">Virtual Runway</h2><p className="text-[9px] text-gray-500 uppercase font-medium">Estúdio Pro</p></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleUndo} disabled={undoStack.length === 0} className="p-2 text-gray-400 hover:text-white disabled:opacity-30"><Undo2 size={18}/></button>
                            <button onClick={() => setStep('SEARCH_BASE')} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1"><X size={12}/> Trocar Base</button>
                            <button onClick={() => { if(canvasRef.current){ const l=document.createElement('a'); l.download='vingi.jpg'; l.href=canvasRef.current.toDataURL('image/jpeg',0.9); l.click(); } }} className="text-[10px] bg-vingi-600 px-4 py-1.5 rounded-lg font-bold">Salvar</button>
                        </div>
                    </div>
                    
                    {/* CANVAS AREA */}
                    <div 
                        ref={containerRef} 
                        className={`flex-1 relative flex items-center justify-center overflow-hidden touch-none ${getCursorStyle()}`} 
                        onPointerDown={handlePointerDown} 
                        onPointerMove={handlePointerMove} 
                        onPointerUp={handlePointerUp} 
                        onMouseLeave={handlePointerUp}
                    >
                        {/* BACKGROUND GRID */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                        <div className="relative shadow-2xl origin-center" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: baseImgObj?.naturalWidth, height: baseImgObj?.naturalHeight }}>
                            <canvas ref={canvasRef} className="block bg-white" />
                        </div>
                        
                        {/* ZERO LATENCY CURSOR (Direct DOM) */}
                        <div 
                            ref={cursorRef}
                            className="pointer-events-none fixed z-[9999] rounded-full border border-white mix-blend-difference hidden will-change-transform" 
                            style={{ 
                                width: brushSize * view.k, 
                                height: brushSize * view.k,
                                left: 0,
                                top: 0,
                                position: 'fixed'
                            }}
                        />
                    </div>

                    {/* TOOL SETTINGS PANEL */}
                    <div className="bg-[#0a0a0a] border-t border-white/10 z-[150] shadow-2xl flex flex-col shrink-0">
                        <div className="h-16 px-4 flex items-center justify-between gap-4 border-b border-white/5 bg-[#080808]">
                            {activeTool === 'WAND' && (
                                <div className="flex items-center gap-4 w-full">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-bold text-gray-400 uppercase">Sensibilidade (Luma)</span><span className="text-[9px] font-mono text-blue-400">{wandTolerance}</span></div>
                                        <input type="range" min="1" max="100" value={wandTolerance} onChange={(e) => setWandTolerance(parseInt(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-blue-500 outline-none" />
                                    </div>
                                    <div className="w-px h-8 bg-white/10 mx-2"></div>
                                    <div className="flex bg-white/5 rounded-lg p-0.5">
                                        <button onClick={() => setToolMode('ADD')} className={`p-1.5 rounded-md ${toolMode==='ADD'?'bg-blue-600 text-white':'text-gray-500'}`}><Plus size={14}/></button>
                                        <button onClick={() => setToolMode('SUB')} className={`p-1.5 rounded-md ${toolMode==='SUB'?'bg-red-600 text-white':'text-gray-500'}`}><Minus size={14}/></button>
                                    </div>
                                </div>
                            )}
                            {(activeTool === 'BRUSH' || activeTool === 'ERASER') && (
                                <div className="flex items-center gap-4 w-full">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-bold text-gray-400 uppercase">Tamanho</span><span className="text-[9px] font-mono text-blue-400">{brushSize}px</span></div>
                                        <input type="range" min="5" max="200" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-blue-500 outline-none" />
                                    </div>
                                    <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                                        <button onClick={() => setToolMode('ADD')} className={`p-1.5 rounded-md ${toolMode==='ADD'?'bg-blue-600 text-white':'text-gray-500'}`}><Plus size={14}/></button>
                                        <button onClick={() => setToolMode('SUB')} className={`p-1.5 rounded-md ${toolMode==='SUB'?'bg-red-600 text-white':'text-gray-500'}`}><Minus size={14}/></button>
                                    </div>
                                    <button onClick={() => setSmartBrush(!smartBrush)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${smartBrush ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-transparent text-gray-500'}`}>
                                        <Brain size={16}/> <span className="text-[9px] font-bold uppercase hidden md:inline">Smart</span>
                                    </button>
                                </div>
                            )}
                            {activeTool === 'PATTERN_MOVE' && (
                                <div className="flex items-center gap-4 w-full">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-bold text-gray-400 uppercase">Escala Estampa</span><span className="text-[9px] font-mono text-blue-400">{Math.round(patternScale*100)}%</span></div>
                                        <input type="range" min="0.1" max="2" step="0.05" value={patternScale} onChange={(e) => setPatternScale(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-blue-500 outline-none" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-bold text-gray-400 uppercase">Rotação</span><span className="text-[9px] font-mono text-blue-400">{patternRotation}°</span></div>
                                        <input type="range" min="0" max="360" value={patternRotation} onChange={(e) => setPatternRotation(parseInt(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-blue-500 outline-none" />
                                    </div>
                                </div>
                            )}
                            {activeTool === 'OFFSET' && (
                                <div className="flex items-center gap-4 w-full">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-bold text-gray-400 uppercase">Sombra</span><span className="text-[9px] font-mono text-blue-400">{Math.round(shadowIntensity*100)}%</span></div>
                                        <input type="range" min="0" max="1" step="0.1" value={shadowIntensity} onChange={(e) => setShadowIntensity(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-blue-500 outline-none" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-bold text-gray-400 uppercase">Brilho</span><span className="text-[9px] font-mono text-blue-400">{Math.round(brightness*100)}%</span></div>
                                        <input type="range" min="0.5" max="1.5" step="0.1" value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-blue-500 outline-none" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Toolbar */}
                        <div className="h-20 flex items-center justify-around px-2 bg-black pb-[env(safe-area-inset-bottom)]">
                            <ToolBtn icon={Hand} label="Pan" active={activeTool==='HAND'} onClick={() => setActiveTool('HAND')} />
                            <div className="w-px h-8 bg-white/10 mx-1"></div>
                            <ToolBtn icon={Wand2} label="Varinha" active={activeTool==='WAND'} onClick={() => setActiveTool('WAND')} />
                            <ToolBtn icon={Brush} label="Pincel" active={activeTool==='BRUSH'} onClick={() => setActiveTool('BRUSH')} />
                            <ToolBtn icon={Eraser} label="Apagar" active={activeTool==='ERASER'} onClick={() => setActiveTool('ERASER')} />
                            <div className="w-px h-8 bg-white/10 mx-1"></div>
                            <ToolBtn icon={MoveDiagonal} label="Mover Estampa" active={activeTool==='PATTERN_MOVE'} onClick={() => setActiveTool('PATTERN_MOVE')} />
                            <ToolBtn icon={SlidersHorizontal} label="Luz/Cor" active={activeTool==='OFFSET'} onClick={() => setActiveTool('OFFSET')} />
                            <ToolBtn icon={RefreshCcw} label="Estampa" onClick={() => setShowPatternModal(true)} />
                        </div>
                    </div>
                </div>
            )}

            {showPatternModal && (
                <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-[32px] p-10 max-w-md w-full text-center relative shadow-2xl">
                        <div className="w-20 h-20 bg-vingi-900 rounded-full flex items-center justify-center mx-auto mb-6"><Layers size={40} className="text-vingi-400"/></div>
                        <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter">Aplicar Estampa</h3>
                        <p className="text-gray-500 text-sm mb-8 leading-relaxed">Selecione o arquivo da arte para iniciarmos a simulação neural no modelo.</p>
                        <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>{ setSelectedPattern(ev.target?.result as string); const pi=new Image(); pi.src=ev.target?.result as string; pi.onload=()=>setPatternImgObj(pi); setShowPatternModal(false); setStep('STUDIO'); }; r.readAsDataURL(f); } }} className="hidden" id="p-up" />
                        <label htmlFor="p-up" className="w-full py-5 bg-vingi-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 cursor-pointer hover:bg-vingi-500 transition-all text-sm uppercase tracking-widest"><UploadCloud size={24}/> CARREGAR ARQUIVO</label>
                        <button onClick={() => setShowPatternModal(false)} className="mt-6 text-[10px] text-gray-600 hover:text-white uppercase font-black tracking-[0.2em] transition-colors">Cancelar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center justify-center min-w-[64px] h-full rounded-xl gap-1 transition-all active:scale-90 ${disabled ? 'opacity-20' : 'hover:bg-white/5'} ${active ? 'text-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className={active ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''} /> 
        <span className="text-[9px] font-bold uppercase tracking-tight text-center leading-none">{label}</span>
    </button>
);
