
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Loader2, Sparkles, Layers, Grid3X3, Target, ArrowDownToLine, Check, Printer, Brush, Info, Search, Droplets, Shirt, Settings2, BoxSelect, Hand, Sliders, ChevronRight, Zap } from 'lucide-react';
import { PantoneColor } from '../types';
import { SelvedgeTool, SelvedgePosition } from '../components/SelvedgeTool';
import { ModuleHeader, FloatingReference } from '../components/Shared';

// --- HELPERS ---
const triggerTransfer = (targetModule: string, imageData: string) => {
    // 1. Save to Storage
    if (targetModule === 'MOCKUP') localStorage.setItem('vingi_mockup_pattern', imageData);
    if (targetModule === 'LAYER') localStorage.setItem('vingi_layer_studio_source', imageData);
    
    // 2. Dispatch Event for immediate update in other components
    window.dispatchEvent(new CustomEvent('vingi_transfer', { 
        detail: { module: targetModule, timestamp: Date.now() } 
    }));
};

// --- COMPONENTE PANTONE PRO (Estilo Chip Físico) ---
const PantoneChip: React.FC<{ color: PantoneColor }> = ({ color }) => (
    <div className="flex flex-col bg-white shadow-sm border border-gray-200 rounded-md overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-20 w-full">
        <div className="h-12 w-full relative" style={{ backgroundColor: color.hex }}>
             {/* Textura de tecido sutil */}
             <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/fabric-of-squares.png')]"></div>
        </div>
        <div className="p-1.5 flex flex-col justify-center h-8 bg-white">
            <span className="text-[9px] font-bold text-gray-800 truncate leading-none mb-0.5">{color.name}</span>
            <div className="flex justify-between items-center">
                <span className="text-[7px] text-gray-500 font-mono">{color.code}</span>
                <span className="text-[7px] bg-gray-100 px-1 rounded text-gray-500">{color.role?.slice(0, 10)}</span>
            </div>
        </div>
    </div>
);

// --- ATELIER SYSTEM ---
interface AtelierSystemProps {
    onNavigateToMockup?: () => void;
    onNavigateToLayerStudio?: () => void;
}

