
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Image as ImageIcon, Loader2, Sparkles, Layers, Grid3X3, Target, Globe, Move, ZoomIn, Minimize2, Plus, TrendingUp, Brush, Leaf, Droplets, ShoppingBag, Share2, Ruler, Scissors, ArrowDownToLine, ArrowRightToLine, LayoutTemplate, History as HistoryIcon, Trash2, Settings2, Check, Printer, Search, RefreshCw, XCircle, ScanLine, AlertCircle, Info, RotateCcw } from 'lucide-react';
import { PantoneColor, ExternalPatternMatch } from '../types';
import { PatternVisualCard } from './PatternVisualCard';
import { ModuleLandingPage } from './Shared';

// --- COMPONENTE SMART VIEWER REUTILIZADO ---
const SmartImageViewer: React.FC<{ src: string }> = ({ src }) => {
    const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
    const [isPinching, setIsPinching] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastDist = useRef<number>(0);
    const lastPos = useRef<{x: number, y: number}>({x: 0, y: 0});
    const isDragging = useRef(false);

    const getDist = (t1: React.Touch, t2: React.Touch) => Math.sqrt((t1.clientX-t2.clientX)**2 + (t1.clientY-t2.clientY)**2);

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
        } else {
            isDragging.current = true;
            const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            lastPos.current = { x: cx, y: cy };
        }
    };

    const handlePointerMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (isPinching && 'touches' in e && e.touches.length === 2) {
            e.preventDefault();
            const dist = getDist(e.touches[0], e.touches[1]);
            const zoomFactor = dist / lastDist.current;
            const newScale = Math.min(Math.max(transform.k * zoomFactor, 0.5), 5);
            setTransform(p => ({ ...p, k: newScale }));
            lastDist.current = dist;
        } else if (isDragging.current) {
            const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            const dx = cx - lastPos.current.x;
            const dy = cy - lastPos.current.y;
            setTransform(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
            lastPos.current = { x: cx, y: cy };
        }
    };

    const handlePointerUp = () => { isDragging.current = false; setIsPinching(false); };
    const reset = () => setTransform({ k: 1, x: 0, y: 0 });

    return (
        <div 
            ref={containerRef}
            className="w-full h-full overflow-hidden bg-gray-50 relative cursor-grab active:cursor-grabbing touch-none flex items-center justify-center rounded-xl border border-gray-200"
            onWheel={handleWheel}
            onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}
            onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
            onDoubleClick={reset}
        >
            <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`, transition: isDragging.current || isPinching ? 'none' : 'transform 0.2s' }} className="w-full h-full flex items-center justify-center">
                <img src={src} className="max-w-full max-h-full object-contain" draggable={false} />
            </div>
            <button onClick={reset} className="absolute bottom-2 right-2 bg-white/80 p-1.5 rounded-full shadow-sm text-gray-600"><RotateCcw size={12}/></button>
        </div>
    );
};

// --- COMPONENTE MODAL FLUTUANTE DE COMPARAÇÃO ---
const FloatingComparisonModal: React.FC<{ image: string }> = ({ image }) => {
    const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 300 }); 
    const [size, setSize] = useState(180);
    const [isMinimized, setIsMinimized] = useState(false);
    
    const dragOffset = useRef({ x: 0, y: 0 });
    const isDragging = useRef(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        isDragging.current = true;
        dragOffset.current = { 
            x: e.clientX - position.x, 
            y: e.clientY - position.y 
        };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;
        setPosition({
            x: Math.max(0, Math.min(newX, window.innerWidth - size)),
            y: Math.max(0, Math.min(newY, window.innerHeight - 50))
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    if (isMinimized) {
        return (
            <div 
                className="fixed bottom-24 right-4 bg-vingi-900 text-white p-3 rounded-full shadow-2xl z-[100] cursor-pointer hover:scale-110 transition-transform animate-bounce-subtle"
                onClick={() => setIsMinimized(false)}
                title="Expandir Referência"
            >
                <ImageIcon size={24} />
            </div>
        );
    }

    return (
        <div 
            className="fixed z-[90] bg-white rounded-xl shadow-2xl border-2 border-vingi-500 overflow-hidden flex flex-col transition-shadow shadow-md"
            style={{ 
                left: position.x, 
                top: position.y, 
                width: size,
                touchAction: 'none' 
            }}
        >
            <div 
                className="bg-vingi-900 h-9 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing select-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <span className="text-[10px] font-bold text-white flex items-center gap-1 uppercase tracking-wider"><Move size={10}/> Ref</span>
                <div 
                    className="flex items-center gap-1" 
                    onPointerDown={(e) => e.stopPropagation()} 
                >
                    <button onClick={() => setSize(s => Math.min(400, s + 30))} className="text-white/70 hover:text-white"><ZoomIn size={12}/></button>
                    <button onClick={() => setIsMinimized(true)} className="text-white/70 hover:text-white"><Minimize2 size={12}/></button>
                </div>
            </div>
            <div className="relative bg-gray-100 group">
                <img src={image} className="w-full object-contain bg-white pointer-events-none select-none" style={{ maxHeight: size * 1.5 }} />
            </div>
        </div>
    );
};

// --- CONSTANTES ---
const LOADING_STEPS = [
    "Inicializando Visão Computacional...",
    "Isolando Motivos da Textura...",
    "Extraindo Paleta Pantone (TCX)...",
    "Detectando Padrão de Repetição...",
    "Varrendo Bancos de Imagem Globais...",
    "Classificando Por Similaridade...",
    "Finalizando Curadoria..."
];

interface PatternCreatorProps {
    onNavigateToAtelier: () => void;
}

const compressImage = (base64Str: string | null, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!base64Str) { reject(new Error("Imagem vazia")); return; }
        const img = new Image(); img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.drawImage(img, 0, 0, w, h); resolve(canvas.toDataURL('image/jpeg', 0.8)); }
            else reject(new Error("Canvas error"));
        };
        img.onerror = () => reject(new Error("Load error"));
    });
};

const ExternalSearchButton = ({ name, url, colorClass, icon: Icon }: any) => (
    <a href={url} target="_blank" className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-white transition-transform hover:scale-105 ${colorClass}`}>
        <Icon size={12} /> {name}
    </a>
);

