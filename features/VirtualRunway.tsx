
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Search, Wand2, UploadCloud, Layers, Move, Eraser, Check, Loader2, Image as ImageIcon, Shirt, RefreshCw, X, Download, MousePointer2, ChevronRight, RotateCw, Sun, Droplets, Zap, Sliders, Sparkles, Brush, PenTool, Focus, ShieldCheck, Hand, ZoomIn, ZoomOut, RotateCcw, BrainCircuit, Maximize, Undo2, Grid, ScanLine, ArrowLeft, MoreHorizontal, CheckCircle2, Play, Plus, MinusCircle, PlusCircle, Target, Move3d, Trash2, RefreshCcw } from 'lucide-react';
import { ModuleHeader, ModuleLandingPage } from '../components/Shared';

// --- HELPERS MATEMÁTICOS & VISÃO ---

const createMockupMask = (ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number, tolerance: number) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
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

export const VirtualRunway: React.FC<{ onNavigateToCreator: () => void }> = ({ onNavigateToCreator }) => {
    const [step, setStep] = useState<'SEARCH_BASE' | 'STUDIO'>('SEARCH_BASE');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
    const [whiteBases, setWhiteBases] = useState<string[]>([]);
    
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

    // Search Engine
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchStatus, setSearchStatus] = useState('');

    const isDrawingRef = useRef(false);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);
    const [showPatternModal, setShowPatternModal] = useState(false);

    // --- ATALHOS ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoMask(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history]);

    const resetRunway = () => {
        if (confirm("Deseja voltar ao zero? Todas as máscaras e ajustes serão removidos.")) {
            if (maskCanvasRef.current) {
                const ctx = maskCanvasRef.current.getContext('2d')!;
                ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
            }
            setPatternOffset({ x: 0, y: 0 });
            setPatternScale(0.5);
            setPatternRotation(0);
            setHistory([]);
            renderCanvas();
        }
    };

    const undoMask = () => {
        if (history.length > 0 && maskCanvasRef.current) {
            const prev = history[history.length - 1];
            maskCanvasRef.current.getContext('2d')!.putImageData(prev, 0, 0);
            setHistory(h => h.slice(0, -1));
            renderCanvas();
        }
    };

    const renderCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!canvas || !baseImgObj || !maskCanvas) return;
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
        
        // Realistic Shadows
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
                const mCanvas = document.createElement('canvas');
                mCanvas.width = img.width; mCanvas.height = img.height;
                maskCanvasRef.current = mCanvas;
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setView({ x: 0, y: 0, k: Math.min(rect.width / img.width, rect.height / img.height) * 0.9 });
                }
            };
        }
    }, [referenceImage]);

    // Search logic (Simplified)
    const performSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true); setSearchStatus('Localizando Bases...');
        try {
            const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'FIND_WHITE_MODELS', prompt: searchQuery }) });
            const data = await res.json();
            if (data.success) {
                const results = await Promise.all(data.queries.slice(0, 5).map(async (q: string) => {
                    const r = await fetch('/api/analyze', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ action: 'GET_LINK_PREVIEW', backupSearchTerm: q, linkType: 'SEARCH_QUERY' }) });
                    const d = await r.json(); return d.success ? d.image : null;
                }));
                setWhiteBases(results.filter(u => u));
            }
        } catch(e) { console.error(e); } finally { setIsSearching(false); setSearchStatus(''); }
    };

    const getCanvasCoords = (clientX: number, clientY: number) => {
        if (!canvasRef.current || !containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const px = (clientX - rect.left - rect.width/2 - view.x) / view.k + canvasRef.current.width / 2;
        const py = (clientY - rect.top - rect.height/2 - view.y) / view.k + canvasRef.current.height / 2;
        return { x: px, y: py };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
        if (activeTool === 'HAND' || e.button === 1) return;
        const { x, y } = getCanvasCoords(e.clientX, e.clientY);
        if (activeTool === 'WAND') {
            const res = createMockupMask(canvasRef.current!.getContext('2d')!, canvasRef.current!.width, canvasRef.current!.height, x, y, 30);
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
        <div className="flex flex-col h-full bg-[#000] text-white overflow-hidden">
            {step === 'SEARCH_BASE' ? (
                <div className="flex-1 bg-[#f0f2f5] overflow-y-auto text-gray-800">
                    <ModuleHeader icon={Camera} title="Provador Mágico" subtitle="Busca de Base" />
                    <div className="max-w-4xl mx-auto p-8 space-y-8">
                        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                            <h3 className="text-2xl font-black mb-4">Selecione um Modelo de Base</h3>
                            <div className="flex gap-4">
                                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Ex: Vestido branco seda..." className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-vingi-500" />
                                <button onClick={performSearch} className="bg-vingi-900 text-white px-8 rounded-xl font-bold">{isSearching ? <Loader2 className="animate-spin"/> : "Buscar"}</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {whiteBases.map((u, i) => (
                                <div key={i} onClick={() => { setReferenceImage(u); setShowPatternModal(true); }} className="aspect-[3/4] bg-white rounded-xl overflow-hidden cursor-pointer hover:ring-4 ring-vingi-500 transition-all shadow-md"><img src={u} className="w-full h-full object-cover"/></div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col relative overflow-hidden bg-[#050505]">
                    <div className="bg-[#111] px-4 py-2 flex items-center justify-between border-b border-gray-900 shrink-0 z-50 h-14">
                        <div className="flex items-center gap-2"><Camera size={18} className="text-vingi-400"/><span className="font-bold text-sm">Estúdio Runway</span></div>
                        <div className="flex gap-2">
                            <button onClick={resetRunway} className="text-[10px] bg-gray-800 px-3 py-1.5 rounded hover:bg-red-900 transition-colors">Voltar ao Zero</button>
                            <button onClick={() => { if(canvasRef.current){ const l=document.createElement('a'); l.download='vingi.jpg'; l.href=canvasRef.current.toDataURL('image/jpeg',0.9); l.click(); } }} className="text-[10px] bg-vingi-600 px-3 py-1.5 rounded font-bold">Salvar</button>
                        </div>
                    </div>
                    
                    <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => isDrawingRef.current = false}>
                        <div className="relative shadow-2xl origin-center" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: baseImgObj?.width, height: baseImgObj?.height }}>
                            <canvas ref={canvasRef} className="block bg-white" />
                        </div>
                    </div>

                    {/* STUDIO DOCK */}
                    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-4 pointer-events-none">
                        <div className="bg-black/95 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl pointer-events-auto flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase"><span>Escala Estampa</span></div>
                                    <input type="range" min="0.1" max="2" step="0.05" value={patternScale} onChange={e => setPatternScale(parseFloat(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-white"/>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase"><span>Borda (Feather)</span></div>
                                    <input type="range" min="0" max="10" step="0.5" value={edgeFeather} onChange={e => setEdgeFeather(parseFloat(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-white"/>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#111] border-t border-gray-800 shrink-0 z-50 pb-[env(safe-area-inset-bottom)]">
                        <div className="flex items-center justify-between px-2 py-2 overflow-x-auto gap-2 max-w-4xl mx-auto">
                            <ToolBtn icon={Hand} label="Mover Tela" active={activeTool==='HAND'} onClick={() => setActiveTool('HAND')} />
                            <ToolBtn icon={Move3d} label="Posicionar" active={activeTool==='OFFSET'} onClick={() => setActiveTool('OFFSET')} />
                            <ToolBtn icon={Wand2} label="Varinha" active={activeTool==='WAND'} onClick={() => setActiveTool('WAND')} />
                            <div className="w-px h-8 bg-gray-800 mx-1"></div>
                            <ToolBtn icon={Undo2} label="Desfazer" onClick={undoMask} disabled={history.length === 0} />
                            <ToolBtn icon={RefreshCcw} label="Estampa" onClick={() => setShowPatternModal(true)} />
                        </div>
                    </div>
                </div>
            )}

            {showPatternModal && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-[#1a1a1a] border border-gray-800 rounded-3xl p-8 max-w-md w-full text-center relative shadow-2xl">
                        <h3 className="text-2xl font-bold mb-4">Aplicar Estampa</h3>
                        <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>{ setSelectedPattern(ev.target?.result as string); const pi=new Image(); pi.src=ev.target?.result as string; pi.onload=()=>setPatternImgObj(pi); setShowPatternModal(false); setStep('STUDIO'); }; r.readAsDataURL(f); } }} className="hidden" id="p-up" />
                        <label htmlFor="p-up" className="w-full py-4 bg-vingi-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 cursor-pointer hover:bg-vingi-500 transition-all"><UploadCloud size={24}/> CARREGAR ARQUIVO</label>
                        <button onClick={() => setShowPatternModal(false)} className="mt-4 text-xs text-gray-500 hover:text-white uppercase font-bold tracking-widest">Cancelar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center justify-center min-w-[64px] h-14 rounded-xl gap-1 transition-all active:scale-90 ${disabled ? 'opacity-20' : 'hover:bg-white/5'} ${active ? 'bg-vingi-900/50 text-white border border-vingi-500/30' : 'text-gray-500'}`}>
        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} /> 
        <span className="text-[9px] font-bold uppercase">{label}</span>
    </button>
);
