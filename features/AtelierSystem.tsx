
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Loader2, Layers, Grid3X3, ArrowDownToLine, Check, Printer, Brush, Info, Settings2, Ruler, Scroll, Maximize, FileWarning, Zap, Grip, AlignVerticalSpaceAround, Spline, RefreshCw, Droplets, Sun, Moon, Contrast, Sparkles, X, Hammer, Image as ImageIcon, Type, BrainCircuit } from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader, FloatingReference } from '../components/Shared';

// --- HELPERS ---
const triggerTransfer = (targetModule: string, imageData: string, textureData?: any) => {
    if (targetModule === 'MOCKUP') {
        localStorage.setItem('vingi_mockup_pattern', imageData);
    }
    if (targetModule === 'LAYER') {
        const payload = {
            mainImage: imageData,
            texture: textureData
        };
        localStorage.setItem('vingi_layer_studio_data', JSON.stringify(payload));
    }
    window.dispatchEvent(new CustomEvent('vingi_transfer', { 
        detail: { module: targetModule, timestamp: Date.now() } 
    }));
};

// ATUALIZADO: Visual mais limpo, foco no código. Nome discreto.
const PantoneChip: React.FC<{ color: PantoneColor }> = ({ color }) => (
    <div 
        className="flex flex-col bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-20 w-full group relative"
        title={`${color.name} (Clique para copiar)`}
        onClick={() => { navigator.clipboard.writeText(`${color.code} (${color.hex})`); }}
    >
        {/* Color Block */}
        <div className="h-12 w-full relative" style={{ backgroundColor: color.hex }}>
             <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-black"></div>
        </div>
        
        {/* Info Block */}
        <div className="p-1.5 flex flex-col justify-center h-8 bg-white border-t border-gray-100">
            {/* Linha 1: Código TCX (Destaque) */}
            <span className="text-[10px] font-bold text-gray-800 font-mono tracking-tight leading-none">
                {color.code}
            </span>
            {/* Linha 2: Nome ou Hex (Discreto) */}
            <div className="flex justify-between items-center mt-0.5">
                <span className="text-[8px] text-gray-400 font-medium truncate max-w-[80%] uppercase">
                    {color.name || color.hex}
                </span>
            </div>
        </div>
    </div>
);

const SIZE_PRESETS = [
    { label: "Rapport 64", w: 64, h: 64, desc: "Padrão Indústria" },
    { label: "Rapport 32", w: 32, h: 32, desc: "Mini-Rapport" },
    { label: "Digital 145", w: 145, h: 100, desc: "Largura Útil" },
    { label: "Painel", w: 100, h: 140, desc: "Localizado" }
];

interface AtelierSystemProps {
    onNavigateToMockup?: () => void;
    onNavigateToLayerStudio?: () => void;
}

