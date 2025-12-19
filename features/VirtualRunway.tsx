
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Search, Wand2, UploadCloud, Layers, Check, Loader2, Image as ImageIcon, RefreshCw, X, Download, Zap, Hand, Play, Plus, ImageIcon as IconImage, ArrowRight, ArrowLeft } from 'lucide-react';
import { ModuleHeader, SmartImageViewer } from '../components/Shared';

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

export const VirtualRunway: React.FC<{ onNavigateToCreator: () => void }> = ({ onNavigateToCreator }) => {
    // Flow Management
    const [step, setStep] = useState<'BASE_SEARCH' | 'PATTERN_UPLOAD' | 'STUDIO'>('BASE_SEARCH');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [whiteBases, setWhiteBases] = useState<string[]>([]);
    const [visibleCount, setVisibleCount] = useState(10);
    
    // Selection State
    const [selectedBase, setSelectedBase] = useState<string | null>(null);
    const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
    
    // Studio Objects
    const canvasRef = useRef<HTMLCanvasElement>(null); 
    const containerRef = useRef<HTMLDivElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); 
    const [baseImgObj, setBaseImgObj] = useState<HTMLImageElement | null>(null);
    const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);
    
    // Tools & Parameters
    const [activeTool, setActiveTool] = useState<'WAND' | 'HAND'>('HAND');
    const [view, setView] = useState({ x: 0, y: 0, k: 1 });
    const [patternScale, setPatternScale] = useState(0.5);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);

    // --- SEARCH LOGIC (Neural & Optimized for Contrast) ---
    const performSearch = async (imageForSearch?: string) => {
        setIsSearching(true);
        setVisibleCount(10);
        try {
            let contextPrompt = searchQuery;
            if (imageForSearch) {
                const analysis = await fetch('/api/analyze', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ action: 'ANALYZE_REFERENCE_FOR_PROMPT', mainImageBase64: imageForSearch.split(',')[1] || imageForSearch }) 
                });
                const analysisData = await analysis.json();
                contextPrompt = analysisData.prompt || "Peça de roupa";
            }

            // Force high contrast prompt
            const refinedQuery = `${contextPrompt} in solid white color, dark background or outdoor shadow, tanned skin professional photoshoot`;
            
            const res = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ action: 'FIND_WHITE_MODELS', prompt: refinedQuery }) 
            });
            const data = await res.json();
            
            if (data.success) {
                // Fetch high quality images for each query variation
                const results = await Promise.all(data.queries.slice(0, 50).map(async (q: string) => {
                    const r = await fetch('/api/analyze', { 
                        method: 'POST', 
                        headers: {'Content-Type': 'application/json'}, 
                        body: JSON.stringify({ action: 'GET_LINK_PREVIEW', backupSearchTerm: q, linkType: 'SEARCH_QUERY' }) 
                    });
                    const d = await r.json(); 
                    return d.success ? d.image : null;
                }));
                setWhiteBases(results.filter(u => u !== null));
            }
        } catch(e) { 
            console.error(e); 
        } finally { 
            setIsSearching(false); 
        }
    };

    const handleSelectBase = (url: string) => {
        setSelectedBase(url);
        const img = new Image(); img.src = url; img.crossOrigin = "anonymous";
        img.onload = () => {
            setBaseImgObj(img);
            const mCanvas = document.createElement('canvas');
            mCanvas.width = img.width; mCanvas.height = img.height;
            maskCanvasRef.current = mCanvas;
            setStep('PATTERN_UPLOAD');
        };
    };

    const handlePatternUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const r = new FileReader();
            r.onload = (ev) => {
                const src = ev.target?.result as string;
                setSelectedPattern(src);
                const pi = new Image(); pi.src = src;
                pi.onload = () => {
                    setPatternImgObj(pi);
                    setStep('STUDIO');
                };
            };
            r.readAsDataURL(file);
        }
    };

    // --- RENDERER ---
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
        sCtx.filter = `grayscale(100%) contrast(160%) brightness(90%)`;
        sCtx.drawImage(baseImgObj, 0, 0);
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.8; ctx.drawImage(shadowC, 0, 0); ctx.restore();
    }, [baseImgObj, patternImgObj, patternScale]);

    useEffect(() => { if(step === 'STUDIO') requestAnimationFrame(renderCanvas); }, [renderCanvas, step]);

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

    // --- STEP: BASE SEARCH ---
    if (step === 'BASE_SEARCH') {
        return (
            <div className="flex-1 flex flex-col bg-[#f8fafc] view-scroll-container">
                <ModuleHeader icon={Camera} title="Virtual Runway Pro" subtitle="Seleção de Base Neural" />
                <div className="p-4 md:p-10 max-w-6xl mx-auto w-full space-y-12 pb-32">
                    <div className="bg-white p-8 md:p-14 rounded-[3.5rem] shadow-2xl border border-gray-100 flex flex-col items-center text-center gap-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-vingi-50 rounded-bl-full opacity-50 -z-0"></div>
                        <div className="w-20 h-20 bg-vingi-900 rounded-3xl flex items-center justify-center text-white shadow-xl relative z-10 animate-pulse-slow"><Camera size={40}/></div>
                        
                        <div className="max-w-2xl relative z-10">
                            <h2 className="text-3xl md:text-5xl font-black text-gray-900 uppercase tracking-tight mb-4">Provador Mágico</h2>
                            <p className="text-gray-500 font-medium text-sm md:text-lg leading-relaxed">A IA buscará modelos com roupas brancas e fundos de alto contraste. Envie uma foto ou descreva o modelo desejado.</p>
                        </div>

                        <div className="w-full max-w-4xl flex flex-col md:flex-row gap-3 relative z-10">
                            <div className="flex-1 flex gap-3 bg-gray-50 p-2 rounded-2xl md:rounded-3xl border border-gray-200 focus-within:border-vingi-500 transition-all">
                                <input 
                                    type="text" 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && performSearch()}
                                    placeholder="Ex: Vestido de seda longo, T-shirt feminina..." 
                                    className="flex-1 bg-transparent px-4 py-3 md:px-6 md:py-4 font-bold text-base md:text-xl outline-none text-gray-800"
                                />
                                <button 
                                    onClick={() => {
                                        const f = document.createElement('input'); f.type='file'; f.accept='image/*';
                                        f.onchange=(ev:any)=>{ const file=ev.target.files[0]; const r=new FileReader(); r.onload=(e)=>performSearch(e.target?.result as string); r.readAsDataURL(file); };
                                        f.click();
                                    }} 
                                    className="p-3 md:p-4 bg-white border border-gray-200 text-gray-500 rounded-xl md:rounded-2xl hover:text-vingi-600 transition-all shadow-sm"
                                >
                                    <IconImage size={24}/>
                                </button>
                            </div>
                            <button onClick={() => performSearch()} disabled={isSearching} className="bg-vingi-900 text-white px-10 py-5 rounded-2xl md:rounded-3xl font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95">
                                {isSearching ? <Loader2 className="animate-spin" size={24}/> : <Search size={24}/>} Buscar Bases
                            </button>
                        </div>
                    </div>

                    {whiteBases.length > 0 && (
                        <div className="space-y-12 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                                <h3 className="text-xl font-black uppercase tracking-widest text-gray-400 flex items-center gap-3">
                                    <Check className="text-green-500" size={20}/> {whiteBases.length} Bases Encontradas
                                </h3>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8">
                                {whiteBases.slice(0, visibleCount).map((u, i) => (
                                    <div key={i} onClick={() => handleSelectBase(u)} className="group cursor-pointer">
                                        <div className="aspect-[3/4] rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-white shadow-lg border-4 border-white transition-all group-hover:shadow-2xl group-hover:scale-[1.05] relative">
                                            <img src={u} className="w-full h-full object-cover" loading="lazy" />
                                            <div className="absolute inset-0 bg-vingi-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="bg-white px-6 py-3 rounded-full font-black text-vingi-900 text-xs uppercase tracking-widest flex items-center gap-2">Selecionar <ArrowRight size={14}/></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {visibleCount < whiteBases.length && (
                                <div className="flex justify-center pt-8">
                                    <button onClick={() => setVisibleCount(p => p + 10)} className="bg-white border-2 border-gray-200 text-gray-500 px-14 py-6 rounded-full font-black uppercase tracking-widest hover:border-vingi-900 hover:text-vingi-900 transition-all flex items-center gap-4 shadow-sm active:scale-95">
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

    // --- STEP: PATTERN UPLOAD ---
    if (step === 'PATTERN_UPLOAD') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] p-6 text-center animate-fade-in h-full">
                <div className="max-w-md w-full space-y-10">
                    <div className="relative inline-block">
                        <img src={selectedBase!} className="w-48 h-64 object-cover rounded-[2.5rem] border-4 border-vingi-500 shadow-2xl mx-auto" />
                        <div className="absolute -bottom-4 -right-4 bg-vingi-500 p-4 rounded-full text-white shadow-xl"><Check size={28}/></div>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black uppercase tracking-tight text-white">Base Escolhida!</h2>
                        <p className="text-gray-500 mt-3 font-medium text-lg">Agora, selecione a estampa que deseja aplicar neste modelo.</p>
                    </div>
                    <button 
                        onClick={() => { const f=document.createElement('input'); f.type='file'; f.accept='image/*'; f.onchange=handlePatternUpload; f.click(); }}
                        className="w-full py-7 bg-white text-black rounded-3xl font-black text-lg uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-vingi-400 transition-all shadow-2xl active:scale-95"
                    >
                        <UploadCloud size={28}/> Carregar Estampa
                    </button>
                    <button onClick={() => setStep('BASE_SEARCH')} className="text-gray-600 font-black uppercase text-[10px] tracking-[0.3em] hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto"><ArrowLeft size={14}/> Voltar para Bases</button>
                </div>
            </div>
        );
    }

    // --- STEP: STUDIO ---
    return (
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#050505] h-full">
            <div className="bg-[#111] h-14 border-b border-white/5 px-4 flex items-center justify-between z-50">
                <div className="flex items-center gap-3">
                    <div className="flex -space-x-3">
                        <img src={selectedBase!} className="w-9 h-9 rounded-full border-2 border-white/20 object-cover" title="Base" />
                        <img src={selectedPattern!} className="w-9 h-9 rounded-full border-2 border-white/20 object-cover" title="Estampa" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hidden sm:block">Runway Studio Pro v6.5</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setStep('BASE_SEARCH'); setBaseImgObj(null); setPatternImgObj(null); }} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 font-bold"><RefreshCw size={14}/> Reiniciar</button>
                    <button onClick={() => { if(canvasRef.current){ const l=document.createElement('a'); l.download='runway.png'; l.href=canvasRef.current.toDataURL(); l.click(); } }} className="text-[10px] bg-vingi-600 px-5 py-1.5 rounded-xl font-black uppercase tracking-widest">Exportar 4K</button>
                </div>
            </div>
            
            <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden touch-none" onPointerDown={handlePointerDown}>
                <div className="relative shadow-2xl origin-center" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                    <canvas ref={canvasRef} className="block bg-white" />
                </div>

                <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-full max-w-[300px] pointer-events-none z-50">
                    <div className="bg-black/90 backdrop-blur-2xl border border-white/10 p-6 rounded-[2.5rem] pointer-events-auto shadow-2xl space-y-5">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-black text-gray-500 uppercase tracking-widest"><span>Escala Estampa</span><span>{Math.round(patternScale*100)}%</span></div>
                            <input type="range" min="0.1" max="2" step="0.05" value={patternScale} onChange={e => setPatternScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-white"/>
                        </div>
                        <button onClick={() => { const f=document.createElement('input'); f.type='file'; f.accept='image/*'; f.onchange=handlePatternUpload; f.click(); }} className="w-full py-3.5 bg-white/5 text-white border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"><RefreshCw size={14}/> Trocar Estampa</button>
                    </div>
                </div>
            </div>

            <div className="bg-[#111] border-t border-white/5 shrink-0 z-50 pb-[env(safe-area-inset-bottom)]">
                <div className="flex items-center justify-center px-4 py-6 gap-10">
                    <ToolBtn icon={Hand} label="Mover Tela" active={activeTool==='HAND'} onClick={() => setActiveTool('HAND')} />
                    <ToolBtn icon={Wand2} label="Preencher" active={activeTool==='WAND'} onClick={() => setActiveTool('WAND')} />
                    <ToolBtn icon={ImageIcon} label="Novas Bases" onClick={() => setStep('BASE_SEARCH')} />
                </div>
            </div>
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center min-w-[80px] h-16 rounded-2xl gap-2 transition-all active:scale-90 ${active ? 'bg-vingi-600 text-white shadow-[0_0_25px_rgba(59,130,246,0.4)] border border-white/30' : 'text-gray-500 hover:text-gray-300'}`}>
        <Icon size={24} strokeWidth={active ? 2.5 : 1.5} /> 
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
);
