import React, { useState, useRef, useEffect } from 'react';
import { 
    Palette, Wand2, Download, UploadCloud, RefreshCw, 
    Layers, Image as ImageIcon, Sparkles, 
    Check, X, Loader2, Settings2, Sliders, Brush, 
    Scissors, Ruler, Droplets, Info, Shirt, AlertCircle, 
    ArrowRight, Share2, Globe, Archive, BrainCircuit
} from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader, ModuleLandingPage, SmartImageViewer } from '../components/Shared';

/**
 * ATELIER SYSTEM PRO v7.0
 * Advanced Generative Textile Studio
 */

interface AtelierSystemProps {
    onNavigateToMockup: () => void;
    onNavigateToLayerStudio: () => void;
}

// Utility for image compression before AI processing
const compressImage = (base64Str: string, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
    });
};

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ 
    onNavigateToMockup, 
    onNavigateToLayerStudio 
}) => {
    // Component state management
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [creationMode, setCreationMode] = useState<'PROMPT' | 'IMAGE'>('IMAGE');
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [userPrompt, setUserPrompt] = useState('');
    const [customInstruction, setCustomInstruction] = useState('');
    const [colors, setColors] = useState<PantoneColor[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const [printTechnique, setPrintTechnique] = useState<'DIGITAL' | 'CYLINDER'>('DIGITAL');
    
    // Technical Parameters
    const [selvedge, setSelvedge] = useState('Inferior');
    const [colorCount, setColorCount] = useState(8);
    const [layoutStyle, setLayoutStyle] = useState('ORIGINAL');
    const [subLayoutStyle, setSubLayoutStyle] = useState('');
    const [artStyle, setArtStyle] = useState('ORIGINAL');
    const [targetSize, setTargetSize] = useState('PADRAO');
    const [customStyle, setCustomStyle] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Deep link from other modules via localStorage
    useEffect(() => {
        const transferImg = localStorage.getItem('vingi_transfer_image');
        if (transferImg) {
            handleReferenceUpload(transferImg);
            localStorage.removeItem('vingi_transfer_image');
        }
    }, []);

    // Process uploaded reference image to extract DNA and color trends
    const handleReferenceUpload = async (imgBase64: string) => {
        setReferenceImage(imgBase64); 
        setCreationMode('IMAGE'); 
        setIsProcessing(true); 
        setError(null);
        try {
            setStatusMessage("Analisando DNA Estético...");
            const compressed = await compressImage(imgBase64); 
            const cleanBase64 = compressed.split(',')[1];
            
            setStatusMessage("Mapeando Movimento Artístico...");
            const resPrompt = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ action: 'ANALYZE_REFERENCE_FOR_PROMPT', mainImageBase64: cleanBase64 }) 
            });
            const dataPrompt = await resPrompt.json();
            if (dataPrompt.success && dataPrompt.prompt) setUserPrompt(dataPrompt.prompt);
            
            setStatusMessage("Colorimetria Sênior Pantone...");
            const resColors = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ action: 'ANALYZE_COLOR_TREND', mainImageBase64: cleanBase64, variation: 'NATURAL' }) 
            });
            const dataColors = await resColors.json();
            if (dataColors.success && dataColors.colors) setColors(dataColors.colors);
            
            setStatusMessage("Estúdio Digital Pronto.");
            await new Promise(resolve => setTimeout(resolve, 800));
        } catch (e) { 
            console.error(e); 
            setError("Erro ao analisar imagem."); 
        } finally { 
            setIsProcessing(false); 
        }
    };

    // Trigger AI pattern generation
    const handleGenerate = async () => {
        if (!userPrompt.trim() && creationMode === 'IMAGE') { 
            setError("Aguarde a análise da referência ou digite um prompt."); 
            return; 
        }

        const finalPrompt = customInstruction 
            ? `USER DIRECTIVE: "${customInstruction}". \nBASE DESCRIPTION: ${userPrompt || 'Custom textile design'}` 
            : userPrompt;

        setIsProcessing(true); 
        setStatusMessage(printTechnique === 'DIGITAL' ? "Elevando Estética: Rendering Masterpiece..." : "Gerando Engenharia de Cilindro...");
        setGeneratedPattern(null); 
        setError(null); 
        setShowDownloadMenu(false);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'GENERATE_PATTERN',
                    prompt: finalPrompt,
                    colors,
                    selvedge,
                    technique: printTechnique,
                    colorCount,
                    layoutStyle,
                    subLayoutStyle,
                    artStyle,
                    targetSize,
                    customStyle
                })
            });
            
            const data = await response.json();
            if (data.success && data.image) {
                setGeneratedPattern(data.image);
                setStatusMessage("Sincronização Têxtil Completa.");
            } else {
                throw new Error(data.error || "O motor de geração falhou.");
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Erro crítico no motor VINGI GEN-AI.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const res = ev.target?.result as string;
                if (res) handleReferenceUpload(res);
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerTransfer = (targetModule: string, imageData: string) => {
        if (targetModule === 'MOCKUP') {
            localStorage.setItem('vingi_mockup_pattern', imageData);
            onNavigateToMockup();
        } else if (targetModule === 'LAYER_STUDIO') {
            onNavigateToLayerStudio();
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto relative custom-scrollbar">
            <ModuleHeader 
                icon={Palette} 
                title="Estúdio de Criação" 
                subtitle="Design Generativo de Superfície"
                onAction={referenceImage ? () => { setReferenceImage(null); setGeneratedPattern(null); setUserPrompt(''); setCustomInstruction(''); setColors([]); } : undefined}
                actionLabel="Novo Projeto"
                referenceImage={referenceImage}
            />

            <div className="flex-1 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

                {!referenceImage && !generatedPattern && !isProcessing && (
                    <ModuleLandingPage 
                        icon={Palette}
                        title="Atelier Digital AI"
                        description="Suite industrial de criação de estampas. Gere variantes vetoriais de alta fidelidade a partir de referências visuais ou prompts técnicos."
                        primaryActionLabel="Subir Referência"
                        onPrimaryAction={() => fileInputRef.current?.click()}
                        features={["Evolução Estética SAM-X", "Separação de Cores Pantone", "Engenharia de Repetição", "Exportação 4K"]}
                        partners={["VINGI AI ENGINE", "PANTONE TCX", "WGSN", "ADOBE"]}
                    />
                )}

                {(referenceImage || generatedPattern || isProcessing) && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                        {/* Editor Controls */}
                        <div className="lg:col-span-4 space-y-6">
                            <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100/50">
                                <div className="flex items-center gap-2 mb-6 border-b border-gray-50 pb-4">
                                    <Settings2 size={16} className="text-vingi-600"/>
                                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Painel de Engenharia</h3>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <BrainCircuit size={12}/> Técnica de Impressão
                                        </label>
                                        <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                                            <button 
                                                onClick={() => setPrintTechnique('DIGITAL')}
                                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${printTechnique === 'DIGITAL' ? 'bg-vingi-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                Digital Pro
                                            </button>
                                            <button 
                                                onClick={() => setPrintTechnique('CYLINDER')}
                                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${printTechnique === 'CYLINDER' ? 'bg-vingi-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                Rotativa
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Diretiva Criativa (Prompt)</label>
                                        <textarea 
                                            value={customInstruction}
                                            onChange={(e) => setCustomInstruction(e.target.value)}
                                            placeholder="Descreva as alterações ou o estilo desejado..."
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-medium outline-none focus:border-vingi-500 focus:bg-white h-32 resize-none transition-all shadow-inner"
                                        />
                                    </div>

                                    {colors.length > 0 && (
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Paleta Detectada (Pantone)</label>
                                            <div className="grid grid-cols-5 gap-2">
                                                {colors.slice(0, 10).map((c, i) => (
                                                    <div key={i} className="group relative">
                                                        <div className="w-full aspect-square rounded-lg border border-gray-100 shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: c.hex }} />
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-[8px] font-mono rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                                            {c.code}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button 
                                        onClick={handleGenerate}
                                        disabled={isProcessing}
                                        className="w-full py-5 bg-vingi-900 text-white rounded-2xl font-black text-xs shadow-2xl hover:bg-black transition-all transform active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-[0.2em]"
                                    >
                                        {isProcessing ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18} className="text-vingi-400"/>}
                                        {generatedPattern ? 'Gerar Evolução' : 'Iniciar Renderização'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Preview Area */}
                        <div className="lg:col-span-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Input Reference */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2"><Archive size={12}/> Entrada Têxtil</h4>
                                    <div className="aspect-square bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-xl group relative">
                                        {referenceImage ? (
                                            <SmartImageViewer src={referenceImage} className="w-full h-full" />
                                        ) : (
                                            <div onClick={() => fileInputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                                                <UploadCloud size={48} className="text-gray-200 mb-4"/>
                                                <p className="text-[10px] font-black text-gray-300 uppercase">Subir Arquivo</p>
                                            </div>
                                        )}
                                        {referenceImage && (
                                            <button onClick={() => fileInputRef.current?.click()} className="absolute top-4 right-4 p-3 bg-white/90 backdrop-blur rounded-full shadow-lg text-gray-400 hover:text-vingi-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <RefreshCw size={16}/>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Output Result */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2"><Sparkles size={12}/> Saída Renderizada</h4>
                                    <div className="aspect-square bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-2xl relative flex items-center justify-center group">
                                        {generatedPattern ? (
                                            <>
                                                <SmartImageViewer src={generatedPattern} className="w-full h-full" />
                                                <div className="absolute bottom-6 right-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0">
                                                    <button onClick={() => triggerTransfer('MOCKUP', generatedPattern)} className="bg-white text-vingi-900 px-4 py-3 rounded-2xl shadow-2xl hover:bg-vingi-50 transition-all border border-gray-100 flex items-center gap-2 text-[10px] font-black uppercase">
                                                        <Shirt size={16}/> Provador
                                                    </button>
                                                    <button onClick={() => triggerTransfer('LAYER_STUDIO', generatedPattern)} className="bg-white text-vingi-900 px-4 py-3 rounded-2xl shadow-2xl hover:bg-vingi-50 transition-all border border-gray-100 flex items-center gap-2 text-[10px] font-black uppercase">
                                                        <Layers size={16}/> Editor
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center p-8 w-full h-full flex items-center justify-center bg-gray-50/50">
                                                {isProcessing ? (
                                                    <div className="space-y-6">
                                                        <div className="relative">
                                                            <div className="absolute inset-0 bg-vingi-500 blur-2xl opacity-20 animate-pulse"></div>
                                                            <Loader2 size={48} className="animate-spin text-vingi-500 mx-auto relative z-10" />
                                                        </div>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">{statusMessage}</p>
                                                    </div>
                                                ) : (
                                                    <div className="opacity-10">
                                                        <ImageIcon size={80} className="mx-auto mb-4"/>
                                                        <p className="text-sm font-black uppercase tracking-widest">Aguardando IA</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="p-6 bg-red-50 border border-red-100 rounded-[24px] flex items-center gap-4 text-red-600 text-xs font-bold animate-slide-up shadow-sm">
                                    <div className="bg-red-100 p-2 rounded-full"><AlertCircle size={20}/></div>
                                    <div>
                                        <p className="text-[10px] uppercase font-black mb-0.5">Falha no Processamento</p>
                                        <p>{error}</p>
                                    </div>
                                </div>
                            )}

                            {generatedPattern && !isProcessing && (
                                <div className="p-8 bg-blue-600 rounded-[40px] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-blue-500/20">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-white/10 rounded-[24px] flex items-center justify-center backdrop-blur-md">
                                            <Sparkles size={32} className="text-blue-200"/>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black uppercase tracking-tighter">Estampa Finalizada</h3>
                                            <p className="text-blue-100 text-xs font-medium opacity-80">Pronta para aplicação técnica ou exportação industrial.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-105 transition-all">Exportar 4K</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