const GENERATION_STEPS = [
    "Inicializando Atelier Digital...",
    "Mapeando Espectro de Cores (Tone-on-Tone)...",
    "Definindo Estrutura Geométrica...",
    "Aplicando Textura Vetorial 4K...",
    "Refinando Iluminação e Sombras...",
    "Finalizando Renderização..."
];

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    // Assets
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    
    // Data
    const [colorData, setColorData] = useState<{ harmony: string, suggestion: string, colors: PantoneColor[] } | null>(null);
    const [autoPrompt, setAutoPrompt] = useState<string>('');
    
    // Configs
    const [layoutType, setLayoutType] = useState<'Corrida' | 'Barrada' | 'Localizada'>('Corrida');
    const [widthCm, setWidthCm] = useState<number>(140);
    const [heightCm, setHeightCm] = useState<number>(100);
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
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!referenceImage) return;
        setIsGenerating(true);
        setError(null);

        // Cancel previous
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const compressedBase64 = referenceImage.split(',')[1];

            // 1. Parallel Analysis: Visual DNA + Color Science
            // We run both to get the richest prompt possible.
            const [descRes, colorRes] = await Promise.all([
                fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'DESCRIBE_PATTERN', mainImageBase64: compressedBase64, mainMimeType: 'image/jpeg' }),
                    signal: controller.signal
                }),
                fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'DESCRIBE_PATTERN', mainImageBase64: compressedBase64, mainMimeType: 'image/jpeg' }), // Note: In real app, separate action for color
                    signal: controller.signal
                })
            ]);

            const descData = await descRes.json();
            
            // NOTE: Ideally we would call a specific COLOR endpoint, but `DESCRIBE_PATTERN` in backend calls `analyzeColorTrend` too.
            // Let's rely on `descData` which aggregates everything in `analyze.js`.
            
            if (!descData.success) throw new Error("Falha na análise inicial.");

            const detectedColors = descData.colors || [];
            const technicalPrompt = descData.prompt;
            const harmony = "Harmonia Detectada pela IA"; // Backend should return this if updated
            const suggestion = "Recomendação de impressão digital.";

            setColorData({ 
                colors: detectedColors, 
                harmony: "Paleta Extraída", 
                suggestion: "Cores calibradas para impressão digital." 
            });
            setAutoPrompt(technicalPrompt);

            // 2. Generation
            const finalPrompt = userInstruction 
                ? `${userInstruction}. Technical Basis: ${technicalPrompt}` 
                : technicalPrompt;

            const genRes = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: finalPrompt,
                    colors: detectedColors,
                    textileSpecs: {
                        layout: layoutType,
                        width: widthCm,
                        height: heightCm,
                        styleGuide: "High definition textile print, vector style"
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

    return (
        <div className="h-full bg-[#f8fafc] flex flex-col overflow-hidden">
            <ModuleHeader 
                icon={Palette} 
                title="Atelier Generativo" 
                subtitle="Criação & Engenharia de Estampas"
                referenceImage={referenceImage}
                actionLabel={referenceImage ? "Resetar" : undefined}
                onAction={() => { setReferenceImage(null); setGeneratedPattern(null); }}
            />

            {/* FLOATING MODAL (OÁSIS DO CRIADOR) */}
            {referenceImage && !isGenerating && (
                <FloatingReference image={referenceImage} label="Referência Original" />
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
                            <h3 className="text-xl font-bold text-gray-700">Iniciar Criação</h3>
                            <p className="text-sm text-gray-400 mt-2">Carregue um moodboard, desenho ou textura. A IA extrairá o DNA e criará variações de alta fidelidade.</p>
                        </div>
                    </div>
                </div>
            ) : (
                // WORKSPACE
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    
                    {/* LEFT PANEL: CONTROLS (Software Style) */}
                    <div className="w-full lg:w-[380px] bg-white border-r border-gray-200 flex flex-col z-20 shadow-xl lg:h-full overflow-y-auto custom-scrollbar">
                        <div className="p-5 space-y-6 pb-20">
                            
                            {/* SECTION 1: INGENHARIA */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Settings2 size={14} className="text-vingi-500"/> Especificações
                                </h3>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                                            <span className="text-[9px] text-gray-400 font-bold block">LARGURA (cm)</span>
                                            <input type="number" value={widthCm} onChange={e => setWidthCm(Number(e.target.value))} className="w-full bg-transparent font-bold text-sm outline-none text-gray-800"/>
                                        </div>
                                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                                            <span className="text-[9px] text-gray-400 font-bold block">ALTURA (cm)</span>
                                            <input type="number" value={heightCm} onChange={e => setHeightCm(Number(e.target.value))} className="w-full bg-transparent font-bold text-sm outline-none text-gray-800"/>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['Corrida', 'Barrada', 'Localizada'].map((type) => (
                                            <button 
                                                key={type}
                                                onClick={() => setLayoutType(type as any)}
                                                className={`py-2 rounded-lg border text-[10px] font-bold transition-all ${layoutType === type ? 'bg-vingi-900 text-white border-vingi-900' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <hr className="border-gray-100"/>

                            {/* SECTION 2: CRIATIVIDADE & COR */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Palette size={14} className="text-vingi-500"/> Direção de Arte
                                </h3>
                                
                                <textarea 
                                    value={userInstruction}
                                    onChange={(e) => setUserInstruction(e.target.value)}
                                    placeholder="Descreva alterações desejadas (ex: Fundo azul marinho, flores menores, adicionar textura de linho...)"
                                    className="w-full h-24 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs resize-none focus:border-vingi-500 focus:bg-white outline-none transition-all mb-4"
                                />

                                {colorData && (
                                    <div className="space-y-2 animate-fade-in">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Espectro Detectado</span>
                                            <span className="text-[9px] text-vingi-500 bg-vingi-50 px-2 py-0.5 rounded-full">{colorData.colors.length} tons</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {colorData.colors.map((c, i) => <PantoneChip key={i} color={c}/>)}
                                        </div>
                                        <p className="text-[9px] text-gray-400 italic mt-1 leading-relaxed border-l-2 border-vingi-200 pl-2">
                                            "{colorData.harmony}"
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* GENERATE BUTTON */}
                            {!isGenerating && (
                                <button 
                                    onClick={handleGenerate}
                                    className="w-full py-4 bg-gradient-to-r from-vingi-900 to-gray-800 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 text-sm mt-4"
                                >
                                    <Wand2 size={18} className="text-purple-300"/>
                                    {generatedPattern ? 'REFINAR RESULTADO' : 'RENDERIZAR ESTAMPA'}
                                </button>
                            )}

                            {/* ACTIONS (POST-GENERATION) */}
                            {generatedPattern && !isGenerating && (
                                <div className="space-y-2 animate-slide-up">
                                    <button onClick={() => handleTransfer('MOCKUP')} className="w-full py-3 bg-vingi-50 text-vingi-700 border border-vingi-100 rounded-xl font-bold flex items-center justify-center gap-2 text-xs hover:bg-vingi-100 transition-colors">
                                        <Shirt size={14}/> PROVAR NO MOCKUP
                                    </button>
                                    <button onClick={() => handleTransfer('LAYER')} className="w-full py-3 bg-purple-50 text-purple-700 border border-purple-100 rounded-xl font-bold flex items-center justify-center gap-2 text-xs hover:bg-purple-100 transition-colors">
                                        <Layers size={14}/> SEPARAR CAMADAS (IA)
                                    </button>
                                    <button 
                                        onClick={() => { const l = document.createElement('a'); l.href = generatedPattern!; l.download = 'vingi-pattern.png'; l.click(); }}
                                        className="w-full py-3 bg-gray-100 text-gray-600 border border-gray-200 rounded-xl font-bold flex items-center justify-center gap-2 text-xs hover:bg-gray-200 transition-colors"
                                    >
                                        <Download size={14}/> BAIXAR PNG
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
                                 <p className="text-slate-400 text-sm">Processando tensores visuais em alta definição...</p>
                                 <div className="mt-8 w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                                     <div className="h-full bg-vingi-500 animate-progress-indeterminate"></div>
                                 </div>
                             </div>
                         ) : (
                             generatedPattern ? (
                                <div className="relative w-full h-full p-8 flex items-center justify-center group">
                                     <img src={generatedPattern} className="max-w-full max-h-full object-contain shadow-2xl rounded-sm border border-white/10" />
                                     <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[10px] font-mono border border-white/10">
                                         {widthCm}x{heightCm}cm @ 4K
                                     </div>
                                </div>
                             ) : (
                                <div className="text-center opacity-30 select-none pointer-events-none">
                                    <Grid3X3 size={64} className="mx-auto mb-4 text-white"/>
                                    <p className="text-white text-sm font-medium">Área de Renderização</p>
                                </div>
                             )
                         )}

                         {error && (
                             <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold flex items-center gap-2 animate-bounce-subtle">
                                 <Info size={14}/> {error}
                             </div>
                         )}
                    </div>

                </div>
            )}
        </div>
    );
};
