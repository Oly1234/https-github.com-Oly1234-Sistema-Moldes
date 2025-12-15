
import React, { useState, useRef, useEffect } from 'react';
import { 
    Wand2, UploadCloud, Palette, Layers, Download, RotateCcw, 
    Share2, Shirt, RefreshCw, Zap, Maximize, X, Image as ImageIcon,
    Loader2
} from 'lucide-react';
import { ModuleHeader, ModuleLandingPage, FloatingReference } from '../components/Shared';
import { PantoneColor } from '../types';

interface AtelierSystemProps {
  onNavigateToMockup: () => void;
  onNavigateToLayerStudio: () => void;
}

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    // State
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [technicalPrompt, setTechnicalPrompt] = useState('');
    const [colorData, setColorData] = useState<{ colors: PantoneColor[], harmony: string, suggestion: string } | null>(null);
    const [activeColorMode, setActiveColorMode] = useState<'NATURAL' | 'VIVID' | 'PASTEL' | 'DARK'>('NATURAL');
    const [isAnalyzingColors, setIsAnalyzingColors] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Configs
    const [repeatType, setRepeatType] = useState('Seamless');
    const [layoutType, setLayoutType] = useState('Corrida');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial load check for transfer
    useEffect(() => {
        const transferImage = localStorage.getItem('vingi_transfer_image');
        if (transferImage) {
            setReferenceImage(transferImage);
            analyzeColors(transferImage, 'NATURAL');
            localStorage.removeItem('vingi_transfer_image');
        }
    }, []);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const res = ev.target?.result as string;
                if (res) {
                    setReferenceImage(res);
                    analyzeColors(res, 'NATURAL');
                }
            };
            reader.readAsDataURL(file);
        }
    };

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
            if (data.success) {
                if (data.colors) {
                    setColorData({ 
                        colors: data.colors, 
                        harmony: variation === 'NATURAL' ? "Paleta Original" : `Variação: ${variation}`, 
                        suggestion: "Cores calibradas." 
                    });
                }
                // CORREÇÃO: Atualiza o prompt sempre que houver nova análise
                if (data.prompt) setTechnicalPrompt(data.prompt);
            }
        } catch (e) {
            console.error(e);
        }
        setIsAnalyzingColors(false);
    };

    const generatePattern = async () => {
        if (!technicalPrompt) return;
        setIsGenerating(true);
        setGeneratedImage(null);

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: technicalPrompt,
                    colors: colorData?.colors || [],
                    textileSpecs: { layout: layoutType, repeat: repeatType }
                })
            });
            const data = await res.json();
            if (data.success && data.image) {
                setGeneratedImage(data.image);
            } else {
                alert("Falha na geração: " + (data.error || "Erro desconhecido"));
            }
        } catch (e) {
            console.error(e);
            alert("Erro de conexão ao gerar estampa.");
        } finally {
            setIsGenerating(false);
        }
    };

    const sendToMockup = () => {
        if (generatedImage) {
            localStorage.setItem('vingi_mockup_pattern', generatedImage);
            window.dispatchEvent(new CustomEvent('vingi_transfer', { detail: { module: 'MOCKUP' } }));
            onNavigateToMockup();
        }
    };

    const sendToLayerStudio = () => {
        if (generatedImage) {
            localStorage.setItem('vingi_layer_studio_source', generatedImage);
            window.dispatchEvent(new CustomEvent('vingi_transfer', { detail: { module: 'LAYER' } }));
            onNavigateToLayerStudio();
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
            <ModuleHeader 
                icon={Palette} 
                title="Atelier Generativo" 
                subtitle="Criação & Restauração"
                actionLabel={referenceImage ? "Limpar Referência" : undefined}
                onAction={() => { setReferenceImage(null); setColorData(null); setTechnicalPrompt(''); setGeneratedImage(null); }}
            />

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
                <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" />

                {!referenceImage && !generatedImage ? (
                    <ModuleLandingPage 
                        icon={Palette}
                        title="Atelier Generativo"
                        description="Crie estampas exclusivas a partir de descrições textuais ou restaure desenhos antigos extraindo sua paleta de cores e estilo."
                        primaryActionLabel="Carregar Referência (Opcional)"
                        onPrimaryAction={() => fileInputRef.current?.click()}
                        features={["Extração de Pantone", "Geração Seamless", "Restauração", "Prompt Engineering"]}
                        secondaryAction={
                             <div className="flex flex-col justify-center items-center h-full gap-4">
                                <button onClick={() => { setTechnicalPrompt("Floral watercolor summer print"); generatePattern(); }} className="w-full py-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-vingi-400 text-left px-6 group transition-all">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Wand2 size={16} className="text-vingi-500"/>
                                        <span className="text-sm font-bold text-gray-800">Modo Criação Livre</span>
                                    </div>
                                    <p className="text-xs text-gray-400 group-hover:text-gray-600">Digitar prompt sem imagem de referência.</p>
                                </button>
                             </div>
                        }
                    />
                ) : (
                    <div className="flex flex-col lg:flex-row gap-6 max-w-[1800px] mx-auto h-full">
                        
                        {/* LEFT COLUMN: CONTROLS & REFERENCE */}
                        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
                            
                            {/* REFERENCE CARD */}
                            {referenceImage && (
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group">
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Imagem de Referência</h4>
                                    <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-100 relative">
                                        <img src={referenceImage} className="w-full h-full object-contain" />
                                        {isAnalyzingColors && (
                                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                                <Loader2 size={24} className="text-vingi-600 animate-spin"/>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* COLOR VARIATIONS */}
                                    <div className="mt-4 grid grid-cols-4 gap-1">
                                        {(['NATURAL', 'VIVID', 'PASTEL', 'DARK'] as const).map(mode => (
                                            <button 
                                                key={mode}
                                                onClick={() => analyzeColors(referenceImage!, mode)}
                                                className={`text-[9px] font-bold py-1.5 rounded border ${activeColorMode === mode ? 'bg-vingi-900 text-white border-vingi-900' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                {mode.slice(0,3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* PROMPT EDITOR */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex-1">
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Wand2 size={12}/> Prompt de Engenharia
                                </h4>
                                <textarea 
                                    value={technicalPrompt}
                                    onChange={(e) => setTechnicalPrompt(e.target.value)}
                                    placeholder="Descreva a estampa desejada..."
                                    className="w-full h-32 p-3 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vingi-500 focus:border-transparent resize-none mb-4"
                                />
                                
                                <div className="space-y-3 mb-6">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Layout de Impressão</label>
                                        <div className="flex gap-2 mt-1">
                                            {['Corrida', 'Barrada', 'Localizada'].map(l => (
                                                <button key={l} onClick={() => setLayoutType(l)} className={`flex-1 py-1.5 text-[10px] font-bold rounded border ${layoutType===l ? 'bg-vingi-100 text-vingi-700 border-vingi-200' : 'bg-white text-gray-500 border-gray-200'}`}>{l}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={generatePattern}
                                    disabled={isGenerating || !technicalPrompt}
                                    className="w-full py-3 bg-vingi-900 text-white rounded-xl font-bold shadow-lg hover:bg-vingi-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isGenerating ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16}/>}
                                    {isGenerating ? 'Gerando...' : 'GERAR ESTAMPA'}
                                </button>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: PREVIEW & COLOR PALETTE */}
                        <div className="flex-1 min-w-0 flex flex-col gap-4">
                            
                            {/* GENERATED PREVIEW */}
                            <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden relative flex flex-col min-h-[400px]">
                                <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resultado do Atelier</h4>
                                    {generatedImage && (
                                        <div className="flex gap-2">
                                            <button onClick={sendToMockup} className="flex items-center gap-1 text-[10px] font-bold text-vingi-600 bg-vingi-50 px-2 py-1 rounded hover:bg-vingi-100"><Shirt size={12}/> Provador</button>
                                            <button onClick={sendToLayerStudio} className="flex items-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100"><Layers size={12}/> Layers</button>
                                            <a href={generatedImage} download="vingi_pattern.png" className="flex items-center gap-1 text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"><Download size={12}/> Baixar</a>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex-1 bg-gray-100 relative flex items-center justify-center p-4">
                                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                                    
                                    {isGenerating ? (
                                        <div className="text-center">
                                            <div className="w-16 h-16 border-4 border-vingi-200 border-t-vingi-600 rounded-full animate-spin mx-auto mb-4"></div>
                                            <p className="text-sm font-bold text-gray-500 animate-pulse">O Atelier está desenhando...</p>
                                        </div>
                                    ) : generatedImage ? (
                                        <img src={generatedImage} className="max-w-full max-h-full object-contain shadow-2xl rounded" />
                                    ) : (
                                        <div className="text-center text-gray-400">
                                            <Palette size={48} className="mx-auto mb-2 opacity-20"/>
                                            <p className="text-sm">Configure o prompt e clique em Gerar.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* COLOR PALETTE */}
                            {colorData && colorData.colors.length > 0 && (
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm shrink-0">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <Palette size={12}/> Paleta Pantone TCX ({activeColorMode})
                                        </h4>
                                        <span className="text-[9px] font-mono text-gray-400">{colorData.harmony}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {colorData.colors.map((c, i) => (
                                            <div key={i} className="flex-1 min-w-[80px] bg-gray-50 rounded-lg p-2 border border-gray-100 flex flex-col gap-2">
                                                <div className="w-full h-8 rounded-md shadow-inner" style={{ backgroundColor: c.hex }}></div>
                                                <div>
                                                    <span className="block text-[10px] font-bold text-gray-800 truncate" title={c.name}>{c.name}</span>
                                                    <span className="block text-[9px] text-gray-500 font-mono">{c.code}</span>
                                                    {c.role && <span className="block text-[8px] text-vingi-500 mt-1 uppercase font-bold">{c.role}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {colorData.suggestion && (
                                        <div className="mt-3 p-2 bg-blue-50 text-blue-700 text-[10px] rounded border border-blue-100">
                                            <strong>Dica do Colorista:</strong> {colorData.suggestion}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
