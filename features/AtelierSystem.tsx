
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Image as ImageIcon, Loader2, Sparkles, Layers, Grid3X3, Target, ArrowDownToLine, ArrowRightToLine, Check, Printer, Globe, X, ScanLine, Brush, Info, Search, Droplets, Shirt, Maximize2, RotateCcw, XCircle, StopCircle, Settings2, BoxSelect, Hand, MousePointerClick, Ruler } from 'lucide-react';
import { PantoneColor } from '../types';
import { SelvedgeTool, SelvedgePosition } from '../components/SelvedgeTool';

// --- COMPONENTE SMART VIEWER (ZOOM & PAN) ---
const SmartImageViewer: React.FC<{ src: string; alt?: string }> = ({ src, alt }) => {
    const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
    const [isPinching, setIsPinching] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Refs para gestos
    const lastDist = useRef<number>(0);
    const lastCenter = useRef<{x: number, y: number}>({x: 0, y: 0});
    const lastPos = useRef<{x: number, y: number}>({x: 0, y: 0});
    const isDragging = useRef(false);

    // Helpers de Touch
    const getDist = (t1: React.Touch, t2: React.Touch) => Math.sqrt((t1.clientX-t2.clientX)**2 + (t1.clientY-t2.clientY)**2);
    const getCenter = (t1: React.Touch, t2: React.Touch) => ({ x: (t1.clientX+t2.clientX)/2, y: (t1.clientY+t2.clientY)/2 });

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const scaleChange = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(0.5, transform.k + scaleChange), 5);
        setTransform(p => ({ ...p, k: newScale }));
    };

    const handlePointerDown = (e: React.TouchEvent | React.MouseEvent) => {
        if ('touches' in e && e.touches.length === 2) {
            setIsPinching(true);
            lastDist.current = getDist(e.touches[0], e.touches[1]);
            lastCenter.current = getCenter(e.touches[0], e.touches[1]);
        } else {
            isDragging.current = true;
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            lastPos.current = { x: clientX, y: clientY };
        }
    };

    const handlePointerMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (isPinching && 'touches' in e && e.touches.length === 2) {
            e.preventDefault(); // Evita scroll da pagina
            const dist = getDist(e.touches[0], e.touches[1]);
            const center = getCenter(e.touches[0], e.touches[1]);
            
            const zoomFactor = dist / lastDist.current;
            const newScale = Math.min(Math.max(transform.k * zoomFactor, 0.5), 5);
            
            const dx = center.x - lastCenter.current.x;
            const dy = center.y - lastCenter.current.y;

            setTransform(p => ({ k: newScale, x: p.x + dx, y: p.y + dy }));
            lastDist.current = dist;
            lastCenter.current = center;
        } else if (isDragging.current) {
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            
            const dx = clientX - lastPos.current.x;
            const dy = clientY - lastPos.current.y;
            
            setTransform(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
            lastPos.current = { x: clientX, y: clientY };
        }
    };

    const handlePointerUp = () => {
        isDragging.current = false;
        setIsPinching(false);
    };

    const reset = () => setTransform({ k: 1, x: 0, y: 0 });

    return (
        <div 
            ref={containerRef}
            className="w-full h-full overflow-hidden bg-gray-100 relative cursor-grab active:cursor-grabbing touch-none flex items-center justify-center shadow-inner"
            onWheel={handleWheel}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onDoubleClick={reset}
        >
            <div 
                style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`, transition: isDragging.current || isPinching ? 'none' : 'transform 0.2s ease-out' }}
                className="w-full h-full flex items-center justify-center"
            >
                <img src={src} alt={alt} className="max-w-full max-h-full object-contain shadow-lg" draggable={false} />
            </div>
            
            {/* Controles Flutuantes */}
            <div className="absolute bottom-4 right-4 flex gap-2 z-10">
                <button onClick={reset} className="bg-white/90 p-2 rounded-full shadow-lg text-gray-700 hover:text-vingi-600 backdrop-blur-sm">
                    <RotateCcw size={16}/>
                </button>
                <div className="bg-black/70 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm flex items-center">
                    {Math.round(transform.k * 100)}%
                </div>
            </div>
        </div>
    );
};

// --- TYPES & HELPERS ---
interface AtelierSystemProps {
    onNavigateToMockup?: () => void;
    onNavigateToLayerStudio?: () => void;
}

const DIMENSION_PRESETS = [
    { label: 'Amostra', w: 30, h: 30 },
    { label: 'Lenço', w: 90, h: 90 },
    { label: 'Metro', w: 140, h: 100 },
    { label: 'Pareô', w: 140, h: 180 },
];

const QUALITY_OPTIONS = [
    { id: 'DRAFT', label: 'Rascunho', dpi: 72, desc: 'Geração Rápida' },
    { id: 'PRINT', label: 'Estúdio', dpi: 150, desc: 'Alta Definição' },
    { id: 'ULTRA', label: 'Produção', dpi: 300, desc: 'Ultra 4K/8K' },
];

// Componente Pantone Melhorado
const PantoneCard: React.FC<{ color: PantoneColor | any }> = ({ color }) => {
    const handleSearch = () => {
        const query = `Pantone ${color.code} ${color.name} cotton swatch`;
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`, '_blank');
    };

    return (
        <div onClick={handleSearch} className="flex flex-col bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg hover:border-vingi-300 transition-all cursor-pointer group h-full hover:scale-[1.02]">
            <div className="h-8 w-full relative" style={{ backgroundColor: color.hex }}>
                 <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
            <div className="p-1.5 flex flex-col justify-between flex-1">
                <div>
                    <span className="block text-[8px] font-extrabold text-gray-900 leading-tight uppercase truncate" title={color.name}>{color.name}</span>
                    <span className="block text-[7px] text-gray-500 font-mono font-bold">{color.code || 'PENDING'}</span>
                </div>
            </div>
        </div>
    );
};