const SpecBadge: React.FC<{ icon: any, label: string, value: string }> = ({ icon: Icon, label, value }) => (
    <div className="bg-white border border-gray-100 rounded-lg p-2 flex items-center gap-2 shadow-sm min-w-[100px]">
        <div className="p-1.5 bg-gray-50 rounded-full text-vingi-500">
            <Icon size={12} />
        </div>
        <div>
            <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
            <span className="block text-[10px] font-bold text-gray-800 capitalize line-clamp-1">{value || "N/A"}</span>
        </div>
    </div>
);

export const PatternCreator: React.FC<PatternCreatorProps> = ({ onNavigateToAtelier }) => {
    // --- STATES ---
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [detectedColors, setDetectedColors] = useState<PantoneColor[]>([]);
    const [fabricMatches, setFabricMatches] = useState<ExternalPatternMatch[]>([]);
    const [visibleMatchesCount, setVisibleMatchesCount] = useState(10); 
    const [technicalSpecs, setTechnicalSpecs] = useState<any>(null);
    const [genError, setGenError] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0); 
    const [history, setHistory] = useState<{id: string, imageUrl: string}[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- EFFECT: LOADING STEPS ANIMATION ---
    useEffect(() => {
        let interval: any;
        if (isAnalyzing) {
            setLoadingStep(0);
            interval = setInterval(() => { setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length); }, 1200);
        }
        return () => clearInterval(interval);
    }, [isAnalyzing]);

    // --- HANDLERS ---
    const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const res = ev.target?.result as string;
                if (res) {
                    setReferenceImage(res);
                    setFabricMatches([]); setDetectedColors([]); setTechnicalSpecs(null); setPrompt(''); setGenError(null);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleStartAnalysis = async () => {
        if (!referenceImage) return;
        setIsAnalyzing(true);
        setGenError(null);
        try {
            const compressedBase64 = await compressImage(referenceImage);
            const data = compressedBase64.split(',')[1];
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'DESCRIBE_PATTERN', mainImageBase64: data, mainMimeType: 'image/jpeg' })
            });
            if (!response.ok) throw new Error("API Error");
            const resData = await response.json();
            if (resData.success) {
                setPrompt(resData.prompt || '');
                setDetectedColors(Array.isArray(resData.colors) ? resData.colors : []);
                setFabricMatches(Array.isArray(resData.stockMatches) ? resData.stockMatches : []);
                setTechnicalSpecs(resData.technicalSpecs || null);
                setHistory(prev => [{ id: Date.now().toString(), imageUrl: referenceImage }, ...prev].slice(0, 10));
            }
        } catch (error) {
            setGenError("Não foi possível analisar a textura. Tente outra imagem.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleTransferToAtelier = () => {
        if (referenceImage) localStorage.setItem('vingi_transfer_image', referenceImage);
        onNavigateToAtelier();
    };

    const uniqueMatches = fabricMatches.filter((match, index, self) => index === self.findIndex((m) => (m.url === match.url)));
    const visibleData = uniqueMatches.slice(0, visibleMatchesCount);
    const hasResults = uniqueMatches.length > 0 || technicalSpecs;

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto overflow-x-hidden relative custom-scrollbar">
            {/* COMPARISON MODAL */}
            {referenceImage && !isAnalyzing && (
                <FloatingComparisonModal image={referenceImage} />
            )}

            {/* HEADER */}
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm shrink-0">
                <div className="flex items-center gap-2 md:hidden">
                    <div className="bg-vingi-900 p-2 rounded-lg text-white shadow-md">
                        <Globe size={18} />
                    </div>
                </div>
                
                {/* Centralized Title */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <div className="hidden md:flex items-center gap-2 justify-center mb-0.5">
                        <div className="bg-vingi-900 p-1.5 rounded text-white shadow-sm">
                            <Globe size={14}/>
                        </div>
                        <h2 className="text-sm font-bold text-gray-900 leading-tight uppercase tracking-wide">Pattern Search</h2>
                    </div>
                    <h2 className="md:hidden text-sm font-bold text-gray-900 leading-tight uppercase tracking-wide">Pattern Search</h2>
                    <p className="text-[10px] text-gray-500 font-medium hidden md:block">Buscador Global de Estampas</p>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    {referenceImage && !isAnalyzing && (
                        <button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-vingi-600 bg-vingi-50 px-3 py-1.5 rounded-lg hover:bg-vingi-100 flex items-center gap-2">
                            <RefreshCw size={12}/> <span className="hidden md:inline">Nova Imagem</span>
                        </button>
                    )}
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 p-4 md:p-8 max-w-[1800px] mx-auto w-full">
                <input type="file" ref={fileInputRef} onChange={handleReferenceUpload} accept="image/*" className="hidden" />
                
                {/* 1. UPLOAD (VAZIO) - USING UNIFIED LANDING PAGE */}
                {!referenceImage && (
                    <ModuleLandingPage 
                        icon={Globe}
                        title="Scanner de Estampas"
                        description="Encontre fornecedores globais para qualquer textura ou estampa. A IA identifica o padrão e busca arquivos digitais para compra em bancos de imagem e estúdios."
                        primaryActionLabel="Carregar Amostra"
                        onPrimaryAction={() => fileInputRef.current?.click()}
                        features={["Shutterstock", "Patternbank", "Adobe Stock", "Spoonflower"]}
                        secondaryAction={
                            <div className="h-full flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-2 h-2 rounded-full bg-vingi-500"></span>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dica Profissional</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-left">
                                        <h4 className="text-sm font-bold text-gray-800 mb-1">Busca Visual</h4>
                                        <p className="text-xs text-gray-500">Use fotos de roupas, tecidos ou papel de parede. A IA isola o motivo.</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-left">
                                        <h4 className="text-sm font-bold text-gray-800 mb-1">Paleta Pantone</h4>
                                        <p className="text-xs text-gray-500">O sistema extrai automaticamente os códigos TCX das cores dominantes.</p>
                                    </div>
                                </div>
                            </div>
                        }
                    />
                )}

                {/* 2. FLUXO PRINCIPAL (COM IMAGEM) */}
                {referenceImage && (
                    <div className="w-full space-y-8">
                        
                        {/* 2.1 ESTADO SCANNING */}
                        {isAnalyzing && (
                             <div className="flex flex-col items-center justify-center h-[50vh] animate-fade-in">
                                <div className="relative w-48 h-64 rounded-2xl overflow-hidden shadow-2xl border-4 border-white ring-1 ring-slate-200 bg-slate-900">
                                    <img src={referenceImage} className="w-full h-full object-cover opacity-60 blur-[2px]" />
                                    <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,100,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,100,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                                    <div className="absolute top-0 left-0 w-full h-2 bg-vingi-400 shadow-[0_0_20px_rgba(96,165,250,1),0_0_10px_rgba(255,255,255,0.8)] animate-scan z-30 opacity-90"></div>
                                </div>
                                <div className="mt-6 text-center max-w-xs mx-auto">
                                    <h3 className="text-sm font-bold text-gray-800 tracking-tight animate-pulse">{LOADING_STEPS[loadingStep]}</h3>
                                    <div className="flex justify-center items-center gap-2 text-vingi-500 font-mono text-[10px] mt-2 uppercase tracking-widest bg-white px-3 py-1 rounded-full inline-block border border-vingi-100">
                                        <Loader2 size={10} className="animate-spin inline mr-1"/> Processando...
                                    </div>
                                </div>
                             </div>
                        )}

                        {/* 2.2 ESTADO PRONTO (PRÉ-PESQUISA) */}
                        {!isAnalyzing && !hasResults && !genError && (
                             <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in gap-6">
                                 <div className="w-48 h-48 rounded-2xl shadow-lg border-4 border-white overflow-hidden relative">
                                     <SmartImageViewer src={referenceImage} />
                                 </div>
                                 <div className="text-center space-y-4">
                                     <button onClick={handleStartAnalysis} className="px-8 py-4 bg-vingi-900 text-white rounded-full font-bold shadow-xl hover:scale-105 transition-all flex items-center gap-2 text-sm animate-bounce-subtle mx-auto">
                                        <ScanLine size={18} className="text-vingi-400"/> PESQUISAR ESTAMPAS
                                     </button>
                                     <p className="text-xs text-gray-400">A IA irá escanear bancos globais.</p>
                                 </div>
                             </div>
                        )}

                        {/* 2.3 ESTADO DE ERRO */}
                        {genError && (
                             <div className="flex flex-col items-center justify-center h-[30vh] animate-fade-in text-center">
                                 <AlertCircle size={32} className="text-red-500 mb-2"/>
                                 <p className="text-gray-600 font-bold text-sm mb-4">{genError}</p>
                                 <button onClick={handleStartAnalysis} className="px-4 py-2 bg-vingi-900 text-white rounded-lg font-bold text-xs">Tentar Novamente</button>
                             </div>
                        )}

                        {/* 2.4 DASHBOARD DE RESULTADOS (LAYOUT VERTICAL MOBILE, ROW DESKTOP) */}
                        {!isAnalyzing && hasResults && (
                            <div className="animate-fade-in flex flex-col lg:flex-row gap-8">
                                
                                {/* COLUNA ESQUERDA: REFERÊNCIA (AGORA COM ZOOM) */}
                                <div className="w-full lg:w-80 shrink-0">
                                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 sticky top-20">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Referência</h4>
                                        <div className="aspect-square rounded-xl overflow-hidden relative group border border-gray-100 bg-gray-50 h-64 lg:h-auto">
                                            <SmartImageViewer src={referenceImage} />
                                        </div>
                                        {technicalSpecs && (
                                            <div className="mt-4 space-y-2">
                                                <SpecBadge icon={Brush} label="Estilo" value={technicalSpecs.technique} />
                                                <SpecBadge icon={Leaf} label="Motivo" value={technicalSpecs.motifs?.[0]} />
                                            </div>
                                        )}
                                        {/* CTA Transferência */}
                                        <div className="mt-6 pt-4 border-t border-gray-100">
                                             <button onClick={handleTransferToAtelier} className="w-full py-3 bg-vingi-50 text-vingi-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-vingi-100 transition-colors">
                                                 <Wand2 size={14}/> CRIAR VARIAÇÃO (ATELIER)
                                             </button>
                                        </div>
                                    </div>
                                </div>

                                {/* COLUNA DIREITA: RESULTADOS */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                            <Globe className="text-vingi-600" size={18}/> Dept. Mercado Global
                                        </h3>
                                    </div>
                                    
                                    {uniqueMatches.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 animate-fade-in">
                                            {visibleData.map((match, i) => (
                                                <PatternVisualCard key={i} match={match} userReferenceImage={referenceImage} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-center text-gray-400">
                                            <Search size={32} className="mx-auto mb-2 opacity-20"/>
                                            <p className="text-sm">Nenhum padrão exato encontrado.</p>
                                        </div>
                                    )}
                                    
                                    <div className="mt-6 bg-white p-4 rounded-xl border border-gray-200">
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-3">Pesquisa Externa</h4>
                                        <div className="flex gap-2 flex-wrap">
                                            <ExternalSearchButton name="Google" url={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(prompt)}`} colorClass="bg-blue-600" icon={Globe} />
                                            <ExternalSearchButton name="Pinterest" url={`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(prompt)}`} colorClass="bg-red-600" icon={Share2} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
