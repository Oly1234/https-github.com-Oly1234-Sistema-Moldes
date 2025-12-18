
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Search, Wand2, UploadCloud, Layers, Check, Loader2, RefreshCw, X, Download, Zap, Hand, Play, Plus, ImageIcon, Upload, ArrowRight, MousePointer2 } from 'lucide-react';
import { ModuleHeader, SmartImageViewer } from '../../components/Shared';
import { useDevice } from '../../hooks/useDevice';
import { useRunwayStore } from './useRunwayStore';

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
    const stack: [number, number][] = [[Math.floor(startX), Math.floor(startY)]];
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

export const VirtualRunway: React.FC = () => {
    const { isMobile } = useDevice();
    const store = useRunwayStore();
    const [studioMode, setStudioMode] = useState(false);
    const [showPatternUpload, setShowPatternUpload] = useState(false);
    
    // UI Refs
    const canvasRef = useRef<HTMLCanvasElement>(null); 
    const containerRef = useRef<HTMLDivElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); 
    const searchImageInputRef = useRef<HTMLInputElement>(null);
    const patternInputRef = useRef<HTMLInputElement>(null);
    
    // Studio State
    const [baseImgObj, setBaseImgObj] = useState<HTMLImageElement | null>(null);
    const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);
    const [activeTool, setActiveTool] = useState<'WAND' | 'HAND'>('HAND');
    const [view, setView] = useState({ x: 0, y: 0, k: 1 });
    const [patternScale, setPatternScale] = useState(0.5);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);

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
        tCtx.drawImage(maskCanvas, 0, 0);
        tCtx.globalCompositeOperation = 'source-in';
        tCtx.save();
        tCtx.translate(w/2, h/2);
        tCtx.scale(patternScale, patternScale);
        const pat = tCtx.createPattern(patternImgObj, 'repeat');
        if (pat) { tCtx.fillStyle = pat; tCtx.fillRect(-w*4, -h*4, w*8, h*8); }
        tCtx.restore();

        ctx.save(); ctx.globalAlpha = 0.95; ctx.drawImage(tempC, 0, 0); ctx.restore();
        
        const shadowC = document.createElement('canvas'); shadowC.width = w; shadowC.height = h;
        const sCtx = shadowC.getContext('2d')!;
        sCtx.drawImage(maskCanvas, 0, 0);
        sCtx.globalCompositeOperation = 'source-in';
        sCtx.filter = `grayscale(100%) contrast(150%)`;
        sCtx.drawImage(baseImgObj, 0, 0);
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.7; ctx.drawImage(shadowC, 0, 0); ctx.restore();
    }, [baseImgObj, patternImgObj, patternScale]);

    useEffect(() => { if(studioMode) requestAnimationFrame(renderCanvas); }, [renderCanvas, studioMode]);

    const handleSelectBase = (u: string) => {
        const img = new Image(); img.src = u; img.crossOrigin = "anonymous";
        img.onload = () => {
            setBaseImgObj(img);
            if (canvasRef.current) {
                canvasRef.current.width = img.width;
                canvasRef.current.height = img.height;
            }
            const mCanvas = document.createElement('canvas');
            mCanvas.width = img.width; mCanvas.height = img.height;
            maskCanvasRef.current = mCanvas;
            store.setSelectedBase(u);
            setShowPatternUpload(true); // Solicita a estampa após escolher a base
        };
    };

    const handlePatternLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const r = new FileReader();
            r.onload = (ev) => {
                const src = ev.target?.result as string;
                store.setPatternImage(src);
                const pi = new Image(); pi.src = src;
                pi.onload = () => {
                    setPatternImgObj(pi);
                    setShowPatternUpload(false);
                    setStudioMode(true);
                };
            };
            r.readAsDataURL(file);
        }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if(!rect) return;
        const cx = rect.width / 2; const cy = rect.height / 2;
        const px = (e.clientX - rect.left - cx - view.x) / view.k + (baseImgObj?.width || 0) / 2;
        const py = (e.clientY - rect.top - cy - view.y) / view.k + (baseImgObj?.height || 0) / 2;
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
        if (activeTool === 'WAND' && canvasRef.current) {
            const res = createMockupMask(canvasRef.current.getContext('2d')!, canvasRef.current.width, canvasRef.current.height, px, py, 35);
            if (res && maskCanvasRef.current) {
                maskCanvasRef.current.getContext('2d')!.drawImage(res.maskCanvas, 0, 0);
                renderCanvas();
            }
        }
    };

    if (!studioMode && !showPatternUpload) {
        return (
            <div className="flex-1 flex flex-col bg-[#f8fafc] scroll-container">
                <ModuleHeader icon={Camera} title="Virtual Runway Pro" subtitle="Seleção de Base Contextual" />
                <div className="p-4 md:p-10 max-w-6xl mx-auto w-full space-y-10 pb-40">
                    {/* BUSCA NEURAL */}
                    <div className="bg-white p-6 md:p-14 rounded-[3rem] shadow-2xl border border-gray-100 flex flex-col items-center text-center gap-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-bl-full opacity-40 -z-0"></div>
                        <div className="w-20 h-20 bg-vingi-900 rounded-3xl flex items-center justify-center text-white shadow-xl relative z-10 animate-pulse-slow"><Camera size={40}/></div>
                        
                        <div className="max-w-2xl relative z-10">
                            <h2 className="text-3xl md:text-5xl font-black text-gray-900 uppercase tracking-tight mb-4">Encontre a Base Ideal</h2>
                            <p className="text-gray-500 font-medium text-sm md:text-lg">Carregue uma referência ou descreva o tipo de peça. O sistema buscará modelos reais em branco, priorizando contraste para facilitar a aplicação.</p>
                        </div>

                        <div className="w-full max-w-4xl flex flex-col md:flex-row gap-3 relative z-10">
                            <div className="flex-1 flex gap-3 bg-gray-50 p-2 rounded-2xl md:rounded-3xl border border-gray-200 focus-within:border-vingi-500 transition-all">
                                <input 
                                    type="text" 
                                    value={store.searchQuery} 
                                    onChange={e => store.setSearchQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && store.handleSearch()}
                                    placeholder="Ex: Vestido de seda longo, T-shirt feminina..." 
                                    className="flex-1 bg-transparent px-4 py-3 md:px-6 md:py-4 font-bold text-base md:text-xl outline-none text-gray-800"
                                />
                                <button onClick={() => searchImageInputRef.current?.click()} className="p-3 md:p-4 bg-white border border-gray-200 text-gray-500 rounded-xl md:rounded-2xl hover:bg-vingi-50 hover:text-vingi-600 transition-all shadow-sm" title="Pesquisar por Foto">
                                    <ImageIcon size={24}/>
                                </button>
                                <input type="file" ref={searchImageInputRef} onChange={(e) => { const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>store.handleSearch(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                            </div>
                            <button onClick={() => store.handleSearch()} disabled={store.isSearching} className="bg-vingi-900 text-white px-10 py-5 rounded-2xl md:rounded-3xl font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95">
                                {store.isSearching ? <Loader2 className="animate-spin" size={24}/> : <Search size={24}/>} Buscar Bases
                            </button>
                        </div>
                    </div>

                    {/* GRID DE RESULTADOS (PAGINADO) */}
                    {store.whiteBases.length > 0 && (
                        <div className="space-y-12 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                                <h3 className="text-xl font-black uppercase tracking-widest text-gray-400 flex items-center gap-3">
                                    <Check className="text-green-500" size={20}/> {store.whiteBases.length} Bases Detectadas
                                </h3>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8">
                                {store.whiteBases.slice(0, store.visibleCount).map((u, i) => (
                                    <div key={i} onClick={() => handleSelectBase(u)} className="group cursor-pointer space-y-4">
                                        <div className="aspect-[3/4] rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-white shadow-lg border-4 border-white transition-all group-hover:shadow-2xl group-hover:scale-[1.05] relative">
                                            <img src={u} className="w-full h-full object-cover" loading="lazy" />
                                            <div className="absolute inset-0 bg-vingi-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="bg-white px-6 py-3 rounded-full font-black text-vingi-900 text-xs uppercase tracking-widest flex items-center gap-2">Selecionar <ArrowRight size={14}/></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {store.visibleCount < store.whiteBases.length && (
                                <div className="flex justify-center pt-8">
                                    <button onClick={store.loadMore} className="bg-white border-2 border-gray-200 text-gray-500 px-14 py-6 rounded-full font-black uppercase tracking-widest hover:border-vingi-900 hover:text-vingi-900 transition-all flex items-center gap-4 shadow-sm active:scale-95">
                                        <Plus size={24}/> Carregar Mais (+10)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (showPatternUpload) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] p-6 text-center animate-fade-in">
                <div className="max-w-md w-full space-y-10">
                    <div className="relative inline-block">
                        <img src={store.selectedBase!} className="w-48 h-64 object-cover rounded-3xl border-4 border-vingi-500/50 shadow-2xl mx-auto" />
                        <div className="absolute -bottom-4 -right-4 bg-vingi-500 p-3 rounded-full text-white shadow-xl"><Check size={24}/></div>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black uppercase tracking-tight text-white">Base Selecionada!</h2>
                        <p className="text-gray-500 mt-2 font-medium">Agora selecione a estampa que deseja aplicar.</p>
                    </div>
                    <button 
                        onClick={() => patternInputRef.current?.click()}
                        className="w-full py-6 bg-white text-black rounded-3xl font-black text-lg uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-vingi-400 transition-all shadow-2xl active:scale-95"
                    >
                        <Upload size={24}/> Carregar Estampa
                    </button>
                    <input type="file" ref={patternInputRef} onChange={handlePatternLoad} className="hidden" accept="image/*" />
                    <button onClick={() => setShowPatternUpload(false)} className="text-gray-600 font-bold uppercase text-xs tracking-widest hover:text-white transition-colors">Voltar para Bases</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#050505]">
            <div className="bg-[#111] h-14 border-b border-white/5 px-4 flex items-center justify-between z-50">
                <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                        <img src={store.selectedBase!} className="w-8 h-8 rounded-full border border-white/20 object-cover" title="Base" />
                        <img src={store.patternImage!} className="w-8 h-8 rounded-full border border-white/20 object-cover" title="Estampa" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Runway Studio v6.5</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setStudioMode(false); setBaseImgObj(null); }} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1"><RefreshCw size={12}/> Reiniciar</button>
                    <button onClick={() => {}} className="text-[10px] bg-vingi-600 px-4 py-1.5 rounded-lg font-bold">Salvar 4K</button>
                </div>
            </div>
            
            <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden touch-none" onPointerDown={handlePointerDown}>
                <div className="relative shadow-2xl origin-center" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                    <canvas ref={canvasRef} className="block bg-white" />
                </div>

                {/* SLIDER HUD */}
                <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-full max-w-[280px] pointer-events-none z-50">
                    <div className="bg-black/90 backdrop-blur-md border border-white/10 p-5 rounded-[2rem] pointer-events-auto shadow-2xl space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-black text-gray-500 uppercase tracking-widest"><span>Escala Estampa</span><span>{Math.round(patternScale*100)}%</span></div>
                            <input type="range" min="0.1" max="2" step="0.05" value={patternScale} onChange={e => setPatternScale(parseFloat(e.target.value))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-white"/>
                        </div>
                        <button onClick={() => patternInputRef.current?.click()} className="w-full py-3 bg-white/5 text-white border border-white/10 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"><RefreshCw size={14}/> Trocar Estampa</button>
                    </div>
                </div>
            </div>

            <div className="bg-[#111] border-t border-white/5 shrink-0 z-50 pb-[env(safe-area-inset-bottom)]">
                <div className="flex items-center justify-center px-4 py-5 gap-8">
                    <ToolBtn icon={Hand} label="Pan" active={activeTool==='HAND'} onClick={() => setActiveTool('HAND')} />
                    <ToolBtn icon={Wand2} label="Preencher" active={activeTool==='WAND'} onClick={() => setActiveTool('WAND')} />
                    <ToolBtn icon={ImageIcon} label="Bases" onClick={() => { setStudioMode(false); setBaseImgObj(null); }} />
                </div>
            </div>
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center min-w-[75px] h-14 rounded-2xl gap-1.5 transition-all active:scale-90 ${active ? 'bg-vingi-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] border border-white/20' : 'text-gray-500 hover:text-gray-300'}`}>
        <Icon size={22} strokeWidth={active ? 2.5 : 1.5} /> 
        <span className="text-[10px] font-black uppercase tracking-tight">{label}</span>
    </button>
);
