
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Loader2, Layers, Grid3X3, ArrowDownToLine, Check, Printer, Brush, Info, Settings2, Ruler, Scroll, Maximize, FileWarning, Zap, Grip, AlignVerticalSpaceAround, Spline } from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader, FloatingReference } from '../components/Shared';

// --- HELPERS ---
const triggerTransfer = (targetModule: string, imageData: string) => {
    if (targetModule === 'MOCKUP') localStorage.setItem('vingi_mockup_pattern', imageData);
    if (targetModule === 'LAYER') localStorage.setItem('vingi_layer_studio_source', imageData);
    window.dispatchEvent(new CustomEvent('vingi_transfer', { 
        detail: { module: targetModule, timestamp: Date.now() } 
    }));
};

// --- COMPONENTE PANTONE PRO ---
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

// --- PRESETS DE INDÚSTRIA (DIGITAL & SUBLIMAÇÃO) ---
const SIZE_PRESETS = [
    { label: "Rapport 64", w: 64, h: 64, desc: "Padrão Indústria (Sem emenda)" },
    { label: "Rapport 32", w: 32, h: 32, desc: "Mini-Rapport (Fluido)" },
    { label: "Digital 145", w: 145, h: 100, desc: "Largura Útil (Sublimação)" },
    { label: "Painel Localizado", w: 100, h: 140, desc: "Canga/Lenço (Sem repetição)" }
];

// --- ATELIER SYSTEM ---
interface AtelierSystemProps {
    onNavigateToMockup?: () => void;
    onNavigateToLayerStudio?: () => void;
}

