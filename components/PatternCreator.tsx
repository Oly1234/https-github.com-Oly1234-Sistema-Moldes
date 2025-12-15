
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Image as ImageIcon, Loader2, Sparkles, Layers, Grid3X3, Target, Globe, Move, ZoomIn, Minimize2, Plus, TrendingUp, Brush, Leaf, Droplets, ShoppingBag, Share2, Ruler, Scissors, ArrowDownToLine, ArrowRightToLine, LayoutTemplate, History as HistoryIcon, Trash2, Settings2, Check, Printer, Search, RefreshCw, XCircle, ScanLine, AlertCircle, Info } from 'lucide-react';
import { PantoneColor, ExternalPatternMatch } from '../types';
import { PatternVisualCard } from './PatternVisualCard';

// --- CONSTANTES LOCAIS DE ANIMAÇÃO ---
const LOADING_STEPS = [
    "Inicializando Visão Computacional...",
    "Isolando Motivos da Textura...",
    "Extraindo Paleta Pantone (TCX)...",
    "Detectando Padrão de Repetição...",
    "Varrendo Bancos de Imagem Globais...",
    "Classificando Por Similaridade...",
    "Finalizando Curadoria..."
];

// --- TYPES LOCAL ---
interface PatternCreatorProps {
    onNavigateToAtelier: () => void;
}

// Modal Flutuante para Comparação (Miniatura)
const FloatingComparisonModal: React.FC<{ image: string }> = ({ image }) => {
    const [position, setPosition] = useState({ x: window.innerWidth - 120, y: 100 }); 
    const [size, setSize] = useState(100);
    const [isMinimized, setIsMinimized] = useState(false);
    
    const dragOffset = useRef({ x: 0, y: 0 });
    const isDragging = useRef(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        isDragging.current = true;
        dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        setPosition({
            x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - size)),
            y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 50))
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    if (isMinimized) {
        return (
            <div className="fixed top-24 right-4 bg-vingi-900 text-white p-2 rounded-full shadow-2xl z-[100] cursor-pointer hover:scale-110 transition-transform" onClick={() => setIsMinimized(false)}>
                <ImageIcon size={20} />
            </div>
        );
    }

    return (
        <div 
            className="fixed z-[90] bg-white rounded-lg shadow-xl border-2 border-vingi-500 overflow-hidden flex flex-col transition-shadow shadow-md"
            style={{ left: position.x, top: position.y, width: size, touchAction: 'none' }}
        >
            <div 
                className="bg-vingi-900 h-6 flex items-center justify-between px-1 cursor-grab active:cursor-grabbing select-none"
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
            >
                <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                     <button onClick={() => setSize(s => Math.min(300, s + 50))} className="text-white/70 hover:text-white"><ZoomIn size={10}/></button>
                     <button onClick={() => setIsMinimized(true)} className="text-white/70 hover:text-white"><Minimize2 size={10}/></button>
                </div>
            </div>
            <img src={image} className="w-full object-contain bg-white pointer-events-none select-none" />
        </div>
    );
};

