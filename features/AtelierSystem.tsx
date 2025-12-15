
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Loader2, Layers, Grid3X3, ArrowDownToLine, Check, Printer, Brush, Info, Settings2, Ruler, Scroll, Maximize, FileWarning, Zap, Grip, AlignVerticalSpaceAround, Spline, RefreshCw, Droplets, Sun, Moon, Contrast, Sparkles } from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader, FloatingReference, ModuleLandingPage } from '../components/Shared';

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

const PantoneChip: React.FC<{ color: PantoneColor }> = ({ color }) => (
    <div className="flex flex-col bg-white shadow-sm border border-gray-200 rounded-md overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-20 w-full group">
        <div className="h-12 w-full relative" style={{ backgroundColor: color.hex }}>
             <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity bg-white mix-blend-overlay"></div>
        </div>
        <div className="p-1.5 flex flex-col justify-center h-8 bg-white">
            <span className="text-[9px] font-bold text-gray-800 truncate leading-none mb-0.5">{color.name}</span>
            <div className="flex justify-between items-center">
                <span className="text-[7px] text-gray-500 font-mono">{color.code}</span>
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
    "Inicializando Atelier Digital...",
    "Calculando Encaixe de RIP...",
    "Aplicando Estética Vetorial Rica...",
    "Renderizando Detalhes Artísticos...",
    "Calibrando Cores...",
    "Finalizando Arquivo..."
];

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    // Assets
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    
    // Data
    const [colorData, setColorData] = useState<{ harmony: string, suggestion: string, colors: PantoneColor[] } | null>(null);
    const [technicalPrompt, setTechnicalPrompt] = useState<string>('');
    const [activeColorMode, setActiveColorMode] = useState<'NATURAL' | 'VIVID' | 'PASTEL' | 'DARK'>('NATURAL');
    
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
    const [isAnalyzingColors, setIsAnalyzingColors] = useState(false);
    const [genStep, setGenStep] = useState(0);
    const [error, setError] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // --- INITIALIZATION ---
    useEffect(() => {
        const transferImage = localStorage.getItem('vingi_transfer_image');
        if (transferImage) {
            setReferenceImage(transferImage);
            localStorage.removeItem('vingi_transfer_image');
            analyzeColors(transferImage, 'NATURAL');
        }
    }, []);

    // Animation Loop
    useEffect(() => {
        let interval: any;
        if (isGenerating) {
            setGenStep(0);
            interval = setInterval(() => { setGenStep(p => (p + 1) % GENERATION_STEPS.length); }, 1500);
        }
        return () => clearInterval(interval);
    }, [isGenerating]);

    // Independent Color Analysis
    const analyzeColors = async (imgBase64: string, variation: 'NATURAL' | 'VIVID' | 'PASTEL' | 'DARK') => {
        setIsAnalyzingColors(true);
        setActiveColorMode(variation); 
        try {
            const compressedBase64 = imgBase64.split(',')[1];
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
                if (!technicalPrompt) setTechnicalPrompt(data.prompt);
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
                setReferenceImage(img);
                setGeneratedPattern(null);
                setColorData(null);
                setError(null);
                setDpi(300);
                setWidthCm(64);
                setHeightCm(64);
                analyzeColors(img, 'NATURAL');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!referenceImage) return;
        setIsGenerating(true);
        setError(null);

        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            // CORREÇÃO: Garante que o prompt nunca esteja vazio
            const safeBasePrompt = technicalPrompt && technicalPrompt.trim() !== "" 
                ? technicalPrompt 
                : "High-end abstract textile pattern, seamless repeat, vector quality";

            const finalPrompt = userInstruction 
                ? `${userInstruction}. Style Base: ${safeBasePrompt}` 
                : safeBasePrompt;

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
                title="Atelier Generativo" 
                subtitle="Impressão Digital & Estamparia"
                referenceImage={referenceImage}
                actionLabel={referenceImage ? "Nova Criação" : undefined}
                onAction={() => { setReferenceImage(null); setGeneratedPattern(null); }}
            />

            {referenceImage && !isGenerating && (
                <FloatingReference image={referenceImage} label="Ref. Original" />
            )}

            {!referenceImage ? (
                // EMPTY STATE (UNIFIED LANDING)
                <>
                    <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" />
                    <ModuleLandingPage 
                        icon={Palette}
                        title="Atelier Têxtil Digital"
                        description="Carregue um desenho ou moodboard. A IA irá criar o rapport digital em alta resolução, com engenharia têxtil aplicada (Half-Drop, Mirror, Barrado)."
                        primaryActionLabel="Iniciar Criação"
                        onPrimaryAction={() => fileInputRef.current?.click()}
                        features={["Vector Like", "4K Resolution", "Seamless", "Color Lab"]}
                        secondaryAction={
                            <div className="h-full flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-2 h-2 rounded-full bg-vingi-500"></span>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dica Profissional</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-left">
                                        <h4 className="text-sm font-bold text-gray-800 mb-1">Prompt Criativo</h4>
                                        <p className="text-xs text-gray-500">Descreva técnicas artísticas (ex: 'Aquarela', 'Óleo sobre tela') para guiar a IA.</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-left">
                                        <h4 className="text-sm font-bold text-gray-800 mb-1">Rapport Automático</h4>
                                        <p className="text-xs text-gray-500">O sistema garante que a estampa se repita perfeitamente em todas as direções.</p>
                                    </div>
                                </div>
                            </div>
                        }
                    />
                </>
            ) : (
                // WORKSPACE
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    
                    {/* LEFT PANEL: ENGINEERING CONTROLS */}
                    <div className="w-full lg:w-[400px] bg-white border-r border-gray-200 flex flex-col z-20 shadow-xl h-[40vh] lg:h-full overflow-y-auto custom-scrollbar shrink-0">
                        <div className="p-5 space-y-6 pb-20">
                            
                            {/* SECTION 1: DIMENSÕES & SUBSTRATO */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Ruler size={14} className="text-vingi-500"/> Dimensões Digitais
                                </h3>
                                
                                {selvedgeInfo && (
                                    <div className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded text-[10px] text-blue-700 flex items-start gap-2">
                                        <Info size={14} className="shrink-0 mt-0.5"/>
                                        <div>
                                            <strong>Digital:</strong> Altura = Sentido do Rolo. Largura = Largura Útil da Impressora.
                                        </div>
                                        <button onClick={() => setSelvedgeInfo(false)} className="ml-auto p-1 hover:bg-blue-100 rounded"><Settings2 size={12}/></button>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden group">
                                        <span className="text-[9px] text-gray-400 font-bold block flex items-center gap-1">
                                            LARGURA ÚTIL <ArrowDownToLine size={8} className="-rotate-90"/>
                                        </span>
                                        <div className="flex items-end gap-1">
                                            <input type="number" value={widthCm} onChange={e => setWidthCm(Number(e.target.value))} className="w-full bg-transparent font-bold text-lg outline-none text-gray-800"/>
                                            <span className="text-xs font-bold text-gray-400 mb-1">cm</span>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden group">
                                        <span className="text-[9px] text-gray-400 font-bold block flex items-center gap-1">
                                            ALTURA RAPPORT <ArrowDownToLine size={8}/>
                                        </span>
                                        <div className="flex items-end gap-1">
                                            <input type="number" value={heightCm} onChange={e => setHeightCm(Number(e.target.value))} className="w-full bg-transparent font-bold text-lg outline-none text-gray-800"/>
                                            <span className="text-xs font-bold text-gray-400 mb-1">cm</span>
                                        </div>
                                    </div>
                                </div>

                                {/* DPI SELECTOR (NOVO) */}
                                <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden group mb-3">
                                    <span className="text-[9px] text-gray-400 font-bold block flex items-center gap-1 mb-2">
                                        RESOLUÇÃO DE SAÍDA (DPI)
                                    </span>
                                    <div className="flex bg-gray-50 rounded-lg p-1 gap-1">
                                        {[72, 150, 300].map(val => (
                                            <button
                                                key={val}
                                                onClick={() => setDpi(val as any)}
                                                className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                                                    dpi === val 
                                                    ? 'bg-white text-vingi-900 shadow-sm ring-1 ring-black/5' 
                                                    : 'text-gray-400 hover:text-gray-600'
                                                }`}
                                            >
                                                {val === 300 && <Sparkles size={8} className={dpi===300?'text-amber-500':''}/>}
                                                {val}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    {SIZE_PRESETS.map((p) => {
                                        const isActive = widthCm === p.w && heightCm === p.h;
                                        return (
                                            <button 
                                                key={p.label}
                                                onClick={() => { setWidthCm(p.w); setHeightCm(p.h); }}
                                                className={`px-3 py-2 rounded-lg border text-left transition-all group relative overflow-hidden ${
                                                    isActive 
                                                    ? 'bg-vingi-900 border-vingi-900 text-white shadow-md ring-1 ring-vingi-700' 
                                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-vingi-300'
                                                }`}
                                            >
                                                {isActive && <div className="absolute top-0 right-0 p-1"><Check size={10} className="text-vingi-400"/></div>}
                                                <span className={`block text-[10px] font-bold ${isActive ? 'text-white' : 'text-gray-800'}`}>{p.label}</span>
                                                <span className={`block text-[8px] ${isActive ? 'text-gray-400' : 'text-gray-400'}`}>{p.w}x{p.h}cm • {p.desc}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <span className="text-[9px] font-bold text-gray-400 block mb-1">TIPO DE ENCAIXE</span>
                                        <div className="flex bg-white rounded-lg border border-gray-200 p-1 gap-1">
                                            {[
                                                { id: 'Straight', label: 'Alinhado', icon: Grid3X3 },
                                                { id: 'Half-Drop', label: 'Meio-Salto', icon: AlignVerticalSpaceAround },
                                                { id: 'Mirror', label: 'Espelhado', icon: Spline }
                                            ].map(t => (
                                                <button 
                                                    key={t.id}
                                                    onClick={() => setRepeatType(t.id as any)}
                                                    className={`flex-1 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${repeatType === t.id ? 'bg-vingi-900 text-white shadow-md ring-2 ring-offset-1 ring-vingi-900' : 'text-gray-500 hover:bg-gray-100'}`}
                                                >
                                                    <t.icon size={14}/>
                                                    {t.label}
                                                </button>
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
                                        <button 
                                            key={type}
                                            onClick={() => setLayoutType(type as any)}
                                            className={`flex-1 py-2 rounded-lg border text-[10px] font-bold transition-all ${layoutType === type ? 'bg-vingi-900 text-white border-vingi-900 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>

                                <textarea 
                                    value={userInstruction}
                                    onChange={(e) => setUserInstruction(e.target.value)}
                                    placeholder="Prompt do Estilista..."
                                    className="w-full h-20 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs resize-none focus:border-vingi-500 focus:bg-white outline-none transition-all mb-4"
                                />

                                {/* COLOR TOOLS */}
                                <div className="space-y-2 animate-fade-in bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1"><Droplets size={10}/> Calibração de Cor</span>
                                        {isAnalyzingColors && <Loader2 size={10} className="animate-spin text-vingi-500"/>}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                         <button onClick={() => referenceImage && analyzeColors(referenceImage, 'VIVID')} className={`py-2 border rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${activeColorMode === 'VIVID' ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-offset-1 ring-blue-500' : 'bg-white border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600'}`}>
                                             <Sun size={12}/> Mais Vivo
                                         </button>
                                         <button onClick={() => referenceImage && analyzeColors(referenceImage, 'PASTEL')} className={`py-2 border rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${activeColorMode === 'PASTEL' ? 'bg-pink-500 text-white border-pink-600 shadow-md ring-2 ring-offset-1 ring-pink-400' : 'bg-white border-gray-200 text-gray-600 hover:bg-pink-50 hover:text-pink-600'}`}>
                                             <Brush size={12}/> Pastel
                                         </button>
                                         <button onClick={() => referenceImage && analyzeColors(referenceImage, 'DARK')} className={`py-2 border rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${activeColorMode === 'DARK' ? 'bg-gray-800 text-white border-gray-900 shadow-md ring-2 ring-offset-1 ring-gray-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                                             <Moon size={12}/> Escuro
                                         </button>
                                    </div>
                                    
                                    {colorData && (
                                        <div className="grid grid-cols-4 gap-2">
                                            {colorData.colors.map((c, i) => <PantoneChip key={i} color={c}/>)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* GENERATE BUTTON */}
                            {!isGenerating && (
                                <button 
                                    onClick={handleGenerate}
                                    className="w-full py-4 bg-gradient-to-r from-vingi-900 to-gray-800 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 text-sm mt-4 border border-gray-700"
                                >
                                    <Wand2 size={18} className="text-purple-300"/>
                                    {generatedPattern ? 'REPROCESSAR ESTAMPA' : 'RENDERIZAR (GPU)'}
                                </button>
                            )}

                            {/* POST-GENERATION ACTIONS */}
                            {generatedPattern && !isGenerating && (
                                <div className="space-y-2 animate-slide-up">
                                    <button onClick={() => handleTransfer('MOCKUP')} className="w-full py-3 bg-white text-vingi-700 border border-gray-200 rounded-xl font-bold flex items-center justify-center gap-2 text-xs hover:bg-gray-50 transition-colors shadow-sm">
                                        <Settings2 size={14}/> PROVAR NO MOCKUP
                                    </button>
                                    <button onClick={() => handleTransfer('LAYER')} className="w-full py-3 bg-purple-50 text-purple-700 border border-purple-100 rounded-xl font-bold flex items-center justify-center gap-2 text-xs hover:bg-purple-100 transition-colors">
                                        <Layers size={14}/> SEPARAR CAMADAS (IA)
                                    </button>
                                    <button 
                                        onClick={() => { const l = document.createElement('a'); l.href = generatedPattern!; l.download = 'vingi-pattern-master.png'; l.click(); }}
                                        className="w-full py-3 bg-gray-900 text-white border border-black rounded-xl font-bold flex items-center justify-center gap-2 text-xs hover:bg-gray-800 transition-colors"
                                    >
                                        <Download size={14}/> BAIXAR ARQUIVO TIFF
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: VISUALIZATION */}
                    <div className="flex-1 bg-slate-900 relative flex items-center justify-center overflow-hidden min-w-0">
                         <div className="absolute inset-0 opacity-10 bg-[linear-gradient(#ffffff_1px,transparent_1px),linear-gradient(90deg,#ffffff_1px,transparent_1px)] bg-[size:20px_20px]"></div>

                         {isGenerating ? (
                             <div className="text-center relative z-10 p-8 max-w-sm">
                                 <Loader2 size={48} className="text-vingi-400 animate-spin mx-auto mb-6"/>
                                 <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">{GENERATION_STEPS[genStep]}</h2>
                                 <p className="text-slate-400 text-sm">Gerando arquivo RAW VECTOR...</p>
                                 <div className="mt-8 w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                                     <div className="h-full bg-vingi-500 animate-progress-indeterminate"></div>
                                 </div>
                             </div>
                         ) : (
                             generatedPattern ? (
                                <div className="relative w-full h-full flex flex-col items-center justify-center p-8">
                                     {/* IMAGE CONTAINER */}
                                     <div className="relative shadow-2xl rounded-sm border border-white/10 overflow-hidden group flex justify-center items-center" 
                                          style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}>
                                         
                                         <img src={generatedPattern} className="block w-auto h-auto max-w-full max-h-[85vh] bg-white" style={{ objectFit: 'contain' }} />
                                         
                                         {/* TEXTURE OVERLAY LAYER */}
                                         {textureType !== 'None' && (
                                             <div 
                                                className="absolute inset-0 pointer-events-none z-10 transition-all duration-300"
                                                style={getTextureStyle()}
                                             ></div>
                                         )}
                                     </div>
                                     
                                     {/* TEXTURE CONTROLS (FLOATING) */}
                                     <div className="absolute bottom-4 bg-gray-900/90 backdrop-blur-md px-4 py-3 rounded-xl border border-gray-700 flex items-center gap-4 animate-slide-up z-50">
                                         <div className="flex flex-col gap-1">
                                             <span className="text-[9px] font-bold text-gray-400 uppercase">Acabamento Têxtil</span>
                                             <div className="flex gap-1">
                                                {['None', 'Cotton', 'Linen', 'Silk', 'Canvas'].map(t => (
                                                    <button 
                                                        key={t}
                                                        onClick={() => setTextureType(t as any)}
                                                        className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${textureType === t ? 'bg-vingi-500 text-white shadow-sm' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                                                    >
                                                        {t}
                                                    </button>
                                                ))}
                                             </div>
                                         </div>

                                         {textureType !== 'None' && (
                                             <>
                                                 <div className="w-px h-8 bg-gray-700 mx-2"></div>
                                                 <div className="flex flex-col w-24">
                                                     <span className="text-[9px] font-bold text-gray-400 mb-1 flex justify-between">Opacidade <span>{Math.round(textureOpacity*100)}%</span></span>
                                                     <input type="range" min="0" max="1" step="0.1" value={textureOpacity} onChange={e => setTextureOpacity(parseFloat(e.target.value))} className="h-1 bg-gray-700 rounded-lg appearance-none accent-vingi-500"/>
                                                 </div>
                                                 <div className="flex flex-col gap-1">
                                                     <span className="text-[9px] font-bold text-gray-400">Mix</span>
                                                     <select value={textureBlend} onChange={e => setTextureBlend(e.target.value as any)} className="bg-gray-800 text-white text-[10px] rounded p-1 border border-gray-700 outline-none">
                                                         <option value="multiply">Multiply</option>
                                                         <option value="overlay">Overlay</option>
                                                         <option value="screen">Screen</option>
                                                     </select>
                                                 </div>
                                             </>
                                         )}
                                     </div>

                                     <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[10px] font-mono border border-white/10 z-30">
                                         {widthCm}x{heightCm}cm | {dpi} DPI
                                     </div>
                                </div>
                             ) : (
                                <div className="text-center opacity-30 select-none pointer-events-none">
                                    <Grid3X3 size={64} className="mx-auto mb-4 text-white"/>
                                    <p className="text-white text-sm font-medium">Área de Renderização 4K</p>
                                </div>
                             )
                         )}

                         {error && (
                             <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold flex items-center gap-2 animate-bounce-subtle z-50">
                                 <FileWarning size={14}/> {error}
                             </div>
                         )}
                    </div>

                </div>
            )}
        </div>
    );
};
