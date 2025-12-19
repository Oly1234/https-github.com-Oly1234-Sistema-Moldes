
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Camera, Search, Wand2, UploadCloud, Layers, Move, Eraser, Check, Loader2, Image as ImageIcon, 
    Shirt, RefreshCw, X, Download, MousePointer2, ChevronRight, RotateCw, Sun, Droplets, 
    Zap, Sliders, Sparkles, Brush, Focus, BrainCircuit, Maximize, Undo2, Grid, ScanLine, 
    ArrowLeft, MoreHorizontal, CheckCircle2, Play, Plus, MinusCircle, PlusCircle, Target, 
    Move3d, Trash2, Palette, Ruler
} from 'lucide-react';
import { ModuleHeader, ModuleLandingPage } from '../components/Shared';

// --- ENGINE DE MÁSCARA OTIMIZADA PARA BRANCO ---
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
        
        // Roupas brancas em estúdio costumam ter sombras cinzas, por isso a tolerância é mais permissiva no brilho
        if (diff <= tolerance * 3.5) {
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
    const [step, setStep] = useState<'INPUT' | 'SEARCH_BASE' | 'STUDIO'>('INPUT');
    const [referenceImage, setReferenceImage] = useState<string | null>(null); // Foto do usuário ou base manual
    const [baseModelImage, setBaseModelImage] = useState<string | null>(null); // A modelo branca escolhida
    const [selectedPattern, setSelectedPattern] = useState<string | null>(null); // Estampa vinda do Atelier
    const [whiteBases, setWhiteBases] = useState<string[]>([]);
    
    // UI State
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [dnaAnalysis, setDnaAnalysis] = useState<string | null>(null);

    // Studio Engine
    const canvasRef = useRef<HTMLCanvasElement>(null); 
    const containerRef = useRef<HTMLDivElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); 
    const [baseImgObj, setBaseImgObj] = useState<HTMLImageElement | null>(null);
    const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);
    const [activeTool, setActiveTool] = useState<'WAND' | 'HAND' | 'OFFSET'>('WAND');
    
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
    const [patternScale, setPatternScale] = useState(0.45);
    const [patternRotation, setPatternRotation] = useState(0);
    const [patternOffset, setPatternOffset] = useState({ x: 0, y: 0 });
    const [shadowIntensity, setShadowIntensity] = useState(0.85);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const patternInputRef = useRef<HTMLInputElement>(null);

    // Carregar estampa ativa se houver
    useEffect(() => {
        const storedPattern = localStorage.getItem('vingi_mockup_pattern');
        if (storedPattern) {
            setSelectedPattern(storedPattern);
            const pi = new Image(); pi.src = storedPattern; pi.onload = () => setPatternImgObj(pi);
        }
    }, []);

    const handleUpload = (src: string) => {
        setReferenceImage(src);
        analyzeDnaAndSearch(src);
    };

    const analyzeDnaAndSearch = async (src: string) => {
        setIsProcessing(true); setStatusMessage("Extraindo DNA Têxtil...");
        try {
            // 1. Analisar silhueta da referência
            const resDna = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ action: 'ANALYZE_REFERENCE_FOR_PROMPT', mainImageBase64: src.split(',')[1] }) 
            });
            const dataDna = await resDna.json();
            const structure = dataDna.prompt || "Vestido";
            setDnaAnalysis(structure);

            // 2. Buscar 55 bases brancas correspondentes
            setStatusMessage("Buscando Acervo Global (Bases Brancas)...");
            const resSearch = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ action: 'FIND_WHITE_MODELS', prompt: structure }) 
            });
            const dataSearch = await resSearch.json();
            
            if (dataSearch.success && dataSearch.queries) {
                setStep('SEARCH_BASE');
                // Buscamos as imagens via scraper paralelo
                const previews = await Promise.all(dataSearch.queries.slice(0, 55).map(async (q: string) => {
                    const r = await fetch('/api/analyze', { 
                        method: 'POST', 
                        headers: {'Content-Type': 'application/json'}, 
                        body: JSON.stringify({ action: 'GET_LINK_PREVIEW', backupSearchTerm: q, linkType: 'SEARCH_QUERY' }) 
                    });
                    const d = await r.json(); return d.success ? d.image : null;
                }));
                setWhiteBases(previews.filter(u => u));
            }
        } catch (e) { alert("Falha na rede ou na análise."); } 
        finally { setIsProcessing(false); }
    };

    const initStudio = (baseSrc: string) => {
        setBaseModelImage(baseSrc);
        setIsProcessing(true); setStatusMessage("Calibrando Provador...");
        const img = new Image(); img.src = baseSrc; img.crossOrigin = "anonymous";
        img.onload = () => {
            setBaseImgObj(img);
            if (canvasRef.current) { 
                canvasRef.current.width = img.width; 
                canvasRef.current.height = img.height; 
            }
            const mCanvas = document.createElement('canvas'); 
            mCanvas.width = img.width; 
            mCanvas.height = img.height;
            maskCanvasRef.current = mCanvas;
            setStep('STUDIO');
            setIsProcessing(false);
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setView({ x: 0, y: 0, k: Math.min(rect.width / img.width, rect.height / img.height) * 0.9 });
            }
        };
    };

    const render = useCallback(() => {
        const canvas = canvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!canvas || !baseImgObj || !maskCanvas) return;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. Base Original
        ctx.drawImage(baseImgObj, 0, 0);

        // 2. Aplicação da Estampa sobre a Máscara
        if (patternImgObj) {
            const tempC = document.createElement('canvas'); tempC.width = canvas.width; tempC.height = canvas.height;
            const tCtx = tempC.getContext('2d')!;
            tCtx.drawImage(maskCanvas, 0, 0);
            tCtx.globalCompositeOperation = 'source-in';
            tCtx.save();
            tCtx.translate(canvas.width/2 + patternOffset.x, canvas.height/2 + patternOffset.y);
            tCtx.rotate((patternRotation * Math.PI) / 180);
            tCtx.scale(patternScale, patternScale);
            const pat = tCtx.createPattern(patternImgObj, 'repeat');
            if (pat) { tCtx.fillStyle = pat; tCtx.fillRect(-canvas.width*10, -canvas.height*10, canvas.width*20, canvas.height*20); }
            tCtx.restore();
            ctx.save(); ctx.globalAlpha = 0.95; ctx.drawImage(tempC, 0, 0); ctx.restore();

            // 3. Mesclagem de Sombra (Industrial Multiply)
            const shadowC = document.createElement('canvas'); shadowC.width = canvas.width; shadowC.height = canvas.height;
            const sCtx = shadowC.getContext('2d')!;
            sCtx.drawImage(maskCanvas, 0, 0);
            sCtx.globalCompositeOperation = 'source-in';
            sCtx.filter = `grayscale(100%) contrast(160%)`;
            sCtx.drawImage(baseImgObj, 0, 0);
            ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = shadowIntensity; ctx.drawImage(shadowC, 0, 0); ctx.restore();
        }
    }, [baseImgObj, patternImgObj, patternScale, patternRotation, patternOffset, shadowIntensity]);

    useEffect(() => { if (step === 'STUDIO') requestAnimationFrame(render); }, [render, step]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (step !== 'STUDIO' || !containerRef.current || !baseImgObj) return;
        const rect = containerRef.current.getBoundingClientRect();
        const px = (e.clientX - rect.left - rect.width/2 - view.x) / view.k + baseImgObj.width/2;
        const py = (e.clientY - rect.top - rect.height/2 - view.y) / view.k + baseImgObj.height/2;

        if (activeTool === 'WAND') {
            const res = createMockupMask(canvasRef.current!.getContext('2d')!, canvasRef.current!.width, canvasRef.current!.height, px, py, 35);
            if (res) { maskCanvasRef.current!.getContext('2d')!.drawImage(res.maskCanvas, 0, 0); render(); }
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden select-none">
            {step === 'INPUT' ? (
                <div className="flex-1 overflow-y-auto">
                    <ModuleHeader icon={Camera} title="Provador Mágico" subtitle="Virtual Runway v7.0" />
                    <input type="file" ref={fileInputRef} onChange={e => {const f=e.target.files?.[0]; if(f){const r=new FileReader(); r.onload=ev=>handleUpload(ev.target?.result as string); r.readAsDataURL(f);}}} className="hidden" accept="image/*" />
                    <input type="file" ref={cameraInputRef} onChange={e => {const f=e.target.files?.[0]; if(f){const r=new FileReader(); r.onload=ev=>handleUpload(ev.target?.result as string); r.readAsDataURL(f);}}} className="hidden" accept="image/*" capture="environment" />
                    
                    <ModuleLandingPage 
                        icon={Camera} title="Provador Neural" 
                        description="Visualize sua estampa em modelos reais. Tire uma foto ou suba uma referência para encontrarmos a base branca ideal."
                        primaryActionLabel="Subir Referência" onPrimaryAction={() => fileInputRef.current?.click()}
                        features={["55+ Bases Brancas", "Segmentação Tática", "Physics Mapping"]}
                        customContent={
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg mt-8">
                                <button onClick={() => fileInputRef.current?.click()} className="bg-[#111] border border-white/10 p-6 rounded-3xl flex flex-col items-center gap-3 hover:bg-white/5 transition-all">
                                    <UploadCloud size={32} className="text-vingi-400"/>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Arquivos</span>
                                </button>
                                <button onClick={() => cameraInputRef.current?.click()} className="bg-vingi-600 border border-white/20 p-6 rounded-3xl flex flex-col items-center gap-3 hover:bg-vingi-500 transition-all shadow-xl shadow-vingi-900/50">
                                    <Camera size={32} className="text-white"/>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Câmera Mobile</span>
                                </button>
                            </div>
                        }
                    />
                </div>
            ) : step === 'SEARCH_BASE' ? (
                <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden">
                    <div className="h-14 bg-[#111] border-b border-white/5 flex items-center justify-between px-6">
                        <div className="flex items-center gap-3">
                            <ArrowLeft size={20} className="cursor-pointer text-gray-400 hover:text-white" onClick={() => setStep('INPUT')}/>
                            <span className="text-xs font-black uppercase tracking-widest text-vingi-400">Bases Brancas Detectadas ({whiteBases.length})</span>
                        </div>
                        <div className="text-[9px] font-bold text-gray-500 uppercase px-3 py-1 bg-white/5 rounded-full border border-white/10">DNA: {dnaAnalysis}</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 md:p-8">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {whiteBases.map((u, i) => (
                                <div key={i} onClick={() => initStudio(u)} className="aspect-[3/4] bg-white/5 rounded-2xl overflow-hidden cursor-pointer hover:ring-2 ring-vingi-500 transition-all shadow-2xl group relative">
                                    <img src={u} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"/>
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Zap size={32} className="text-white fill-white"/>
                                    </div>
                                    <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded-md text-[8px] font-black text-white backdrop-blur">BASE HIGH-CONTRAST</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col relative overflow-hidden bg-black">
                    <div className="h-14 bg-[#111] border-b border-white/5 px-4 flex items-center justify-between z-50">
                        <button onClick={() => setStep('SEARCH_BASE')} className="text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Estúdio de Prova</span>
                             <div className="w-1.5 h-1.5 bg-vingi-500 rounded-full animate-pulse"></div>
                        </div>
                        <button onClick={() => {if(canvasRef.current){const a=document.createElement('a'); a.download='vingi-runway.jpg'; a.href=canvasRef.current.toDataURL('image/jpeg',0.9); a.click();}}} className="bg-vingi-600 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest">Salvar Resultado</button>
                    </div>

                    <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden touch-none bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] bg-[size:30px_30px]" onPointerDown={handlePointerDown}>
                        <div className="relative shadow-2xl transition-transform duration-75 ease-out" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: baseImgObj?.width, height: baseImgObj?.height }}>
                            <canvas ref={canvasRef} className="block" />
                        </div>

                        {/* ESTAMPA ATIVA */}
                        {selectedPattern && (
                            <div className="absolute top-6 left-6 z-40">
                                <div className="w-14 h-14 bg-black rounded-2xl border-2 border-vingi-500/50 overflow-hidden shadow-2xl cursor-pointer hover:scale-110 transition-transform" onClick={() => patternInputRef.current?.click()}>
                                    <img src={selectedPattern} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"><RefreshCw size={14}/></div>
                                </div>
                            </div>
                        )}
                        
                        <input type="file" ref={patternInputRef} onChange={e => {const f=e.target.files?.[0]; if(f){const r=new FileReader(); r.onload=ev=>{setSelectedPattern(ev.target?.result as string); const pi=new Image(); pi.src=ev.target?.result as string; pi.onload=()=>setPatternImgObj(pi);}; r.readAsDataURL(f);}}} className="hidden" accept="image/*" />

                        {/* FERRAMENTAS FLUTUANTES */}
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 pointer-events-none z-50">
                            <div className="bg-[#111]/90 backdrop-blur-2xl border border-white/5 p-5 rounded-[2.5rem] pointer-events-auto shadow-2xl space-y-4">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[9px] font-black text-gray-500 uppercase tracking-widest"><span>Escala da Estampa</span><span>{Math.round(patternScale*100)}%</span></div>
                                    <input type="range" min="0.05" max="1.5" step="0.01" value={patternScale} onChange={e => setPatternScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-vingi-500 cursor-pointer"/>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                     <ToolBtn icon={Wand2} label="Pintar" active={activeTool==='WAND'} onClick={() => setActiveTool('WAND')} />
                                     <ToolBtn icon={Move3d} label="Offset" active={activeTool==='OFFSET'} onClick={() => setActiveTool('OFFSET')} />
                                     <ToolBtn icon={RefreshCw} label="Reset" onClick={() => {setPatternOffset({x:0,y:0}); setPatternRotation(0); setPatternScale(0.45);}} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-vingi-500 blur-[80px] opacity-30 animate-pulse rounded-full"></div>
                        <Loader2 size={64} className="text-vingi-400 animate-spin relative z-10" />
                    </div>
                    <p className="text-xl font-black uppercase tracking-[0.4em] text-white animate-pulse">{statusMessage}</p>
                    <p className="text-gray-500 text-[10px] uppercase font-bold mt-4 tracking-widest">Deep Search em andamento...</p>
                </div>
            )}
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick }: any) => (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center h-14 rounded-2xl gap-1 transition-all active:scale-95 ${active ? 'bg-white text-black shadow-lg' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
        <Icon size={18} strokeWidth={active ? 2.5 : 1.5} />
        <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
    </button>
);