const GENERATION_STEPS = [
    "Inicializando Atelier Digital...",
    "Calculando Encaixe de RIP...",
    "Otimizando para Impressão Digital...",
    "Aplicando Textura Vetorial 4K...",
    "Calibrando Cores (CMYK/RGB)...",
    "Finalizando Renderização..."
];

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    // Assets
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    
    // Data
    const [colorData, setColorData] = useState<{ harmony: string, suggestion: string, colors: PantoneColor[] } | null>(null);
    const [technicalPrompt, setTechnicalPrompt] = useState<string>('');
    
    // Engenharia Têxtil (Novos Estados)
    const [layoutType, setLayoutType] = useState<'Corrida' | 'Barrada' | 'Localizada'>('Corrida');
    const [repeatType, setRepeatType] = useState<'Straight' | 'Half-Drop' | 'Mirror'>('Straight');
    const [widthCm, setWidthCm] = useState<number>(64);
    const [heightCm, setHeightCm] = useState<number>(64);
    const [dpi, setDpi] = useState<72 | 150 | 300>(300);
    const [fabricSim, setFabricSim] = useState<'None' | 'Cotton' | 'Silk' | 'Linen'>('None');
    const [selvedgeInfo, setSelvedgeInfo] = useState(true); // Exibir info de ourela

    const [userInstruction, setUserInstruction] = useState<string>('');
    
    // State
    const [isGenerating, setIsGenerating] = useState(false);
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

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setReferenceImage(ev.target?.result as string);
                setGeneratedPattern(null);
                setColorData(null);
                setError(null);
                // Reset defaults on new image
                setDpi(300);
                setWidthCm(64);
                setHeightCm(64);
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
            const compressedBase64 = referenceImage.split(',')[1];

            // 1. Parallel Analysis
            const [descRes] = await Promise.all([
                fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'DESCRIBE_PATTERN', mainImageBase64: compressedBase64, mainMimeType: 'image/jpeg' }),
                    signal: controller.signal
                })
            ]);

            const descData = await descRes.json();
            if (!descData.success) throw new Error("Falha na análise inicial.");

            const detectedColors = descData.colors || [];
            const aiPrompt = descData.prompt;

            setColorData({ 
                colors: detectedColors, 
                harmony: "Paleta Extraída", 
                suggestion: "Cores calibradas." 
            });
            setTechnicalPrompt(aiPrompt);

            // 2. Generation Payload
            const finalPrompt = userInstruction 
                ? `${userInstruction}. Visual Base: ${aiPrompt}` 
                : aiPrompt;

            const genRes = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: finalPrompt,
                    colors: detectedColors,
                    textileSpecs: {
                        layout: layoutType,
                        repeat: repeatType, // NOVO: TIPO DE ENCAIXE
                        width: widthCm, 
                        height: heightCm, 
                        dpi: dpi,
                        styleGuide: dpi >= 300 ? "Vector, Sharp Edges, 8K" : "Standard Print",
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
        triggerTransfer(target, generatedPattern);
        if (target === 'MOCKUP' && onNavigateToMockup) onNavigateToMockup();
        if (target === 'LAYER' && onNavigateToLayerStudio) onNavigateToLayerStudio();
    };

    const getFabricOverlay = () => {
        switch(fabricSim) {
            case 'Cotton': return 'url("https://www.transparenttextures.com/patterns/canvas-orange.png")';
            case 'Linen': return 'url("https://www.transparenttextures.com/patterns/black-linen.png")';
            case 'Silk': return 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.1) 100%)'; // Fake sheen
            default: return 'none';
        }
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
                // EMPTY STATE
                <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
                    <div onClick={() => fileInputRef.current?.click()} className="w-full max-w-lg h-80 bg-white rounded-3xl border-2 border-dashed border-gray-300 hover:border-vingi-500 hover:bg-vingi-50/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-6 group shadow-sm hover:shadow-xl">
                        <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" />
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                            <UploadCloud size={32} className="text-gray-400 group-hover:text-vingi-500"/>
                        </div>
                        <div className="text-center px-8">
                            <h3 className="text-xl font-bold text-gray-700">Atelier Têxtil Digital</h3>
                            <p className="text-sm text-gray-400 mt-2">Carregue um desenho ou moodboard. A IA irá criar o rapport digital em alta resolução.</p>
                        </div>
                    </div>
                </div>
            ) : (
                // WORKSPACE
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    
                    {/* LEFT PANEL: ENGINEERING CONTROLS */}
                    <div className="w-full lg:w-[400px] bg-white border-r border-gray-200 flex flex-col z-20 shadow-xl lg:h-full overflow-y-auto custom-scrollbar">
                        <div className="p-5 space-y-6 pb-20">
                            
                            {/* SECTION 1: DIMENSÕES & SUBSTRATO */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Ruler size={14} className="text-vingi-500"/> Dimensões Digitais
                                </h3>
                                
                                {/* Info Ourela */}
                                {selvedgeInfo && (
                                    <div className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded text-[10px] text-blue-700 flex items-start gap-2">
                                        <Info size={14} className="shrink-0 mt-0.5"/>
                                        <div>
                                            <strong>Digital:</strong> Altura = Sentido do Rolo. Largura = Largura Útil da Impressora.
                                        </div>
                                        <button onClick={() => setSelvedgeInfo(false)} className="ml-auto"><Settings2 size={12}/></button>
                                    </div>
                                )}

                                {/* Inputs Dimensões */}
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

                                {/* Presets Rápidos */}
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    {SIZE_PRESETS.map((p) => (
                                        <button 
                                            key={p.label}
                                            onClick={() => { setWidthCm(p.w); setHeightCm(p.h); }}
                                            className="px-2 py-1.5 bg-white border border-gray-200 rounded hover:border-vingi-300 hover:bg-vingi-50 text-left transition-all"
                                        >
                                            <span className="block text-[10px] font-bold text-gray-700">{p.label}</span>
                                            <span className="block text-[8px] text-gray-400">{p.w}x{p.h}cm • {p.desc}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* ENCAIXE & RESOLUÇÃO */}
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-[9px] font-bold text-gray-400 block mb-1">TIPO DE ENCAIXE (RAPPORT DIGITAL)</span>
                                        <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                                            <button 
                                                onClick={() => setRepeatType('Straight')}
                                                className={`flex-1 py-1.5 rounded text-[10px] font-bold flex flex-col items-center gap-1 ${repeatType === 'Straight' ? 'bg-vingi-900 text-white shadow' : 'text-gray-400 hover:bg-gray-50'}`}
                                            >
                                                <Grid3X3 size={14}/> Corrido
                                            </button>
                                            <button 
                                                onClick={() => setRepeatType('Half-Drop')}
                                                className={`flex-1 py-1.5 rounded text-[10px] font-bold flex flex-col items-center gap-1 ${repeatType === 'Half-Drop' ? 'bg-vingi-900 text-white shadow' : 'text-gray-400 hover:bg-gray-50'}`}
                                            >
                                                <AlignVerticalSpaceAround size={14}/> Meio-Salto
                                            </button>
                                            <button 
                                                onClick={() => setRepeatType('Mirror')}
                                                className={`flex-1 py-1.5 rounded text-[10px] font-bold flex flex-col items-center gap-1 ${repeatType === 'Mirror' ? 'bg-vingi-900 text-white shadow' : 'text-gray-400 hover:bg-gray-50'}`}
                                            >
                                                <Spline size={14}/> Espelho
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <span className="text-[9px] font-bold text-gray-400 block mb-1">RESOLUÇÃO</span>
                                            <select 
                                                value={dpi} 
                                                onChange={(e) => setDpi(Number(e.target.value) as any)}
                                                className="w-full bg-white border border-gray-200 rounded-lg text-xs font-bold p-2 outline-none"
                                            >
                                                <option value={150}>150 dpi (Padrão)</option>
                                                <option value={300}>300 dpi (Alta)</option>
                                                <option value={72}>72 dpi (Draft)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-bold text-gray-400 block mb-1">SUBSTRATO</span>
                                            <select 
                                                value={fabricSim} 
                                                onChange={(e) => setFabricSim(e.target.value as any)}
                                                className="w-full bg-white border border-gray-200 rounded-lg text-xs font-bold p-2 outline-none"
                                            >
                                                <option value="None">Nenhum</option>
                                                <option value="Cotton">Algodão (DTF)</option>
                                                <option value="Linen">Linho (Sub)</option>
                                                <option value="Silk">Seda (Digital)</option>
                                            </select>
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
                                            className={`flex-1 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${layoutType === type ? 'bg-vingi-900 text-white border-vingi-900' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>

                                <textarea 
                                    value={userInstruction}
                                    onChange={(e) => setUserInstruction(e.target.value)}
                                    placeholder="Prompt do Estilista: Descreva alterações no desenho (ex: 'Aumentar contraste', 'Adicionar textura de aquarela', 'Fundo azul marinho')..."
                                    className="w-full h-24 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs resize-none focus:border-vingi-500 focus:bg-white outline-none transition-all mb-4"
                                />

                                {colorData && (
                                    <div className="space-y-2 animate-fade-in">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Cartela Detectada</span>
                                            <span className="text-[9px] text-vingi-500 bg-vingi-50 px-2 py-0.5 rounded-full">{colorData.colors.length} cores</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {colorData.colors.map((c, i) => <PantoneChip key={i} color={c}/>)}
                                        </div>
                                    </div>
                                )}
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

                            {/* ACTIONS (POST-GENERATION) */}
                            {generatedPattern && !isGenerating && (
                                <div className="space-y-2 animate-slide-up">
                                    <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex items-center gap-3 mb-2">
                                        <Check size={16} className="text-green-600"/>
                                        <div className="text-[10px] text-green-800">
                                            <strong>Pronto para RIP (Digital):</strong><br/>
                                            {widthCm}x{heightCm}cm @ {dpi}dpi ({repeatType})
                                        </div>
                                    </div>
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
                    <div className="flex-1 bg-slate-900 relative flex items-center justify-center overflow-hidden">
                         {/* Grid Background */}
                         <div className="absolute inset-0 opacity-10 bg-[linear-gradient(#ffffff_1px,transparent_1px),linear-gradient(90deg,#ffffff_1px,transparent_1px)] bg-[size:20px_20px]"></div>

                         {isGenerating ? (
                             <div className="text-center relative z-10 p-8 max-w-sm">
                                 <Loader2 size={48} className="text-vingi-400 animate-spin mx-auto mb-6"/>
                                 <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">{GENERATION_STEPS[genStep]}</h2>
                                 <p className="text-slate-400 text-sm">A GPU está gerando o arquivo digital...</p>
                                 <div className="mt-8 w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                                     <div className="h-full bg-vingi-500 animate-progress-indeterminate"></div>
                                 </div>
                             </div>
                         ) : (
                             generatedPattern ? (
                                <div className="relative w-full h-full p-8 flex items-center justify-center group overflow-hidden">
                                     {/* CONTAINER COM OVERLAY DE SUBSTRATO */}
                                     <div className="relative shadow-2xl rounded-sm border border-white/10 max-w-full max-h-full">
                                         <img src={generatedPattern} className="max-w-full max-h-full object-contain block" />
                                         {/* Texture Overlay */}
                                         {fabricSim !== 'None' && (
                                             <div 
                                                className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-50 z-10"
                                                style={{ backgroundImage: getFabricOverlay() }}
                                             ></div>
                                         )}
                                         {/* Sheen for Silk */}
                                         {fabricSim === 'Silk' && (
                                              <div 
                                                className="absolute inset-0 pointer-events-none mix-blend-screen opacity-30 z-20"
                                                style={{ backgroundImage: getFabricOverlay() }}
                                             ></div>
                                         )}
                                     </div>
                                     
                                     <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[10px] font-mono border border-white/10 flex items-center gap-2">
                                         <Printer size={10}/> {widthCm}x{heightCm}cm | {dpi} DPI | {repeatType}
                                     </div>
                                </div>
                             ) : (
                                <div className="text-center opacity-30 select-none pointer-events-none">
                                    <Grid3X3 size={64} className="mx-auto mb-4 text-white"/>
                                    <p className="text-white text-sm font-medium">Área de Renderização 4K</p>
                                    <p className="text-slate-500 text-xs mt-1">Configure as dimensões à esquerda</p>
                                </div>
                             )
                         )}

                         {error && (
                             <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold flex items-center gap-2 animate-bounce-subtle">
                                 <FileWarning size={14}/> {error}
                             </div>
                         )}
                    </div>

                </div>
            )}
        </div>
    );
};