const GENERATION_STEPS = [
    "Inicializando Atelier Neural...",
    "Verificando Compliance de Segurança...",
    "Aplicando Vingi Neuro-Bridge...",
    "Renderizando Vetores de Alta Densidade...",
    "Calibrando Paleta Pantone...",
    "Finalizando Arquivo..."
];

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    // Assets
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [isEnhanced, setIsEnhanced] = useState(false);
    
    // Data
    const [colorData, setColorData] = useState<{ harmony: string, suggestion: string, colors: PantoneColor[] } | null>(null);
    const [technicalPrompt, setTechnicalPrompt] = useState<string>('');
    const [activeColorMode, setActiveColorMode] = useState<'NATURAL' | 'VIVID' | 'PASTEL' | 'DARK'>('NATURAL');
    const [creationMode, setCreationMode] = useState<'IMAGE' | 'TEXT' | null>(null);
    
    // Engenharia
    const [layoutType, setLayoutType] = useState<'Corrida' | 'Barrada' | 'Localizada'>('Corrida');
    const [repeatType, setRepeatType] = useState<'Straight' | 'Half-Drop' | 'Mirror'>('Straight');
    const [widthCm, setWidthCm] = useState<number>(64);
    const [heightCm, setHeightCm] = useState<number>(64);
    const [dpi, setDpi] = useState<72 | 150 | 300>(300);
    const [selvedgeInfo, setSelvedgeInfo] = useState(true);

    // Texture Overlay Post-Process
    const [textureType, setTextureType] = useState<'None' | 'Cotton' | 'Linen' | 'Silk' | 'Canvas'>('None');
    const [textureOpacity, setTextureOpacity] = useState(0.4);
    const [textureBlend, setTextureBlend] = useState<'multiply' | 'overlay' | 'screen'>('multiply');

    const [userInstruction, setUserInstruction] = useState<string>('');
    
    // State
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false); // New State
    const [isAnalyzingColors, setIsAnalyzingColors] = useState(false);
    const [genStep, setGenStep] = useState(0);
    const [error, setError] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // --- INITIALIZATION ---
    useEffect(() => {
        const transferImage = localStorage.getItem('vingi_transfer_image');
        if (transferImage) {
            handleImageSession(transferImage);
            localStorage.removeItem('vingi_transfer_image');
        }
    }, []);

    // Animation Loop
    useEffect(() => {
        let interval: any;
        if (isGenerating) {
            setGenStep(0);
            interval = setInterval(() => { setGenStep(p => (p + 1) % GENERATION_STEPS.length); }, 2000);
        }
        return () => clearInterval(interval);
    }, [isGenerating]);

    const resetSession = () => {
        setReferenceImage(null);
        setGeneratedPattern(null);
        setIsEnhanced(false);
        setColorData(null);
        setTechnicalPrompt('');
        setUserInstruction('');
        setCreationMode(null);
        setError(null);
    };

    const handleImageSession = (img: string) => {
        setReferenceImage(img);
        setCreationMode('IMAGE');
        setGeneratedPattern(null);
        setIsEnhanced(false);
        setColorData(null);
        setError(null);
        setDpi(300);
        setWidthCm(64);
        setHeightCm(64);
        analyzeColors(img, 'NATURAL');
    };

    const handleTextSession = () => {
        setCreationMode('TEXT');
        setReferenceImage(null);
        setGeneratedPattern(null);
        setColorData(null); // No colors initially in text mode
        setError(null);
        setDpi(300);
        setWidthCm(64);
        setHeightCm(64);
        // Set a placeholder technical prompt to guide generation if user doesn't type much
        setTechnicalPrompt("Seamless textile pattern");
    };

    // Independent Color Analysis
    const analyzeColors = async (imgBase64: string, variation: 'NATURAL' | 'VIVID' | 'PASTEL' | 'DARK') => {
        setIsAnalyzingColors(true);
        setActiveColorMode(variation); 
        try {
            const compressedBase64 = imgBase64.includes(',') ? imgBase64.split(',')[1] : imgBase64;
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'DESCRIBE_PATTERN', 
                    mainImageBase64: compressedBase64, 
                    mainMimeType: 'image/jpeg',
                    userHints: variation === 'NATURAL' ? '' : `VARIATION: ${variation}`
                })
            });
            const data = await res.json();
            if (data.success && data.colors) {
                setColorData({ 
                    colors: data.colors, 
                    harmony: variation === 'NATURAL' ? "Paleta Original" : `Variação: ${variation}`, 
                    suggestion: "Cores calibradas." 
                });
                if (data.prompt) setTechnicalPrompt(data.prompt);
            }
        } catch (e) {}
        setIsAnalyzingColors(false);
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = ev.target?.result as string;
                handleImageSession(img);
            };
            reader.readAsDataURL(file);
        }
    };

    // --- PROMPT ENHANCER ---
    const handlePromptEnhance = async () => {
        if (!userInstruction || userInstruction.length < 3) return;
        setIsEnhancingPrompt(true);
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'ENHANCE_TEXT_PROMPT', 
                    prompt: userInstruction 
                })
            });
            const data = await res.json();
            if (data.success && data.enhancedText) {
                setUserInstruction(data.enhancedText);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsEnhancingPrompt(false);
        }
    };

    const handleGenerate = async () => {
        if (!referenceImage && (!userInstruction && !technicalPrompt)) {
            setError("Para criar sem imagem, digite uma descrição no campo 'Prompt do Estilista'.");
            return;
        }

        setIsGenerating(true);
        setIsEnhanced(false);
        setError(null);

        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            // Logic: Use Technical Prompt (from Image Analysis) OR User Instruction (Text Mode)
            let finalPrompt = "";
            
            if (creationMode === 'IMAGE') {
                // Image Mode: Merge Technical + User Hints
                finalPrompt = userInstruction 
                    ? `${technicalPrompt}. User Instruction: ${userInstruction}` 
                    : technicalPrompt;
            } else {
                // Text Mode: Rely heavily on User Instruction
                finalPrompt = userInstruction || technicalPrompt;
                if (finalPrompt.length < 5) throw new Error("A descrição está muito curta. Detalhe mais sua ideia.");
            }

            const genRes = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: finalPrompt,
                    colors: colorData?.colors || [],
                    textileSpecs: {
                        layout: layoutType,
                        repeat: repeatType,
                        width: widthCm, 
                        height: heightCm, 
                        dpi: dpi,
                        styleGuide: "RICH DIGITAL ART, FLAT SURFACE, NO WEAVE", 
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
            if (err.name !== 'AbortError') setError(err.message);
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    const handleEnhance = async () => {
        if (!generatedPattern) return;
        setIsEnhancing(true);
        setError(null);
        
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'ENHANCE_PATTERN', 
                    mainImageBase64: generatedPattern,
                    prompt: technicalPrompt || userInstruction || "High quality textile pattern"
                })
            });
            const data = await res.json();
            if (data.success && data.image) {
                setGeneratedPattern(data.image);
                setIsEnhanced(true);
            } else {
                throw new Error("Falha no refinamento.");
            }
        } catch (e: any) {
            setError("Erro ao refinar imagem. Tente novamente.");
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleTransfer = (target: 'MOCKUP' | 'LAYER') => {
        if (!generatedPattern) return;
        
        let textureData = null;
        if (target === 'LAYER' && textureType !== 'None') {
            textureData = {
                type: textureType,
                opacity: textureOpacity,
                blend: textureBlend,
                url: getTextureUrl(textureType)
            };
        }

        triggerTransfer(target, generatedPattern, textureData);
        if (target === 'MOCKUP' && onNavigateToMockup) onNavigateToMockup();
        if (target === 'LAYER' && onNavigateToLayerStudio) onNavigateToLayerStudio();
    };

    const getTextureUrl = (type: string) => {
        if (type === 'Cotton') return 'https://www.transparenttextures.com/patterns/canvas-orange.png';
        if (type === 'Linen') return 'https://www.transparenttextures.com/patterns/black-linen.png';
        if (type === 'Silk') return 'https://www.transparenttextures.com/patterns/shattered-island.png';
        if (type === 'Canvas') return 'https://www.transparenttextures.com/patterns/rough-cloth-light.png';
        return '';
    };

    const getTextureStyle = () => {
        if (textureType === 'None') return {};
        return {
            backgroundImage: `url("${getTextureUrl(textureType)}")`,
            opacity: textureOpacity,
            mixBlendMode: textureBlend
        };
    };

    return (
        <div className="h-full bg-[#f8fafc] flex flex-col overflow-hidden">
            <ModuleHeader 
                icon={Palette} 
                title="Criar Estampas" 
                subtitle="Impressão Digital & Estamparia"
                referenceImage={referenceImage}
                actionLabel={creationMode ? "Reiniciar" : undefined}
                onAction={resetSession}
            />

            {referenceImage && !isGenerating && !isEnhancing && (
                <FloatingReference image={referenceImage} label="Ref. Original" />
            )}

            {!creationMode ? (
                // LANDING STATE: DUAL CHOICE
                // ADDED overflow-y-auto to fix mobile scrolling
                <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 animate-fade-in bg-gradient-to-b from-[#f8fafc] to-gray-50 overflow-y-auto">
                    <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" />
                    
                    <div className="text-center mb-10 max-w-2xl">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-vingi-900 text-white mb-6 shadow-xl shadow-vingi-900/20">
                            <Palette size={32} />
                        </div>
                        <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">Atelier Têxtil Digital</h1>
                        <p className="text-gray-500 text-lg">
                            Escolha como deseja criar sua estampa. Use IA para reinterpretar imagens ou crie do zero com prompts textuais.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl pb-10">
                        {/* CARD 1: REFERENCE */}
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white p-8 rounded-3xl border border-gray-200 shadow-xl hover:shadow-2xl hover:border-vingi-400 hover:-translate-y-1 transition-all group text-left relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                                    <UploadCloud size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Recriar Sua Estampa</h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    Envie uma foto de roupa ou tecido e a IA cria o arquivo digital idêntico em alta definição. Perfeito para restaurar estampas antigas.
                                </p>
                                <span className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest group-hover:gap-3 transition-all">
                                    Carregar Imagem <ArrowDownToLine size={14} className="-rotate-90"/>
                                </span>
                            </div>
                        </button>

                        {/* CARD 2: TEXT */}
                        <button 
                            onClick={handleTextSession}
                            className="bg-white p-8 rounded-3xl border border-gray-200 shadow-xl hover:shadow-2xl hover:border-purple-400 hover:-translate-y-1 transition-all group text-left relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6">
                                    <Type size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Criação Textual</h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    Não tem imagem? Descreva sua ideia (ex: "Floral tropical aquarela fundo preto") e a IA gera do zero.
                                </p>
                                <span className="inline-flex items-center gap-2 text-xs font-bold text-purple-600 uppercase tracking-widest group-hover:gap-3 transition-all">
                                    Criar com Texto <ArrowDownToLine size={14} className="-rotate-90"/>
                                </span>
                            </div>
                        </button>
                    </div>
                </div>
            ) : (
                // WORKSPACE (Unified for both modes)
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    
                    {/* VISUALIZATION PANEL */}
                    <div className="order-1 md:order-2 flex-1 bg-slate-900 relative flex items-center justify-center overflow-hidden min-w-0 h-[55vh] md:h-full">
                         <div className="absolute inset-0 opacity-10 bg-[linear-gradient(#ffffff_1px,transparent_1px),linear-gradient(90deg,#ffffff_1px,transparent_1px)] bg-[size:20px_20px]"></div>

                         {isGenerating || isEnhancing ? (
                             <div className="text-center relative z-10 p-8 max-w-sm">
                                 <div className="relative inline-block mb-6">
                                     <Loader2 size={48} className="text-vingi-400 animate-spin"/>
                                     <div className="absolute inset-0 flex items-center justify-center">
                                         <BrainCircuit size={20} className="text-white animate-pulse" />
                                     </div>
                                 </div>
                                 <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
                                     {isEnhancing ? "Refinando Detalhes..." : GENERATION_STEPS[genStep]}
                                 </h2>
                                 <p className="text-slate-400 text-sm">
                                     {isEnhancing ? "Aplicando vetorização e limpeza de ruído..." : "A IA está negociando a semântica visual para máxima fidelidade."}
                                 </p>
                                 <div className="mt-8 w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                                     <div className="h-full bg-vingi-500 animate-progress-indeterminate"></div>
                                 </div>
                             </div>
                         ) : (
                             generatedPattern ? (
                                <div className="relative w-full h-full flex flex-col items-center justify-center p-8">
                                     <div className="relative shadow-2xl rounded-sm border border-white/10 overflow-hidden group flex justify-center items-center" 
                                          style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}>
                                         <img src={generatedPattern} className="block w-auto h-auto max-w-full max-h-[85vh] bg-white" style={{ objectFit: 'contain' }} />
                                         {textureType !== 'None' && (
                                             <div className="absolute inset-0 pointer-events-none z-10 transition-all duration-300" style={getTextureStyle()}></div>
                                         )}
                                     </div>
                                     {/* Texture Controls */}
                                     <div className="absolute bottom-4 bg-gray-900/90 backdrop-blur-md px-4 py-3 rounded-xl border border-gray-700 flex items-center gap-4 animate-slide-up z-50 overflow-x-auto max-w-[90%]">
                                         <div className="flex flex-col gap-1 shrink-0">
                                             <span className="text-[9px] font-bold text-gray-400 uppercase">Acabamento</span>
                                             <div className="flex gap-1">
                                                {['None', 'Cotton', 'Linen', 'Silk', 'Canvas'].map(t => (
                                                    <button key={t} onClick={() => setTextureType(t as any)} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${textureType === t ? 'bg-vingi-500 text-white shadow-sm' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>{t}</button>
                                                ))}
                                             </div>
                                         </div>
                                         {textureType !== 'None' && (
                                             <>
                                                 <div className="w-px h-8 bg-gray-700 mx-2 shrink-0"></div>
                                                 <div className="flex flex-col w-20 shrink-0">
                                                     <span className="text-[9px] font-bold text-gray-400 mb-1 flex justify-between">Opacity <span>{Math.round(textureOpacity*100)}%</span></span>
                                                     <input type="range" min="0" max="1" step="0.1" value={textureOpacity} onChange={e => setTextureOpacity(parseFloat(e.target.value))} className="h-1 bg-gray-700 rounded-lg appearance-none accent-vingi-500"/>
                                                 </div>
                                             </>
                                         )}
                                     </div>
                                     <div className="absolute top-4 right-4 flex gap-2">
                                         {isEnhanced && <div className="bg-green-500/90 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[10px] font-bold border border-green-400 shadow-lg animate-pulse z-30 flex items-center gap-1"><Sparkles size={10}/> HI-RES POLISHED</div>}
                                         <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[10px] font-mono border border-white/10 z-30">{widthCm}x{heightCm}cm | {dpi} DPI</div>
                                     </div>
                                </div>
                             ) : (
                                <div className="text-center opacity-30 select-none pointer-events-none">
                                    {creationMode === 'TEXT' ? (
                                        <>
                                            <Type size={64} className="mx-auto mb-4 text-white"/>
                                            <p className="text-white text-sm font-medium">Aguardando Prompt de Texto</p>
                                        </>
                                    ) : (
                                        <>
                                            <Grid3X3 size={64} className="mx-auto mb-4 text-white"/>
                                            <p className="text-white text-sm font-medium">Área de Renderização 4K</p>
                                        </>
                                    )}
                                </div>
                             )
                         )}

                         {error && (
                             <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 animate-bounce-subtle z-50 border border-red-400">
                                 <FileWarning size={18}/> 
                                 <div className="flex flex-col text-left">
                                     <span>{error}</span>
                                     <span className="text-[10px] opacity-80 font-normal">A Neuro-Negociação falhou. Simplifique o prompt.</span>
                                 </div>
                             </div>
                         )}
                    </div>
                    
                    {/* CONTROLS PANEL */}
                    <div className="order-2 md:order-1 w-full md:w-[380px] lg:w-[400px] bg-white border-t md:border-t-0 md:border-r border-gray-200 flex flex-col z-20 shadow-xl h-[45vh] md:h-full overflow-y-auto custom-scrollbar shrink-0">
                        <div className="p-5 space-y-6 pb-20">
                            
                            {/* SECTION 1: DIMENSÕES */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Ruler size={14} className="text-vingi-500"/> Dimensões Digitais
                                </h3>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden group">
                                        <span className="text-[9px] text-gray-400 font-bold block flex items-center gap-1">LARGURA ÚTIL</span>
                                        <div className="flex items-end gap-1"><input type="number" value={widthCm} onChange={e => setWidthCm(Number(e.target.value))} className="w-full bg-transparent font-bold text-lg outline-none text-gray-800"/><span className="text-xs font-bold text-gray-400 mb-1">cm</span></div>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden group">
                                        <span className="text-[9px] text-gray-400 font-bold block flex items-center gap-1">ALTURA RAPPORT</span>
                                        <div className="flex items-end gap-1"><input type="number" value={heightCm} onChange={e => setHeightCm(Number(e.target.value))} className="w-full bg-transparent font-bold text-lg outline-none text-gray-800"/><span className="text-xs font-bold text-gray-400 mb-1">cm</span></div>
                                    </div>
                                </div>
                                <div className="flex bg-gray-50 rounded-lg p-1 gap-1 mb-3">
                                    {[72, 150, 300].map(val => (
                                        <button key={val} onClick={() => setDpi(val as any)} className={`flex-1 py-1.5 rounded text-[10px] font-bold ${dpi === val ? 'bg-white text-vingi-900 shadow-sm' : 'text-gray-400'}`}>{val}</button>
                                    ))}
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-[9px] font-bold text-gray-400 block mb-1">TIPO DE ENCAIXE</span>
                                        <div className="flex bg-white rounded-lg border border-gray-200 p-1 gap-1">
                                            {[{ id: 'Straight', label: 'Alinhado', icon: Grid3X3 }, { id: 'Half-Drop', label: 'Meio-Salto', icon: AlignVerticalSpaceAround }, { id: 'Mirror', label: 'Espelhado', icon: Spline }].map(t => (
                                                <button key={t.id} onClick={() => setRepeatType(t.id as any)} className={`flex-1 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${repeatType === t.id ? 'bg-vingi-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}><t.icon size={14}/>{t.label}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: ESTILO & COR */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Palette size={14} className="text-vingi-500"/> Direção Criativa
                                </h3>
                                
                                <div className="flex gap-2 mb-3">
                                    {['Corrida', 'Barrada', 'Localizada'].map((type) => (
                                        <button key={type} onClick={() => setLayoutType(type as any)} className={`flex-1 py-2 rounded-lg border text-[10px] font-bold transition-all ${layoutType === type ? 'bg-vingi-900 text-white border-vingi-900 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{type}</button>
                                    ))}
                                </div>
                                
                                {/* PROMPT AREA */}
                                <div className="relative">
                                     {creationMode === 'TEXT' && (
                                         <div className="flex justify-between items-center mb-1 px-1">
                                             <span className="text-[9px] font-bold text-gray-400 uppercase">Descrição</span>
                                             <button 
                                                onClick={handlePromptEnhance}
                                                disabled={isEnhancingPrompt}
                                                className="flex items-center gap-1 text-[9px] font-bold text-vingi-600 bg-vingi-50 px-2 py-1 rounded-md hover:bg-vingi-100 transition-colors disabled:opacity-50"
                                             >
                                                {isEnhancingPrompt ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>}
                                                OTIMIZAR COM IA
                                             </button>
                                         </div>
                                     )}
                                    <textarea 
                                        value={userInstruction}
                                        onChange={(e) => setUserInstruction(e.target.value)}
                                        placeholder={creationMode === 'TEXT' ? "Ex: Floral tropical aquarela com fundo preto..." : "Instruções adicionais..."}
                                        className={`w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs resize-none focus:border-vingi-500 focus:bg-white outline-none transition-all mb-4 ${creationMode === 'TEXT' ? 'h-32 border-vingi-200 shadow-inner' : 'h-20'}`}
                                    />
                                </div>
                                
                                {creationMode === 'IMAGE' && (
                                    <div className="mb-4">
                                         <label className="text-[9px] font-bold text-gray-400 uppercase flex justify-between items-center mb-1">DNA Técnico (IA)</label>
                                         <textarea value={technicalPrompt} onChange={(e) => setTechnicalPrompt(e.target.value)} className="w-full h-16 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600 resize-none outline-none"/>
                                    </div>
                                )}

                                {creationMode === 'IMAGE' && (
                                    <div className="space-y-2 animate-fade-in bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1"><Droplets size={10}/> Calibração de Cor</span>
                                            {isAnalyzingColors && <Loader2 size={10} className="animate-spin text-vingi-500"/>}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mb-3">
                                             <button onClick={() => referenceImage && analyzeColors(referenceImage, 'VIVID')} className={`py-2 border rounded-lg text-[10px] font-bold ${activeColorMode === 'VIVID' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Mais Vivo</button>
                                             <button onClick={() => referenceImage && analyzeColors(referenceImage, 'PASTEL')} className={`py-2 border rounded-lg text-[10px] font-bold ${activeColorMode === 'PASTEL' ? 'bg-pink-500 text-white' : 'bg-white'}`}>Pastel</button>
                                             <button onClick={() => referenceImage && analyzeColors(referenceImage, 'DARK')} className={`py-2 border rounded-lg text-[10px] font-bold ${activeColorMode === 'DARK' ? 'bg-gray-800 text-white' : 'bg-white'}`}>Escuro</button>
                                        </div>
                                        {colorData && (
                                            <div className="grid grid-cols-4 gap-2">
                                                {colorData.colors.map((c, i) => <PantoneChip key={i} color={c}/>)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {!isGenerating && !isEnhancing && (
                                <button 
                                    onClick={handleGenerate}
                                    className="w-full py-4 bg-gradient-to-r from-vingi-900 to-gray-800 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 text-sm mt-4 border border-gray-700"
                                >
                                    <Wand2 size={18} className="text-purple-300"/>
                                    {generatedPattern ? 'REPROCESSAR ESTAMPA' : (creationMode === 'TEXT' ? 'CRIAR ESTAMPA (TEXTO)' : 'RENDERIZAR (GPU)')}
                                </button>
                            )}

                            {generatedPattern && !isGenerating && !isEnhancing && (
                                <div className="space-y-2 animate-slide-up">
                                    {!isEnhanced && (
                                        <button onClick={handleEnhance} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white border border-emerald-600 rounded-xl font-bold flex items-center justify-center gap-2 text-xs hover:shadow-lg transition-all"><Hammer size={14}/> MAGIC POLISH</button>
                                    )}
                                    <button onClick={() => handleTransfer('MOCKUP')} className="w-full py-3 bg-white text-vingi-700 border border-gray-200 rounded-xl font-bold flex items-center justify-center gap-2 text-xs hover:bg-gray-50"><Settings2 size={14}/> PROVAR NO MOCKUP</button>
                                    <button onClick={() => handleTransfer('LAYER')} className="w-full py-3 bg-purple-50 text-purple-700 border border-purple-100 rounded-xl font-bold flex items-center justify-center gap-2 text-xs hover:bg-purple-100"><Layers size={14}/> SEPARAR CAMADAS (IA)</button>
                                    <button onClick={() => { const l = document.createElement('a'); l.href = generatedPattern!; l.download = 'vingi-pattern-master.png'; l.click(); }} className="w-full py-3 bg-gray-900 text-white border border-black rounded-xl font-bold flex items-center justify-center gap-2 text-xs hover:bg-gray-800"><Download size={14}/> BAIXAR ARQUIVO TIFF</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
