
import React, { useState, useRef } from 'react';
import { UploadCloud, Wand2, Download, Palette, Image as ImageIcon, Loader2, Sparkles, Layers, Grid3X3, Target, Globe, Box, Maximize2, Feather, AlertCircle, Search, ChevronRight, Move, ZoomIn, Minimize2, Plus, TrendingUp, Brush, Leaf, Droplets, ShoppingBag, Share2, Ruler, Scissors, ArrowDownToLine, ArrowRightToLine, LayoutTemplate, History, Trash2, Settings2, Check, Printer } from 'lucide-react';
import { PantoneColor, ExternalPatternMatch } from '../types';
import { PatternVisualCard } from './PatternVisualCard';

// --- TYPES LOCAL ---
interface GeneratedAsset {
    id: string;
    imageUrl: string;
    prompt: string;
    layout: string;
    timestamp: number;
    specs: { width: number; height: number; dpi: number };
}

// Modal Flutuante para Comparação
const FloatingComparisonModal: React.FC<{ image: string }> = ({ image }) => {
    const [position, setPosition] = useState({ x: window.innerWidth - 220, y: 100 }); 
    const [size, setSize] = useState(180);
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
            <div className="fixed top-24 right-4 bg-vingi-900 text-white p-3 rounded-full shadow-2xl z-[100] cursor-pointer hover:scale-110 transition-transform" onClick={() => setIsMinimized(false)}>
                <ImageIcon size={24} />
            </div>
        );
    }

    return (
        <div 
            className="fixed z-[90] bg-white rounded-xl shadow-2xl border-2 border-vingi-500 overflow-hidden flex flex-col transition-shadow shadow-md"
            style={{ left: position.x, top: position.y, width: size, touchAction: 'none' }}
        >
            <div 
                className="bg-vingi-900 h-9 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing select-none"
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
            >
                <span className="text-[10px] font-bold text-white flex items-center gap-1 uppercase tracking-wider"><Move size={10}/> Ref</span>
                <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
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

// CARTÃO PANTONE INTERATIVO & TRENDY
const PantoneCard: React.FC<{ color: PantoneColor | any }> = ({ color }) => {
    const handleSearch = () => {
        const query = `Pantone ${color.code} ${color.name} cotton swatch`;
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`, '_blank');
    };

    return (
        <div onClick={handleSearch} className="flex flex-col bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-all cursor-pointer group h-full hover:scale-[1.02]">
            <div className="h-20 w-full relative" style={{ backgroundColor: color.hex }}>
                 <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <div className="bg-white/90 rounded text-[8px] font-mono px-1 py-0.5">{color.hex}</div>
                 </div>
                 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                     <Search className="text-white drop-shadow-md" size={16}/>
                 </div>
            </div>
            <div className="p-3 flex flex-col justify-between flex-1">
                <div className="mb-2">
                    <span className="block text-[10px] font-extrabold text-gray-900 leading-tight uppercase tracking-tight line-clamp-1" title={color.name}>{color.name}</span>
                    <span className="block text-[11px] text-gray-600 font-mono mt-0.5 font-bold">{color.code || 'TCX PENDING'}</span>
                </div>
                <div className="flex flex-col gap-1">
                    {color.role && (
                        <span className="self-start text-[8px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 uppercase tracking-wider truncate max-w-full">
                            {color.role}
                        </span>
                    )}
                    {color.trendStatus && (
                        <span className="self-start text-[8px] font-bold text-vingi-600 bg-vingi-50 px-1.5 py-0.5 rounded border border-vingi-100 flex items-center gap-1 leading-tight animate-pulse">
                            <TrendingUp size={8} className="shrink-0"/> {color.trendStatus}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const SpecBadge: React.FC<{ icon: any, label: string, value: string }> = ({ icon: Icon, label, value }) => (
    <div className="bg-white border border-gray-100 rounded-lg p-2.5 flex items-center gap-3 shadow-sm">
        <div className="p-2 bg-gray-50 rounded-full text-vingi-500">
            <Icon size={14} />
        </div>
        <div>
            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
            <span className="block text-xs font-bold text-gray-800 capitalize line-clamp-1">{value || "N/A"}</span>
        </div>
    </div>
);

export const PatternCreator: React.FC = () => {
    // --- STATES ---
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [pendingFile, setPendingFile] = useState<string | null>(null); // Temp file for modal
    const [showSetupModal, setShowSetupModal] = useState(false); // Controls wizard visibility

    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [history, setHistory] = useState<GeneratedAsset[]>([]); 
    const [prompt, setPrompt] = useState<string>('');
    const [detectedColors, setDetectedColors] = useState<PantoneColor[]>([]);
    
    // Configurações de Engenharia Têxtil (Inputs do Modal)
    const [layoutType, setLayoutType] = useState<'Corrida' | 'Barrada' | 'Localizada'>('Corrida');
    const [selvedgePos, setSelvedgePos] = useState<'Inferior' | 'Superior' | 'Esquerda' | 'Direita'>('Inferior');
    const [widthCm, setWidthCm] = useState<number>(140);
    const [heightCm, setHeightCm] = useState<number>(100);
    const [dpi, setDpi] = useState<number>(72); // Default Web Quality
    const [userInstruction, setUserInstruction] = useState<string>(''); // Texto do usuário

    // Resultados
    const [fabricMatches, setFabricMatches] = useState<ExternalPatternMatch[]>([]);
    const [visibleMatchesCount, setVisibleMatchesCount] = useState(10); 
    const [technicalSpecs, setTechnicalSpecs] = useState<any>(null);
    const [genError, setGenError] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- HELPER DE CÁLCULO DE PIXELS ---
    const calculatePixels = () => {
        const wPx = Math.round((widthCm / 2.54) * dpi);
        const hPx = Math.round((heightCm / 2.54) * dpi);
        return `${wPx}x${hPx}px`;
    };

    // --- HANDLERS ---

    // 1. Intercepta o upload e abre o modal
    const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const res = ev.target?.result as string;
                if (res) {
                    setPendingFile(res); // Salva temporariamente
                    setShowSetupModal(true); // Abre o wizard
                    
                    // Reset de estados anteriores
                    setGeneratedPattern(null);
                    setDetectedColors([]);
                    setFabricMatches([]);
                    setVisibleMatchesCount(10);
                    setTechnicalSpecs(null);
                    setPrompt('');
                    setGenError(null);
                    // Reset dos inputs para defaults (opcional)
                    setUserInstruction('');
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // 2. Chamado pelo botão "Confirmar" do modal
    const confirmSetupAndAnalyze = async () => {
        setShowSetupModal(false);
        if (pendingFile) {
            setReferenceImage(pendingFile);
            setPendingFile(null);
            // Inicia análise passando a imagem E as instruções do usuário
            await analyzeReference(pendingFile); 
        }
    };

    // 3. Função de Análise (Agora recebe imagem opcional para chamar direto)
    const analyzeReference = async (imgToAnalyze?: string) => {
        const img = imgToAnalyze || referenceImage;
        if (!img) return;
        
        setIsAnalyzing(true);
        setGenError(null);
        try {
            const compressedBase64 = await compressImage(img);
            const parts = compressedBase64.split(',');
            const data = parts[1];
            const mimeType = 'image/jpeg'; 
            
            // Envia userHints para o backend
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'DESCRIBE_PATTERN',
                    mainImageBase64: data,
                    mainMimeType: mimeType,
                    userHints: userInstruction // Passa a instrução do usuário
                })
            });
            
            if (!response.ok) throw new Error("API Error");
            const resData = await response.json();
            
            if (resData.success) {
                // Se o usuário digitou algo, concatenamos com a análise da IA
                let finalPrompt = resData.prompt || '';
                if (userInstruction) {
                    finalPrompt = `${userInstruction}. Visual style based on: ${finalPrompt}`;
                }
                setPrompt(finalPrompt);

                setDetectedColors(Array.isArray(resData.colors) ? resData.colors : []);
                setFabricMatches(Array.isArray(resData.stockMatches) ? resData.stockMatches : []);
                setTechnicalSpecs(resData.technicalSpecs || null);
                
                // Só sobrescreve o layout se o usuário NÃO tiver escolhido manualmente no modal (ou seja, se manteve o default e não digitou nada)
                // Na verdade, a escolha do modal é soberana. O technicalSpecs.layout é apenas sugestão da IA.
                // Mas podemos exibir um alerta se divergir. Por enquanto, respeitamos o state `layoutType` definido no modal.
            }
        } catch (error) {
            setPrompt("Could not analyze texture.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const generatePatternFromData = async () => {
        if (!prompt) return;
        setIsGenerating(true);
        setGenError(null);
        try {
             const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: prompt,
                    colors: detectedColors,
                    textileSpecs: {
                        layout: layoutType,
                        selvedge: selvedgePos,
                        width: widthCm,
                        height: heightCm,
                        dpi: dpi, // Passa DPI para o backend
                        styleGuide: technicalSpecs?.restorationInstructions || 'High quality vector style'
                    }
                })
            });
            const data = await response.json();
            if (data.success && data.image) { 
                setGeneratedPattern(data.image); 
                const newAsset: GeneratedAsset = {
                    id: Date.now().toString(),
                    imageUrl: data.image,
                    prompt: prompt,
                    layout: layoutType,
                    timestamp: Date.now(),
                    specs: { width: widthCm, height: heightCm, dpi: dpi }
                };
                setHistory(prev => [newAsset, ...prev]);

            } else {
                setGenError(data.error || "Erro na geração. A IA pode estar sobrecarregada.");
            }
        } catch (error: any) {
            setGenError(error.message || "Erro na geração.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = (imgUrl: string = generatedPattern!) => {
        if (!imgUrl) return;
        const link = document.createElement('a');
        link.download = `vingi-${layoutType.toLowerCase()}-${dpi}dpi-${Date.now()}.jpg`;
        link.href = imgUrl;
        link.click();
    };

    const restoreFromHistory = (asset: GeneratedAsset) => {
        setGeneratedPattern(asset.imageUrl);
        setLayoutType(asset.layout as any);
        setWidthCm(asset.specs.width);
        setHeightCm(asset.specs.height);
        setDpi(asset.specs.dpi || 72);
        setGenError(null);
    };

    const uniqueMatches = fabricMatches.filter((match, index, self) =>
        index === self.findIndex((m) => (m.url === match.url))
    );
    const visibleData = uniqueMatches.slice(0, visibleMatchesCount);
    const textureQuery = prompt ? `${prompt} seamless pattern` : 'texture pattern';

    return (
        <div className="flex flex-col h-full bg-[#f0f2f5] overflow-hidden relative">
            {referenceImage && <FloatingComparisonModal image={referenceImage} />}
            
            {/* --- MODAL DE SETUP (WIZARD) --- */}
            {showSetupModal && (
                <div className="fixed inset-0 z-[100] bg-vingi-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
                        <div className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><Settings2 size={18} className="text-vingi-500"/> Configuração de Estampa</h3>
                            <button onClick={() => setShowSetupModal(false)} className="text-gray-400 hover:text-red-500"><Settings2 size={18} className="rotate-45"/></button>
                        </div>
                        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                            
                            {/* 1. Preview Rápido */}
                            <div className="flex items-center gap-4 bg-blue-50 p-3 rounded-xl border border-blue-100">
                                {pendingFile && <img src={pendingFile} className="w-12 h-12 object-cover rounded-lg bg-white" />}
                                <div className="flex-1">
                                    <h4 className="text-xs font-bold text-blue-800 uppercase">Referência Selecionada</h4>
                                    <p className="text-[10px] text-blue-600">A IA analisará esta imagem como base.</p>
                                </div>
                            </div>

                            {/* 2. Dimensões */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Largura (cm)</label>
                                    <div className="flex items-center bg-white border border-gray-300 rounded-lg px-3 focus-within:border-vingi-500 transition-colors">
                                        <input type="number" value={widthCm} onChange={(e) => setWidthCm(Number(e.target.value))} className="w-full py-2 text-sm font-bold text-gray-800 outline-none bg-transparent"/>
                                        <span className="text-xs text-gray-400 font-bold">CM</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Altura (cm)</label>
                                    <div className="flex items-center bg-white border border-gray-300 rounded-lg px-3 focus-within:border-vingi-500 transition-colors">
                                        <input type="number" value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value))} className="w-full py-2 text-sm font-bold text-gray-800 outline-none bg-transparent"/>
                                        <span className="text-xs text-gray-400 font-bold">CM</span>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Resolução (DPI) - NOVO */}
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase">Resolução (Qualidade)</label>
                                    <span className="text-[10px] text-vingi-600 font-mono bg-vingi-50 px-2 py-0.5 rounded">{calculatePixels()}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => setDpi(72)} className={`py-2 rounded-lg border text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${dpi === 72 ? 'bg-vingi-900 text-white border-vingi-900 shadow-md' : 'bg-white text-gray-500 border-gray-200'}`}>
                                        <Globe size={14}/> 
                                        <span>72 DPI</span>
                                        <span className="text-[8px] opacity-60 font-normal">Web/Rascunho</span>
                                    </button>
                                    <button onClick={() => setDpi(150)} className={`py-2 rounded-lg border text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${dpi === 150 ? 'bg-vingi-900 text-white border-vingi-900 shadow-md' : 'bg-white text-gray-500 border-gray-200'}`}>
                                        <Printer size={14}/> 
                                        <span>150 DPI</span>
                                        <span className="text-[8px] opacity-60 font-normal">Têxtil Std</span>
                                    </button>
                                    <button onClick={() => setDpi(300)} className={`py-2 rounded-lg border text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${dpi === 300 ? 'bg-vingi-900 text-white border-vingi-900 shadow-md ring-1 ring-vingi-500' : 'bg-white text-gray-500 border-gray-200'}`}>
                                        <Sparkles size={14} className="text-yellow-400"/> 
                                        <span>300 DPI</span>
                                        <span className="text-[8px] opacity-60 font-normal">Alta Definição</span>
                                    </button>
                                </div>
                            </div>

                            {/* 4. Layout */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Estrutura do Layout</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => setLayoutType('Corrida')} className={`py-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${layoutType === 'Corrida' ? 'bg-vingi-900 text-white border-vingi-900 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                                        <Grid3X3 size={16}/> CORRIDA
                                    </button>
                                    <button onClick={() => setLayoutType('Barrada')} className={`py-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${layoutType === 'Barrada' ? 'bg-vingi-900 text-white border-vingi-900 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                                        <ArrowDownToLine size={16}/> BARRADA
                                    </button>
                                    <button onClick={() => setLayoutType('Localizada')} className={`py-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${layoutType === 'Localizada' ? 'bg-vingi-900 text-white border-vingi-900 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                                        <Target size={16}/> LOCAL
                                    </button>
                                </div>
                            </div>

                            {/* 5. Texto Opcional */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Instruções para a IA (Opcional)</label>
                                <textarea 
                                    value={userInstruction}
                                    onChange={(e) => setUserInstruction(e.target.value)}
                                    placeholder="Ex: Mudar fundo para preto, adicionar textura de linho, aumentar contraste..."
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 outline-none focus:bg-white focus:border-vingi-500 transition-all min-h-[80px]"
                                />
                                <p className="text-[10px] text-gray-400 mt-1 text-right">Deixe vazio para usar apenas a imagem.</p>
                            </div>
                            
                            <button onClick={confirmSetupAndAnalyze} className="w-full py-4 bg-vingi-900 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-vingi-800 transition-transform active:scale-95 shrink-0">
                                <Check size={18} /> CONFIRMAR & ANALISAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 shrink-0 z-20 shadow-sm">
                <Palette className="text-vingi-600 mr-2" size={20} />
                <h2 className="text-lg font-bold text-gray-800">Pattern Studio <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500 ml-2">DEPTS. ATIVOS</span></h2>
            </header>

            {/* Layout Flex para Mobile (Column) e Desktop (Row) */}
            <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden overflow-y-auto">
                
                {/* SIDEBAR: INPUTS & ANÁLISE */}
                <div className="w-full md:w-[400px] bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col h-auto md:h-full md:overflow-y-auto shrink-0 z-10 custom-scrollbar shadow-sm">
                    <div className="p-6 space-y-8">
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <ImageIcon size={14}/> 1. Amostra de Referência
                            </h3>
                            <div onClick={() => fileInputRef.current?.click()} className={`relative h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all group ${referenceImage ? 'border-vingi-500 bg-white' : 'border-gray-300 hover:border-vingi-400 hover:bg-gray-50'}`}>
                                <input type="file" ref={fileInputRef} onChange={handleReferenceUpload} accept="image/*" className="hidden" />
                                {referenceImage ? (
                                    <>
                                        <img src={referenceImage} className="w-full h-full object-cover rounded-lg p-1 opacity-80 group-hover:opacity-100 transition-opacity" />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 rounded-lg transition-opacity">
                                            <span className="bg-white px-3 py-1 rounded-full text-xs font-bold shadow-md">Trocar Imagem</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center p-6">
                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                            <UploadCloud className="text-gray-400" size={24}/>
                                        </div>
                                        <span className="text-sm font-bold text-gray-600">Carregar Textura</span>
                                        <p className="text-[10px] text-gray-400 mt-1">JPG, PNG (Max 5MB)</p>
                                    </div>
                                )}
                            </div>
                            {referenceImage && !technicalSpecs && (
                                <button onClick={() => analyzeReference()} disabled={isAnalyzing} className="mt-4 w-full py-3 bg-vingi-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-vingi-800 transition-colors shadow-lg animate-fade-in">
                                    {isAnalyzing ? <Loader2 className="animate-spin" size={16}/> : <Search size={16}/>} 
                                    {isAnalyzing ? 'Processando...' : 'Reiniciar Análise'}
                                </button>
                            )}
                        </div>
                        {technicalSpecs && (
                            <div className="animate-fade-in space-y-6">
                                {/* PAINEL DE ENGENHARIA TÊXTIL */}
                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Ruler size={14}/> 2. Engenharia Têxtil
                                        </h3>
                                        <button onClick={() => setShowSetupModal(true)} className="text-[10px] text-vingi-600 font-bold hover:underline">Editar Setup</button>
                                    </div>
                                    
                                    {/* Dimensões */}
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Largura (cm)</label>
                                            <div className="flex items-center bg-white border border-gray-200 rounded-lg px-2 opacity-70 cursor-not-allowed">
                                                <input type="number" value={widthCm} readOnly className="w-full py-2 text-sm font-bold text-gray-800 outline-none bg-transparent cursor-not-allowed"/>
                                                <span className="text-[10px] text-gray-400 font-bold">CM</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Altura (cm)</label>
                                            <div className="flex items-center bg-white border border-gray-200 rounded-lg px-2 opacity-70 cursor-not-allowed">
                                                <input type="number" value={heightCm} readOnly className="w-full py-2 text-sm font-bold text-gray-800 outline-none bg-transparent cursor-not-allowed"/>
                                                <span className="text-[10px] text-gray-400 font-bold">CM</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Resolução Exibida */}
                                    <div className="mb-4">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Resolução de Saída</label>
                                        <div className="flex justify-between items-center bg-white border border-gray-200 rounded-lg p-2 opacity-80">
                                            <span className="text-xs font-bold text-gray-700">{dpi} DPI</span>
                                            <span className="text-[9px] font-mono text-gray-400">{calculatePixels()}</span>
                                        </div>
                                    </div>

                                    {/* Layout Control */}
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tipo de Repetição</label>
                                            <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                                                <button disabled className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${layoutType === 'Corrida' ? 'bg-vingi-900 text-white shadow-sm' : 'text-gray-300'}`}>CORRIDA</button>
                                                <button disabled className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${layoutType === 'Barrada' ? 'bg-vingi-900 text-white shadow-sm' : 'text-gray-300'}`}>BARRADA</button>
                                                <button disabled className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${layoutType === 'Localizada' ? 'bg-vingi-900 text-white shadow-sm' : 'text-gray-300'}`}>LOCAL</button>
                                            </div>
                                        </div>

                                        {layoutType === 'Barrada' && (
                                            <div className="animate-fade-in">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Posição da Ourela (Barra)</label>
                                                <div className="grid grid-cols-4 gap-2">
                                                     <button onClick={() => setSelvedgePos('Inferior')} title="Barra Inferior" className={`py-2 rounded border flex justify-center ${selvedgePos === 'Inferior' ? 'border-vingi-500 bg-vingi-50 text-vingi-600' : 'border-gray-200 bg-white text-gray-400'}`}><ArrowDownToLine size={16}/></button>
                                                     <button onClick={() => setSelvedgePos('Superior')} title="Barra Superior" className={`py-2 rounded border flex justify-center ${selvedgePos === 'Superior' ? 'border-vingi-500 bg-vingi-50 text-vingi-600' : 'border-gray-200 bg-white text-gray-400'}`}><ArrowDownToLine size={16} className="rotate-180"/></button>
                                                     <button onClick={() => setSelvedgePos('Esquerda')} title="Ourela Esquerda" className={`py-2 rounded border flex justify-center ${selvedgePos === 'Esquerda' ? 'border-vingi-500 bg-vingi-50 text-vingi-600' : 'border-gray-200 bg-white text-gray-400'}`}><ArrowRightToLine size={16} className="rotate-180"/></button>
                                                     <button onClick={() => setSelvedgePos('Direita')} title="Ourela Direita" className={`py-2 rounded border flex justify-center ${selvedgePos === 'Direita' ? 'border-vingi-500 bg-vingi-50 text-vingi-600' : 'border-gray-200 bg-white text-gray-400'}`}><ArrowRightToLine size={16}/></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* DADOS FORENSES EM PORTUGUÊS */}
                                {technicalSpecs.motifs && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <SpecBadge icon={Leaf} label="Motivos" value={technicalSpecs.motifs[0] || 'Floral'} />
                                        <SpecBadge icon={Brush} label="Técnica" value={technicalSpecs.technique || 'Digital'} />
                                        <SpecBadge icon={Layers} label="Layout" value={technicalSpecs.layout || 'Padrão'} />
                                        <SpecBadge icon={Droplets} label="Vibe" value={technicalSpecs.vibe || 'Moderna'} />
                                    </div>
                                )}

                                {/* Resumo de Cores */}
                                <div className="pt-2">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Palette size={14}/> Dept. Colorimetria
                                    </h3>
                                    {detectedColors.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            {detectedColors.map((c, i) => <PantoneCard key={i} color={c} />)}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">Nenhuma cor dominante detectada.</p>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Sparkles size={14}/> 3. Geração da Estampa
                                    </h3>
                                    <button onClick={generatePatternFromData} disabled={isGenerating} className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 hover:brightness-110 transition-all">
                                        {isGenerating ? <Loader2 className="animate-spin"/> : <Wand2 size={18}/>}
                                        {generatedPattern ? 'Regerar com Novos Parâmetros' : 'Criar Estampa Final'}
                                    </button>
                                    {genError && (
                                        <div className="mt-3 p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2 border border-red-100">
                                            <AlertCircle size={14} className="shrink-0"/> {genError}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ÁREA PRINCIPAL: RESULTADOS */}
                <div className="flex-1 flex flex-col h-auto md:h-full md:overflow-y-auto bg-[#f1f5f9]">
                    <div className="p-6 md:p-10 flex flex-col items-center justify-center bg-white border-b border-gray-200 min-h-[400px] relative">
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                        {!generatedPattern && !isGenerating ? (
                            <div className="text-center opacity-40 max-w-md">
                                <LayoutTemplate size={64} className="mx-auto mb-4 text-gray-300"/>
                                <h3 className="text-xl font-bold text-gray-800">Estúdio de Criação</h3>
                                <p className="text-gray-500 mt-2">Defina as dimensões e o tipo de layout no painel lateral para criar sua estampa técnica.</p>
                            </div>
                        ) : isGenerating ? (
                             <div className="flex flex-col items-center justify-center">
                                <div className="relative">
                                    <div className="w-24 h-24 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin"></div>
                                    <Sparkles size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-600 animate-pulse"/>
                                </div>
                                <h3 className="text-lg font-bold text-gray-700 mt-6">Atelier Trabalhando...</h3>
                                <p className="text-sm text-gray-400">Calculando layout {layoutType} ({widthCm}x{heightCm}cm) em {dpi} DPI...</p>
                             </div>
                        ) : (
                            <div className="w-full max-w-4xl animate-fade-in flex flex-col md:flex-row gap-8 items-center">
                                <div className="relative aspect-square w-full md:w-96 bg-white rounded-xl shadow-2xl overflow-hidden border-8 border-white group">
                                    <img src={generatedPattern!} className="w-full h-full object-cover"/>
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button onClick={() => handleDownload()} className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 hover:scale-105 transition-transform"><Download size={18}/> Baixar Arquivo</button>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-4">
                                    <h3 className="text-2xl font-bold text-gray-800">Resultado Técnico</h3>
                                    <div className="flex gap-2">
                                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase">{layoutType}</span>
                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded uppercase">{widthCm}x{heightCm}cm</span>
                                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded uppercase">{dpi} DPI</span>
                                        {layoutType === 'Barrada' && <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase">Barra {selvedgePos}</span>}
                                    </div>
                                    <p className="text-gray-500 text-sm">Estampa gerada respeitando a área útil e direção da ourela solicitada. Pronta para plotagem ou sublimação.</p>
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                         <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Specs</h4>
                                         <p className="text-xs text-gray-600 font-mono italic">"{prompt}"</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-6 md:p-8 pb-32">
                        
                        {/* NOVO: ACERVO DE CRIAÇÕES (HISTÓRICO DA SESSÃO) */}
                        {history.length > 0 && (
                            <div className="mb-10">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <History className="text-vingi-600"/> Acervo da Sessão
                                    </h3>
                                    <button onClick={() => setHistory([])} className="text-xs text-red-400 flex items-center gap-1 hover:text-red-600"><Trash2 size={12}/> Limpar</button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {history.map((asset) => (
                                        <div 
                                            key={asset.id} 
                                            onClick={() => restoreFromHistory(asset)}
                                            className={`group relative aspect-square bg-white rounded-xl border-2 cursor-pointer overflow-hidden transition-all ${generatedPattern === asset.imageUrl ? 'border-vingi-500 ring-2 ring-vingi-100' : 'border-gray-100 hover:border-gray-300'}`}
                                        >
                                            <img src={asset.imageUrl} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end p-2">
                                                <div className="bg-white/90 backdrop-blur text-gray-800 text-[9px] font-bold px-2 py-1 rounded w-full truncate">
                                                    {asset.layout}
                                                </div>
                                            </div>
                                            {generatedPattern === asset.imageUrl && (
                                                <div className="absolute top-2 right-2 bg-vingi-500 text-white rounded-full p-1"><Sparkles size={10}/></div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Globe className="text-vingi-600"/> Dept. Mercado Global
                            </h3>
                            {uniqueMatches.length > 0 && <span className="text-xs bg-white border border-gray-200 px-3 py-1 rounded-full text-gray-500 font-bold">{uniqueMatches.length} Encontrados</span>}
                        </div>
                        {uniqueMatches.length === 0 ? (
                             technicalSpecs ? (
                                <div className="flex items-center justify-center h-32 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                    <p className="text-gray-400 text-sm">Nenhuma correspondência exata encontrada nos marketplaces.</p>
                                </div>
                             ) : (
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 opacity-30 pointer-events-none">
                                    {[1,2,3,4,5].map(i => <div key={i} className="h-64 bg-gray-200 rounded-xl animate-pulse"></div>)}
                                </div>
                             )
                        ) : (
                            <>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {visibleData.map((match, i) => (
                                        <PatternVisualCard key={i} match={match} userReferenceImage={referenceImage} />
                                    ))}
                                </div>
                                
                                {visibleMatchesCount < uniqueMatches.length && (
                                    <div className="mt-8 flex justify-center">
                                        <button 
                                            onClick={() => setVisibleMatchesCount(p => p + 10)} 
                                            className="px-8 py-3 bg-white border border-gray-300 rounded-xl font-bold shadow-sm hover:bg-gray-50 hover:border-gray-400 text-gray-600 transition-all flex items-center gap-2"
                                        >
                                            <Plus size={16}/> Carregar Mais ({uniqueMatches.length - visibleMatchesCount})
                                        </button>
                                    </div>
                                )}

                                {/* SEÇÃO DE LINKS CONTEXTUAIS EXTERNOS */}
                                <div className="mt-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                    <h4 className="font-bold mb-4 flex items-center gap-2 text-sm text-gray-500 uppercase tracking-widest"><Globe size={14}/> Busca Visual Global</h4>
                                    <div className="flex gap-2 flex-wrap">
                                        <ExternalSearchButton name="Google Imagens" url={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(textureQuery)}`} colorClass="bg-blue-600" icon={Globe} />
                                        <ExternalSearchButton name="Pinterest" url={`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(textureQuery)}`} colorClass="bg-red-600" icon={Share2} />
                                        <ExternalSearchButton name="Shutterstock" url={`https://www.shutterstock.com/search/${encodeURIComponent(textureQuery)}`} colorClass="bg-red-500" icon={ShoppingBag} />
                                        <ExternalSearchButton name="Etsy Digital" url={`https://www.etsy.com/search?q=${encodeURIComponent(textureQuery + ' digital paper')}`} colorClass="bg-orange-500" icon={ShoppingBag} />
                                        <ExternalSearchButton name="Spoonflower" url={`https://www.spoonflower.com/en/shop?on=fabric&q=${encodeURIComponent(textureQuery)}`} colorClass="bg-teal-600" icon={ShoppingBag} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
