
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Search, Wand2, UploadCloud, Layers, Move, Eraser, Check, Loader2, Image as ImageIcon, Shirt, RefreshCw, X, Download, MousePointer2, ChevronRight, RotateCw, Sun, Droplets, Zap, Sliders, Sparkles, Brush, PenTool, Focus, ShieldCheck, Hand, ZoomIn, ZoomOut, RotateCcw, BrainCircuit, Maximize, Undo2, Grid, ScanLine, ArrowLeft, MoreHorizontal, CheckCircle2, Play, Plus, MinusCircle, PlusCircle, Target, Move3d, Trash2, RefreshCcw, ImagePlus, User } from 'lucide-react';
import { ModuleHeader, ModuleLandingPage } from '../components/Shared';

// --- HELPERS VISUAIS (Reutilizados do Scanner) ---
const getBrandIcon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

// Componente de Card de Modelo (Simplificado do PatternVisualCard para o Runway)
const RunwayModelCard: React.FC<{ match: any, onSelect: (img: string) => void }> = ({ match, onSelect }) => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        let active = true;
        const fetchImage = async () => {
            try {
                // Usa o Scraper (GET_LINK_PREVIEW) para pegar a imagem visual da busca
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

// --- HELPERS MATEMÁTICOS & VISÃO ---
const createMockupMask = (ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number, tolerance: number) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width; maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d')!;
    const maskImgData = maskCtx.createImageData(width, height);
    const maskData = maskImgData.data;
    const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    if (startPos < 0 || startPos >= data.length) return null;
    const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];
    const visited = new Uint8Array(width * height);
    const stack = [[Math.floor(startX), Math.floor(startY)]];
    let pixelCount = 0;
    while (stack.length) {
        const [x, y] = stack.pop()!;
        const idx = y * width + x;
        if (visited[idx]) continue;
        visited[idx] = 1;
        const pos = idx * 4;
        const diff = Math.abs(data[pos] - r0) + Math.abs(data[pos+1] - g0) + Math.abs(data[pos+2] - b0);
        if (diff <= tolerance * 3) {
            maskData[pos] = 255; maskData[pos+1] = 255; maskData[pos+2] = 255; maskData[pos+3] = 255;
            pixelCount++;
            if (x > 0) stack.push([x-1, y]); if (x < width - 1) stack.push([x+1, y]);
            if (y > 0) stack.push([x, y-1]); if (y < height - 1) stack.push([x, y+1]);
        }
    }
    if (pixelCount < 50) return null;
    maskCtx.putImageData(maskImgData, 0, 0);
    return { maskCanvas };
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
    const [referenceImage, setReferenceImage] = useState<string | null>(null); // Imagem selecionada para o Canvas
    const [searchReferenceImage, setSearchReferenceImage] = useState<string | null>(null); // Imagem de referência para a BUSCA
    
    const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
    
    // Resultados da Busca
    const [whiteModelMatches, setWhiteModelMatches] = useState<any[]>([]);
    const [visibleCount, setVisibleCount] = useState(10);
    
    // Tools & Studio
    const canvasRef = useRef<HTMLCanvasElement>(null); 
    const containerRef = useRef<HTMLDivElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); 
    const [baseImgObj, setBaseImgObj] = useState<HTMLImageElement | null>(null);
    const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);
    const [history, setHistory] = useState<ImageData[]>([]);
    const [activeTool, setActiveTool] = useState<'WAND' | 'BRUSH' | 'ERASER' | 'HAND' | 'OFFSET'>('HAND');
    
    // Parameters
    const [view, setView] = useState({ x: 0, y: 0, k: 1 });
    const [patternScale, setPatternScale] = useState(0.5);
    const [patternRotation, setPatternRotation] = useState(0);
    const [patternOffset, setPatternOffset] = useState({ x: 0, y: 0 });
    const [edgeFeather, setEdgeFeather] = useState(1.5);
    const [shadowIntensity, setShadowIntensity] = useState(0.8);

    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [showPatternModal, setShowPatternModal] = useState(false);
    const isDrawingRef = useRef(false);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);
    const refFileInput = useRef<HTMLInputElement>(null);

    // --- RENDERER ---
    const renderCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!canvas || !baseImgObj || !maskCanvas) return;
        
        // FIX: Ensure canvas dimensions match image natural size to prevent distortion
        if (canvas.width !== baseImgObj.naturalWidth || canvas.height !== baseImgObj.naturalHeight) {
            canvas.width = baseImgObj.naturalWidth;
            canvas.height = baseImgObj.naturalHeight;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(baseImgObj, 0, 0, w, h);
        if (!patternImgObj) return;

        const tempC = document.createElement('canvas'); tempC.width = w; tempC.height = h;
        const tCtx = tempC.getContext('2d')!;
        if (edgeFeather > 0) tCtx.filter = `blur(${edgeFeather}px)`;
        tCtx.drawImage(maskCanvas, 0, 0);
        tCtx.filter = 'none';
        tCtx.globalCompositeOperation = 'source-in';
        tCtx.save();
        tCtx.translate(w/2 + patternOffset.x, h/2 + patternOffset.y);
        tCtx.rotate((patternRotation * Math.PI) / 180);
        tCtx.scale(patternScale, patternScale);
        const pat = tCtx.createPattern(patternImgObj, 'repeat');
        if (pat) { tCtx.fillStyle = pat; tCtx.fillRect(-w*8, -h*8, w*16, h*16); }
        tCtx.restore();

        ctx.save(); ctx.globalAlpha = 0.96; ctx.drawImage(tempC, 0, 0); ctx.restore();
        
        const shadowC = document.createElement('canvas'); shadowC.width = w; shadowC.height = h;
        const sCtx = shadowC.getContext('2d')!;
        sCtx.drawImage(maskCanvas, 0, 0);
        sCtx.globalCompositeOperation = 'source-in';
        sCtx.filter = `grayscale(100%) contrast(150%)`;
        sCtx.drawImage(baseImgObj, 0, 0);
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = shadowIntensity; ctx.drawImage(shadowC, 0, 0); ctx.restore();
    }, [baseImgObj, patternImgObj, patternScale, patternRotation, patternOffset, edgeFeather, shadowIntensity]);

    useEffect(() => { if(step === 'STUDIO') requestAnimationFrame(renderCanvas); }, [renderCanvas, step]);

    useEffect(() => {
        if (referenceImage) {
            const img = new Image(); img.src = referenceImage; img.crossOrigin = "anonymous";
            img.onload = () => {
                setBaseImgObj(img);
                // FIX: Use natural dimensions
                const w = img.naturalWidth;
                const h = img.naturalHeight;

                if (canvasRef.current) {
                    canvasRef.current.width = w;
                    canvasRef.current.height = h;
                }

                const mCanvas = document.createElement('canvas');
                mCanvas.width = w; mCanvas.height = h;
                maskCanvasRef.current = mCanvas;
                
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const scale = Math.min(rect.width / w, rect.height / h) * 0.9;
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
        setVisibleCount(10);
        
        try {
            let bodyPayload: any = { action: 'FIND_WHITE_MODELS', prompt: searchQuery };
            
            if (imgBase64) {
                const compressed = await compressImage(imgBase64);
                bodyPayload.mainImageBase64 = compressed.split(',')[1];
                bodyPayload.mainMimeType = 'image/jpeg';
            }

            const res = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(bodyPayload) 
            });
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
        const cx = rect.width / 2; const cy = rect.height / 2;
        const px = (e.clientX - rect.left - cx - view.x) / view.k + baseImgObj.naturalWidth / 2;
        const py = (e.clientY - rect.top - cy - view.y) / view.k + baseImgObj.naturalHeight / 2;
        
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
        if (activeTool === 'HAND' || e.button === 1) return;
        
        if (activeTool === 'WAND') {
            const res = createMockupMask(canvasRef.current!.getContext('2d')!, canvasRef.current!.width, canvasRef.current!.height, px, py, 30);
            if (res && maskCanvasRef.current) {
                setHistory(h => [...h.slice(-20), maskCanvasRef.current!.getContext('2d')!.getImageData(0,0,maskCanvasRef.current!.width,maskCanvasRef.current!.height)]);
                maskCanvasRef.current.getContext('2d')!.drawImage(res.maskCanvas, 0, 0);
                renderCanvas();
            }
        } else if (activeTool === 'OFFSET') {
            isDrawingRef.current = true;
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDrawingRef.current && lastPointerPos.current && activeTool === 'OFFSET') {
            const dx = (e.clientX - lastPointerPos.current.x) / view.k;
            const dy = (e.clientY - lastPointerPos.current.y) / view.k;
            setPatternOffset(p => ({ x: p.x + dx, y: p.y + dy }));
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#080808] text-white overflow-hidden font-sans">
            {step === 'SEARCH_BASE' ? (
                <div className="flex-1 bg-[#f0f2f5] overflow-y-auto text-gray-800">
                    <ModuleHeader icon={Camera} title="Provador Mágico" subtitle="Busca de Base" />
                    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-24">
                        
                        {/* ÁREA DE BUSCA (INPUT + UPLOAD) */}
                        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col md:flex-row gap-8">
                            <div className="flex-1 space-y-4">
                                <h3 className="text-xl font-black uppercase tracking-wider text-gray-900">Encontre o Modelo Ideal</h3>
                                <p className="text-sm text-gray-500">Faça o upload de uma referência para encontrarmos modelos usando roupas brancas com a mesma silhueta, ou descreva o que procura.</p>
                                
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={searchQuery} 
                                        onChange={e => setSearchQuery(e.target.value)} 
                                        onKeyDown={e => e.key === 'Enter' && performSearch()} 
                                        placeholder="Ex: Vestido longo seda, Camisa social..." 
                                        className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-vingi-500 font-bold" 
                                    />
                                    <button onClick={() => performSearch()} className="bg-vingi-900 text-white px-6 rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 min-w-[60px]">
                                        <Search size={20}/>
                                    </button>
                                </div>
                            </div>

                            <div className="w-px bg-gray-100 hidden md:block"></div>

                            <div className="flex-1">
                                <input type="file" ref={refFileInput} onChange={handleRefUpload} accept="image/*" className="hidden" />
                                <div 
                                    onClick={() => refFileInput.current?.click()}
                                    className="border-2 border-dashed border-gray-300 rounded-xl h-full min-h-[120px] flex flex-col items-center justify-center cursor-pointer hover:border-vingi-500 hover:bg-vingi-50 transition-all group relative overflow-hidden"
                                >
                                    {searchReferenceImage ? (
                                        <>
                                            <img src={searchReferenceImage} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                                            <div className="relative z-10 bg-white/90 px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                                                <RefreshCw size={14} className="text-vingi-600"/> <span className="text-xs font-bold text-gray-800">Trocar Referência</span>
                                            </div>
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

                        {/* LOADER DE BUSCA */}
                        {isSearching && (
                            <div className="text-center py-12">
                                <Loader2 size={48} className="animate-spin text-vingi-500 mx-auto mb-4"/>
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Analisando Silhueta & Buscando Modelos...</p>
                            </div>
                        )}

                        {/* GRID DE RESULTADOS */}
                        {!isSearching && whiteModelMatches.length > 0 && (
                            <div className="animate-fade-in space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><User size={20}/> Modelos Disponíveis ({whiteModelMatches.length})</h3>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {whiteModelMatches.slice(0, visibleCount).map((match, i) => (
                                        <RunwayModelCard 
                                            key={i} 
                                            match={match} 
                                            onSelect={(img) => { 
                                                setReferenceImage(img); 
                                                setShowPatternModal(true); 
                                                // Opcional: Rolar para o topo ou feedback
                                            }} 
                                        />
                                    ))}
                                </div>

                                {visibleCount < whiteModelMatches.length && (
                                    <div className="text-center pt-8">
                                        <button onClick={() => setVisibleCount(p => p + 10)} className="px-8 py-3 bg-white border border-gray-300 rounded-xl font-bold shadow-sm hover:bg-gray-50 hover:border-gray-400 text-gray-600 transition-all flex items-center gap-2 mx-auto">
                                            <Plus size={16}/> Carregar Mais Modelos (+10)
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ESTADO VAZIO INICIAL */}
                        {!isSearching && whiteModelMatches.length === 0 && (
                            <div className="text-center py-12 opacity-50">
                                <Shirt size={48} className="mx-auto mb-4 text-gray-300"/>
                                <p className="text-sm text-gray-400">Faça uma busca para ver modelos disponíveis.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col relative overflow-hidden bg-[#050505]">
                    <div className="bg-[#111] h-14 border-b border-white/5 px-4 flex items-center justify-between shrink-0 z-50">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/10 p-1.5 rounded-lg"><Camera size={18} className="text-vingi-400"/></div>
                            <div><h2 className="text-xs font-bold uppercase tracking-widest leading-none">Virtual Runway</h2><p className="text-[9px] text-gray-500 uppercase font-medium">Estúdio de Prova</p></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setStep('SEARCH_BASE')} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1"><X size={12}/> Trocar Base</button>
                            <button onClick={() => { if(canvasRef.current){ const l=document.createElement('a'); l.download='vingi.jpg'; l.href=canvasRef.current.toDataURL('image/jpeg',0.9); l.click(); } }} className="text-[10px] bg-vingi-600 px-4 py-1.5 rounded-lg font-bold">Salvar</button>
                        </div>
                    </div>
                    
                    <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => isDrawingRef.current = false}>
                        {/* BACKGROUND GRID (ATELIER STYLE) */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                        
                        <div className="relative shadow-2xl origin-center" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: baseImgObj?.naturalWidth, height: baseImgObj?.naturalHeight }}>
                            <canvas ref={canvasRef} className="block bg-white" />
                        </div>

                        {/* SLIDER OVERLAY */}
                        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-full max-w-[280px] pointer-events-none z-50">
                            <div className="bg-black/80 backdrop-blur-md border border-white/5 p-3 rounded-2xl pointer-events-auto shadow-2xl">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase"><span>Escala da Estampa</span><span>{Math.round(patternScale*100)}%</span></div>
                                    <input type="range" min="0.1" max="2" step="0.05" value={patternScale} onChange={e => setPatternScale(parseFloat(e.target.value))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-white"/>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#111] border-t border-white/5 shrink-0 z-50 pb-[env(safe-area-inset-bottom)]">
                        <div className="flex items-center justify-between px-2 py-2 overflow-x-auto gap-1 max-w-4xl mx-auto no-scrollbar">
                            <ToolBtn icon={Hand} label="Mover Tela" active={activeTool==='HAND'} onClick={() => setActiveTool('HAND')} />
                            <ToolBtn icon={Move3d} label="Posicionar" active={activeTool==='OFFSET'} onClick={() => setActiveTool('OFFSET')} />
                            <ToolBtn icon={Wand2} label="Varinha" active={activeTool==='WAND'} onClick={() => setActiveTool('WAND')} />
                            <div className="w-px h-8 bg-white/10 mx-1"></div>
                            <ToolBtn icon={Undo2} label="Desfazer" onClick={() => {}} disabled={history.length === 0} />
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
    <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center justify-center min-w-[64px] h-14 rounded-xl gap-1 transition-all active:scale-90 ${disabled ? 'opacity-20' : 'hover:bg-white/5'} ${active ? 'bg-vingi-900/40 text-white border border-vingi-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'text-gray-500 hover:text-gray-300'}`}>
        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className={active ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : ''} /> 
        <span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
    </button>
);