const GENERATION_STEPS = [
    "Inicializando Atelier Digital...",
    "Mapeando Cores da Referência...",
    "Definindo Estrutura do Layout...",
    "Aplicando Textura Vetorial...",
    "Ajustando Iluminação e Sombra...",
    "Finalizando Renderização 4K..."
];

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    // --- STATE ---
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [detectedColors, setDetectedColors] = useState<PantoneColor[]>([]);
    
    // Configurações
    const [layoutType, setLayoutType] = useState<'Corrida' | 'Barrada' | 'Localizada'>('Corrida');
    const [selvedgePos, setSelvedgePos] = useState<SelvedgePosition>('Inferior');
    const [widthCm, setWidthCm] = useState<number>(140);
    const [heightCm, setHeightCm] = useState<number>(100);
    const [qualityMode, setQualityMode] = useState<'DRAFT' | 'PRINT' | 'ULTRA'>('PRINT');
    const [userInstruction, setUserInstruction] = useState<string>('');
    const [prompt, setPrompt] = useState<string>('');

    // Interface State
    const [viewMode, setViewMode] = useState<'VIEW' | 'SELVEDGE'>('VIEW');
    const [isGenerating, setIsGenerating] = useState(false);
    const [genStep, setGenStep] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // --- EFFECTS ---
    useEffect(() => {
        const transferImage = localStorage.getItem('vingi_transfer_image');
        if (transferImage) {
            setReferenceImage(transferImage);
            localStorage.removeItem('vingi_transfer_image');
        }
    }, []);

    useEffect(() => {
        let interval: any;
        if (isGenerating) {
            setGenStep(0);
            interval = setInterval(() => { setGenStep(prev => (prev + 1) % GENERATION_STEPS.length); }, 1500);
        }
        return () => clearInterval(interval);
    }, [isGenerating]);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, []);

    // --- HANDLERS ---
    const handleCancelGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsGenerating(false);
        setError("Geração interrompida pelo usuário.");
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setReferenceImage(ev.target?.result as string);
                setGeneratedPattern(null);
                setDetectedColors([]);
                setError(null);
                setViewMode('VIEW'); // Reset view mode
            };
            reader.readAsDataURL(file);
        }
    };

    const applyPreset = (w: number, h: number) => {
        setWidthCm(w);
        setHeightCm(h);
    };

    const handleGenerate = async () => {
        if (!referenceImage) return;
        
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsGenerating(true);
        setError(null);

        // Define DPI based on quality mode
        const targetDpi = qualityMode === 'ULTRA' ? 300 : (qualityMode === 'PRINT' ? 150 : 72);

        try {
            const compressedBase64 = referenceImage.split(',')[1];
            
            // 1. ANÁLISE
            const analysisRes = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'DESCRIBE_PATTERN',
                    mainImageBase64: compressedBase64,
                    mainMimeType: 'image/jpeg'
                }),
                signal: controller.signal
            });
            const analysisData = await analysisRes.json();
            
            if (!analysisData.success) throw new Error("Falha na análise inicial da imagem.");
            
            const autoPrompt = analysisData.prompt;
            const autoColors = analysisData.colors || [];
            
            setDetectedColors(autoColors);
            setPrompt(autoPrompt);

            // 2. GERAÇÃO
            const finalPrompt = userInstruction 
            ? `${userInstruction}. Based on: ${autoPrompt}`
            : autoPrompt;

            const genRes = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: finalPrompt,
                    colors: autoColors,
                    textileSpecs: {
                        layout: layoutType,
                        selvedge: selvedgePos,
                        width: widthCm,
                        height: heightCm,
                        dpi: targetDpi,
                        styleGuide: qualityMode === 'ULTRA' ? 'Ultra-High Definition Vector Art' : 'High quality textile print'
                    }
                }),
                signal: controller.signal
            });

            const genData = await genRes.json();
            if (genData.success && genData.image) {
                setGeneratedPattern(genData.image);
            } else {
                throw new Error(genData.error || "Erro na geração.");
            }

        } catch (err: any) {
            if (err.name === 'AbortError') {
                setError(null);
            } else {
                setError(err.message || "Ocorreu um erro no processo criativo.");
            }
        } finally {
            if (abortControllerRef.current === controller) {
                setIsGenerating(false);
                abortControllerRef.current = null;
            }
        }
    };

    const triggerDownload = (url: string) => {
        const link = document.createElement('a');
        link.download = `vingi-atelier-${layoutType.toLowerCase()}-${widthCm}x${heightCm}cm-${qualityMode}.jpg`;
        link.href = url;
        link.click();
    };

    const handleDownload = () => {
        if (!generatedPattern) return;
        triggerDownload(generatedPattern);
    };

    // --- RENDER ---
    return (
        <div className="h-full bg-[#f8fafc] overflow-hidden flex flex-col">
             {/* Header Compacto */}
             <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 z-30 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="bg-vingi-900 p-1.5 rounded-lg text-white"><Brush size={16}/></div>
                    <div>
                        <h1 className="text-sm font-bold text-gray-900 leading-tight">Atelier de Criação</h1>
                    </div>
                </div>
                {referenceImage && !isGenerating && (
                    <button onClick={() => { setReferenceImage(null); setGeneratedPattern(null); fileInputRef.current!.value = ''; }} className="text-xs font-bold text-gray-500 hover:text-red-500 flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md">
                        <X size={12}/> Reset
                    </button>
                )}
            </header>

            {!referenceImage ? (
                <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 max-w-xl w-full text-center">
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Atelier Generativo</h2>
                        <p className="text-gray-500 text-sm">
                            Crie estampas exclusivas do zero. Carregue um desenho ou imagem de referência e a IA gerará um arquivo de alta resolução.
                        </p>
                    </div>

                    <div onClick={() => fileInputRef.current?.click()} className="w-full max-w-xl h-64 bg-white rounded-3xl border-2 border-dashed border-gray-300 hover:border-vingi-500 hover:bg-vingi-50/30 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group shadow-sm hover:shadow-xl">
                         <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" />
                         <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                             <UploadCloud size={28} className="text-gray-400 group-hover:text-vingi-500"/>
                         </div>
                         <div className="text-center px-4">
                             <h3 className="text-lg font-bold text-gray-700">Carregar Referência</h3>
                             <p className="text-xs text-gray-400 mt-1">A IA extrairá cores e estilo.</p>
                         </div>
                    </div>
                </div>
            ) : (
                // LAYOUT PRINCIPAL: MOBILE VERTICAL (ARTE NO TOPO), DESKTOP LADO A LADO
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                    
                    {/* ÁREA DE VISUALIZAÇÃO (ARTE) - TOPO NO MOBILE, DIREITA NO DESKTOP */}
                    <div className="order-1 lg:order-2 flex-1 lg:h-full bg-slate-900 relative min-h-[40vh] lg:min-h-0 flex flex-col group">
                        {isGenerating ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-20">
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,100,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,100,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                                <div className="absolute top-0 left-0 w-full h-2 bg-vingi-400 shadow-[0_0_30px_rgba(96,165,250,1)] animate-scan z-10 opacity-80"></div>
                                
                                <Loader2 size={48} className="text-vingi-500 animate-spin mb-6 relative z-20"/>
                                <h3 className="text-xl font-bold text-white relative z-20 tracking-tight animate-pulse">{GENERATION_STEPS[genStep]}</h3>
                                <p className="text-slate-400 mt-2 relative z-20 text-xs mb-8">Processando {widthCm}x{heightCm}cm</p>
                                
                                <button onClick={handleCancelGeneration} className="relative z-30 px-6 py-2 bg-red-500/20 border border-red-500 text-red-100 rounded-full text-xs font-bold hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 backdrop-blur-md">
                                    <StopCircle size={14}/> PARAR GERAÇÃO
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* VIEW MODE TOGGLE (Floating on Image) */}
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex bg-black/60 backdrop-blur-md rounded-full p-1 border border-white/10 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <button 
                                        onClick={() => setViewMode('VIEW')} 
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all ${viewMode === 'VIEW' ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                                    >
                                        <Hand size={12}/> Zoom
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('SELVEDGE')} 
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all ${viewMode === 'SELVEDGE' ? 'bg-vingi-500 text-white' : 'text-white hover:bg-white/10'}`}
                                    >
                                        <ArrowDownToLine size={12}/> Definir Ourela
                                    </button>
                                </div>

                                {/* RENDER AREA */}
                                <div className="w-full h-full relative">
                                    {viewMode === 'VIEW' ? (
                                        <SmartImageViewer src={generatedPattern || referenceImage!} />
                                    ) : (
                                        <div className="w-full h-full p-4 flex items-center justify-center bg-gray-900/90 backdrop-blur-sm">
                                            <div className="w-full max-w-md bg-white p-2 rounded-xl shadow-2xl">
                                                <SelvedgeTool 
                                                    image={generatedPattern || referenceImage!} 
                                                    selectedPos={selvedgePos} 
                                                    onSelect={setSelvedgePos} 
                                                    active={true}
                                                />
                                                <div className="text-center p-2">
                                                    <p className="text-[10px] text-gray-500">Clique na borda da imagem para definir o sentido do fio/ourela.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {error && (
                            <div className="absolute bottom-4 left-4 right-4 bg-red-500/90 text-white p-3 rounded-lg text-xs font-bold flex items-center gap-2 backdrop-blur-md animate-fade-in shadow-xl z-20">
                                <Info size={14}/> {error}
                            </div>
                        )}
                    </div>

                    {/* ÁREA DE CONTROLES - ABAIXO NO MOBILE, ESQUERDA NO DESKTOP */}
                    <div className="order-2 lg:order-1 w-full lg:w-[400px] h-[60vh] lg:h-full bg-white border-t lg:border-t-0 lg:border-r border-gray-200 shadow-2xl z-20 overflow-y-auto custom-scrollbar flex flex-col">
                        <div className="p-6 space-y-8 pb-24">
                            
                            {/* Actions se já gerou */}
                            {generatedPattern && (
                                <div className="grid grid-cols-2 gap-2 animate-fade-in">
                                    <button onClick={handleDownload} className="bg-gray-900 text-white py-3 rounded-xl font-bold shadow hover:bg-black transition-transform flex items-center justify-center gap-2 text-xs">
                                        <Download size={14}/> BAIXAR ARQUIVO
                                    </button>
                                    {onNavigateToMockup && (
                                        <button onClick={onNavigateToMockup} className="bg-vingi-500 text-white py-3 rounded-xl font-bold shadow hover:bg-vingi-600 transition-transform flex items-center justify-center gap-2 text-xs">
                                            <Shirt size={14}/> PROVAR AGORA
                                        </button>
                                    )}
                                    {onNavigateToLayerStudio && (
                                        <button onClick={onNavigateToLayerStudio} className="col-span-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-300 py-3 rounded-xl font-bold shadow hover:bg-gray-200 transition-transform flex items-center justify-center gap-2 text-xs">
                                            <Layers size={14}/> SEPARAR CAMADAS (IA)
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* SECTION: DIMENSÕES & RESOLUÇÃO */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 border-b border-gray-100 pb-2">
                                    <Settings2 size={16} className="text-vingi-500"/> Especificações
                                </h3>

                                {/* Presets Rápidos */}
                                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                    {DIMENSION_PRESETS.map((p, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => applyPreset(p.w, p.h)}
                                            className="px-3 py-1.5 bg-gray-50 hover:bg-vingi-50 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600 whitespace-nowrap transition-colors"
                                        >
                                            {p.label} <span className="text-gray-400">({p.w}x{p.h})</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Inputs Manuais */}
                                <div className="flex gap-3">
                                     <div className="flex-1 bg-white border border-gray-200 rounded px-2 py-1.5 flex items-center focus-within:border-vingi-500 transition-colors">
                                         <span className="text-[10px] text-gray-400 mr-2 font-bold w-4">L</span>
                                         <input type="number" value={widthCm} onChange={e => setWidthCm(Number(e.target.value))} className="w-full text-sm font-bold outline-none text-gray-800"/>
                                         <span className="text-[9px] text-gray-400">cm</span>
                                     </div>
                                     <div className="flex-1 bg-white border border-gray-200 rounded px-2 py-1.5 flex items-center focus-within:border-vingi-500 transition-colors">
                                         <span className="text-[10px] text-gray-400 mr-2 font-bold w-4">A</span>
                                         <input type="number" value={heightCm} onChange={e => setHeightCm(Number(e.target.value))} className="w-full text-sm font-bold outline-none text-gray-800"/>
                                         <span className="text-[9px] text-gray-400">cm</span>
                                     </div>
                                </div>

                                {/* Resolução */}
                                <div className="grid grid-cols-3 gap-2">
                                    {QUALITY_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setQualityMode(opt.id as any)}
                                            className={`py-2 rounded-lg border text-center transition-all ${qualityMode === opt.id ? 'bg-vingi-50 border-vingi-500 text-vingi-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                        >
                                            <div className="text-[10px] font-bold uppercase">{opt.label}</div>
                                            <div className="text-[9px] opacity-70">{opt.dpi} DPI</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* SECTION: ESTRUTURA */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 border-b border-gray-100 pb-2">
                                    <Target size={16} className="text-vingi-500"/> Layout
                                </h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => setLayoutType('Corrida')} className={`py-2 rounded-lg border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${layoutType === 'Corrida' ? 'bg-vingi-50 text-vingi-700 border-vingi-500' : 'bg-white text-gray-500 border-gray-200'}`}>
                                        <Grid3X3 size={14}/> CORRIDA
                                    </button>
                                    <button onClick={() => setLayoutType('Barrada')} className={`py-2 rounded-lg border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${layoutType === 'Barrada' ? 'bg-vingi-50 text-vingi-700 border-vingi-500' : 'bg-white text-gray-500 border-gray-200'}`}>
                                        <ArrowDownToLine size={14}/> BARRADA
                                    </button>
                                    <button onClick={() => setLayoutType('Localizada')} className={`py-2 rounded-lg border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${layoutType === 'Localizada' ? 'bg-vingi-50 text-vingi-700 border-vingi-500' : 'bg-white text-gray-500 border-gray-200'}`}>
                                        <BoxSelect size={14}/> LOCAL
                                    </button>
                                </div>
                            </div>

                            {/* SECTION: CRIATIVO */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 border-b border-gray-100 pb-2">
                                    <Sparkles size={16} className="text-vingi-500"/> Direção Criativa
                                </h3>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase">Instruções para a IA</label>
                                    <textarea 
                                        value={userInstruction} 
                                        onChange={e => setUserInstruction(e.target.value)} 
                                        placeholder="Ex: Quero um fundo azul marinho, flores menores e traço de aquarela..."
                                        className="w-full h-24 p-3 bg-white border border-gray-200 rounded-xl text-xs resize-none focus:border-vingi-500 outline-none transition-colors shadow-sm"
                                    />
                                </div>

                                {/* Paleta (Somente Leitura/Visualização) */}
                                {detectedColors.length > 0 && (
                                    <div>
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">Paleta Detectada</h4>
                                        <div className="grid grid-cols-4 gap-2">
                                            {detectedColors.slice(0, 4).map((c, i) => <PantoneCard key={i} color={c} />)}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {!isGenerating && (
                                <button 
                                    onClick={handleGenerate}
                                    className="w-full py-4 bg-vingi-900 text-white rounded-xl font-bold shadow-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 text-sm"
                                >
                                    <Wand2 size={18} className="text-purple-300"/>
                                    {generatedPattern ? 'REFINAR / GERAR NOVAMENTE' : 'CRIAR ESTAMPA'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