const compressImage = (base64Str: string | null, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!base64Str) { reject(new Error("Imagem vazia")); return; }
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL('image/jpeg', 0.8)); }
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
    
    // Resultados
    const [fabricMatches, setFabricMatches] = useState<ExternalPatternMatch[]>([]);
    const [visibleMatchesCount, setVisibleMatchesCount] = useState(10); 
    const [technicalSpecs, setTechnicalSpecs] = useState<any>(null);
    
    // Status UI
    const [genError, setGenError] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0); 
    
    // Histórico Local da Sessão
    const [history, setHistory] = useState<{id: string, imageUrl: string}[]>([]);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- EFFECT: LOADING STEPS ANIMATION ---
    useEffect(() => {
        let interval: any;
        if (isAnalyzing) {
            setLoadingStep(0);
            interval = setInterval(() => {
                setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length);
            }, 1200);
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
                    // Reset Geral
                    setFabricMatches([]);
                    setDetectedColors([]);
                    setTechnicalSpecs(null);
                    setPrompt('');
                    setGenError(null);
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
            const parts = compressedBase64.split(',');
            const data = parts[1];
            const mimeType = 'image/jpeg'; 
            
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'DESCRIBE_PATTERN',
                    mainImageBase64: data,
                    mainMimeType: mimeType
                })
            });
            
            if (!response.ok) throw new Error("API Error");
            const resData = await response.json();
            
            if (resData.success) {
                setPrompt(resData.prompt || '');
                setDetectedColors(Array.isArray(resData.colors) ? resData.colors : []);
                setFabricMatches(Array.isArray(resData.stockMatches) ? resData.stockMatches : []);
                setTechnicalSpecs(resData.technicalSpecs || null);

                // Adiciona ao histórico
                setHistory(prev => {
                    // Evita duplicatas exatas consecutivas se necessário, mas aqui simples append é ok
                    return [{ id: Date.now().toString(), imageUrl: referenceImage }, ...prev].slice(0, 10);
                });
            }
        } catch (error) {
            setGenError("Não foi possível analisar a textura. Tente outra imagem.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleTransferToAtelier = () => {
        if (referenceImage) {
            localStorage.setItem('vingi_transfer_image', referenceImage);
        }
        onNavigateToAtelier();
    };

    const uniqueMatches = fabricMatches.filter((match, index, self) =>
        index === self.findIndex((m) => (m.url === match.url))
    );
    const visibleData = uniqueMatches.slice(0, visibleMatchesCount);

    // Helpers de Renderização Condicional
    const hasResults = uniqueMatches.length > 0 || technicalSpecs;

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto overflow-x-hidden relative custom-scrollbar">
            {/* Modal de Comparação (Sempre disponível se houver resultados) */}
            {referenceImage && hasResults && <FloatingComparisonModal image={referenceImage} />}
            
            {/* HEADER */}
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-2">
                    <Palette className="text-vingi-600" size={20} />
                    <h2 className="text-lg font-bold text-gray-800">Pattern Studio <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded ml-2">SEARCH</span></h2>
                </div>
                {referenceImage && !isAnalyzing && (
                    <button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-vingi-600 bg-vingi-50 px-3 py-1.5 rounded-lg hover:bg-vingi-100 flex items-center gap-2">
                        <RefreshCw size={12}/> Nova Imagem
                    </button>
                )}
            </header>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
                
                {/* 1. ESTADO INICIAL: DRAG & DROP */}
                {!referenceImage ? (
                    <div className="min-h-[60vh] flex flex-col items-center justify-center animate-fade-in">
                        <div onClick={() => fileInputRef.current?.click()} className="w-full max-w-2xl h-80 bg-white rounded-3xl border-2 border-dashed border-gray-300 hover:border-vingi-500 hover:bg-vingi-50/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group">
                             <input type="file" ref={fileInputRef} onChange={handleReferenceUpload} accept="image/*" className="hidden" />
                             <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                 <UploadCloud size={32} className="text-gray-400 group-hover:text-vingi-500"/>
                             </div>
                             <div className="text-center">
                                 <h3 className="text-xl font-bold text-gray-700">Carregar Amostra de Tecido</h3>
                                 <p className="text-gray-400 mt-2">Arraste ou clique para iniciar a Análise de Mercado</p>
                             </div>
                        </div>
                    </div>
                ) : (
                    // 2. FLUXO PRINCIPAL (COM IMAGEM)
                    <div className="w-full">
                        
                        {/* 2.1 ESTADO SCANNING (ANIMAÇÃO) */}
                        {isAnalyzing && (
                             <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
                                <div className="relative w-64 h-80 rounded-3xl overflow-hidden shadow-2xl border-4 border-white ring-1 ring-slate-200 bg-slate-900">
                                    <img src={referenceImage} className="w-full h-full object-cover opacity-60 blur-[2px]" />
                                    <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,100,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,100,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                                    <div className="absolute top-0 left-0 w-full h-2 bg-vingi-400 shadow-[0_0_20px_rgba(96,165,250,1),0_0_10px_rgba(255,255,255,0.8)] animate-scan z-30 opacity-90"></div>
                                </div>
                                <div className="mt-8 text-center max-w-xs mx-auto">
                                    <h3 className="text-lg font-bold text-gray-800 tracking-tight animate-pulse min-h-[2rem]">
                                        {LOADING_STEPS[loadingStep]}
                                    </h3>
                                    <div className="flex justify-center items-center gap-2 text-vingi-500 font-mono text-xs mt-2 uppercase tracking-widest border border-vingi-100 bg-white px-4 py-1.5 rounded-full inline-block">
                                        <Loader2 size={12} className="animate-spin inline mr-2"/>
                                        Processando Textura
                                    </div>
                                </div>
                             </div>
                        )}

                        {/* 2.2 ESTADO PRONTO (PRÉ-PESQUISA) */}
                        {!isAnalyzing && !hasResults && !genError && (
                             <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in gap-8">
                                 <div className="relative w-48 h-48 bg-white rounded-2xl shadow-xl border-4 border-white overflow-hidden group">
                                     <img src={referenceImage} className="w-full h-full object-cover" />
                                     <div className="absolute inset-0 bg-black/10"></div>
                                 </div>
                                 
                                 <div className="text-center space-y-4">
                                     <h3 className="text-2xl font-bold text-gray-800">Amostra Carregada</h3>
                                     <button 
                                        onClick={handleStartAnalysis}
                                        className="px-10 py-5 bg-vingi-900 text-white rounded-full font-bold shadow-2xl hover:scale-105 transition-all flex items-center gap-3 text-lg animate-bounce-subtle"
                                     >
                                        <ScanLine size={24} className="text-vingi-400"/>
                                        PESQUISAR ESTAMPAS PRÓXIMAS
                                     </button>
                                     <p className="text-sm text-gray-400">A IA irá escanear bancos globais e extrair o DNA técnico.</p>
                                 </div>
                             </div>
                        )}

                        {/* 2.3 ESTADO DE ERRO */}
                        {genError && (
                             <div className="flex flex-col items-center justify-center h-[50vh] animate-fade-in">
                                 <div className="bg-red-50 p-4 rounded-full mb-4">
                                     <AlertCircle size={32} className="text-red-500"/>
                                 </div>
                                 <p className="text-gray-600 font-bold mb-6">{genError}</p>
                                 <button onClick={handleStartAnalysis} className="px-6 py-2 bg-vingi-900 text-white rounded-lg font-bold shadow hover:bg-vingi-800">Tentar Novamente</button>
                             </div>
                        )}

                        {/* 2.4 DASHBOARD DE RESULTADOS (PÓS-PESQUISA) */}
                        {!isAnalyzing && hasResults && (
                            <div className="space-y-12 animate-fade-in">
                                {/* GRID DE APRESENTAÇÃO */}
                                <div className="flex flex-col md:flex-row gap-8">
                                    {/* Coluna Esquerda: Referência */}
                                    <div className="w-full md:w-80 shrink-0">
                                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Referência</h4>
                                            <div className="aspect-square rounded-xl overflow-hidden relative group">
                                                <img src={referenceImage} className="w-full h-full object-cover" />
                                            </div>
                                            {technicalSpecs && (
                                                <div className="mt-4 space-y-2">
                                                    <SpecBadge icon={Brush} label="Estilo" value={technicalSpecs.technique} />
                                                    <SpecBadge icon={Leaf} label="Motivo" value={technicalSpecs.motifs?.[0]} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Coluna Direita: Resultados de Mercado */}
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                                <Globe className="text-vingi-600"/> Dept. Mercado Global
                                            </h3>
                                        </div>
                                        
                                        {uniqueMatches.length > 0 ? (
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 animate-fade-in">
                                                {visibleData.map((match, i) => (
                                                    <PatternVisualCard key={i} match={match} userReferenceImage={referenceImage} />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-center text-gray-400">
                                                <Search size={32} className="mx-auto mb-2 opacity-20"/>
                                                <p>Nenhum padrão exato encontrado no mercado.</p>
                                            </div>
                                        )}
                                        
                                        <div className="mt-6 flex gap-2 flex-wrap">
                                            <ExternalSearchButton name="Google Imagens" url={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(prompt)}`} colorClass="bg-blue-600" icon={Globe} />
                                            <ExternalSearchButton name="Pinterest" url={`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(prompt)}`} colorClass="bg-red-600" icon={Share2} />
                                        </div>
                                    </div>
                                </div>

                                {/* DIVISOR DE AÇÃO (CTA PARA O ATELIER) */}
                                <div className="relative py-8">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                                    <div className="relative flex justify-center">
                                        <button 
                                            onClick={handleTransferToAtelier}
                                            className="px-8 py-4 bg-vingi-900 text-white rounded-full font-bold shadow-xl hover:scale-105 transition-transform flex items-center gap-3 border-4 border-gray-100"
                                        >
                                            <Wand2 size={20} className="text-purple-300"/>
                                            <span>Não encontrou? Criar Estampa Exclusiva</span>
                                        </button>
                                    </div>
                                </div>

                                {/* HISTÓRICO DA SESSÃO */}
                                {history.length > 0 && !isAnalyzing && (
                                    <div className="pt-12 border-t border-gray-200">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><HistoryIcon size={14}/> Acervo Recente</h3>
                                            <button onClick={() => setHistory([])} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                                        </div>
                                        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                                            {history.map((asset) => (
                                                <div 
                                                    key={asset.id} 
                                                    className="w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:border-vingi-500 transition-all relative"
                                                    onClick={() => {
                                                        setReferenceImage(asset.imageUrl);
                                                        setFabricMatches([]);
                                                        setDetectedColors([]);
                                                        setTechnicalSpecs(null);
                                                    }}
                                                >
                                                    <img src={asset.imageUrl} className="w-full h-full object-cover"/>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
