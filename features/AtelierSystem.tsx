import React, { useState, useEffect } from 'react';
import { 
    Palette, Wand2, Download, Layers, Grid, RefreshCw, Settings2, Sliders, 
    Image as ImageIcon, Check, ChevronDown, Zap, Printer, Share2, Maximize2, 
    ArrowRight, Loader2, Sparkles, AlertCircle, MonitorPlay, PaintBucket
} from 'lucide-react';
import { ModuleHeader, ModuleLandingPage, SmartImageViewer } from '../components/Shared';
import { PantoneColor } from '../types';

interface AtelierSystemProps {
    onNavigateToMockup: () => void;
    onNavigateToLayerStudio: () => void;
}

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    // --- STATE ---
    const [prompt, setPrompt] = useState('');
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUpscaling, setIsUpscaling] = useState(false);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    
    // Configurações de Geração
    const [printTechnique, setPrintTechnique] = useState<'DIGITAL' | 'CYLINDER'>('DIGITAL');
    const [artStyle, setArtStyle] = useState('ORIGINAL'); 
    const [targetLayout, setTargetLayout] = useState('ORIGINAL'); // 'ORIGINAL', 'PAREO'
    const [targetSize, setTargetSize] = useState('140cm Standard');
    const [colors, setColors] = useState<PantoneColor[]>([]); // Para controle de cor

    // Recupera imagem transferida de outros módulos
    useEffect(() => {
        const transferImg = localStorage.getItem('vingi_transfer_image');
        if (transferImg) {
            // Placeholder para lógica futura de transferência
            // localStorage.removeItem('vingi_transfer_image');
        }
    }, []);

    // --- HANDLERS ---

    const handleGenerate = async () => {
        if (!prompt) return;
        setIsGenerating(true);
        setShowDownloadMenu(false);
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'GENERATE_PATTERN',
                    prompt,
                    technique: printTechnique,
                    artStyle,
                    layoutStyle: targetLayout,
                    colors: colors
                })
            });
            const data = await res.json();
            if (data.success && data.image) {
                setGeneratedPattern(data.image);
            } else {
                alert('Erro na geração. Tente novamente.');
            }
        } catch (e) {
            console.error(e);
            alert('Falha na comunicação com o Estúdio de IA.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleProductionDownload = async () => {
        if (!generatedPattern) return;
        setIsUpscaling(true);
        setShowDownloadMenu(false);
        try {
            const res = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    action: 'PREPARE_PRODUCTION', 
                    mainImageBase64: generatedPattern,
                    targetSize: targetSize || "140cm Standard",
                    technique: printTechnique,
                    layoutStyle: targetLayout 
                }) 
            });
            const data = await res.json();
            if (data.success && data.image) {
                const l = document.createElement('a'); 
                l.download = `VINGI_PRO_PRODUCTION_${targetSize || 'RAW'}.png`; 
                l.href = data.image; 
                l.click();
            } else {
                throw new Error("Falha no motor de produção. Tente novamente.");
            }
        } catch (e: any) {
            alert(e.message || "Erro ao gerar arquivo de produção.");
        } finally {
            setIsUpscaling(false);
        }
    };

    const transferToMockup = () => {
        if(generatedPattern) {
            localStorage.setItem('vingi_mockup_pattern', generatedPattern);
            onNavigateToMockup();
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
            <ModuleHeader 
                icon={Palette} 
                title="Estúdio de Criação" 
                subtitle="Generative AI Textile Design"
                actionLabel={generatedPattern ? "Nova Criação" : undefined}
                onAction={() => { setGeneratedPattern(null); setPrompt(''); }}
            />

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                
                {/* SIDEBAR DE CONTROLES */}
                <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col z-20 shadow-xl overflow-y-auto shrink-0 p-6 custom-scrollbar">
                    
                    <div className="mb-8">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Prompt Criativo</label>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Descreva sua estampa (ex: Tropical dark background with neon birds, watercolor style...)"
                            className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:border-vingi-500 focus:bg-white transition-all resize-none outline-none"
                        />
                    </div>

                    <div className="space-y-6 mb-8">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Técnica de Impressão</label>
                            <div className="flex gap-2">
                                <button onClick={() => setPrintTechnique('DIGITAL')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold border transition-all ${printTechnique === 'DIGITAL' ? 'bg-vingi-50 border-vingi-200 text-vingi-700' : 'bg-white border-gray-200 text-gray-500'}`}>
                                    DIGITAL
                                </button>
                                <button onClick={() => setPrintTechnique('CYLINDER')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold border transition-all ${printTechnique === 'CYLINDER' ? 'bg-vingi-50 border-vingi-200 text-vingi-700' : 'bg-white border-gray-200 text-gray-500'}`}>
                                    ROTATIVA
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Estilo Artístico</label>
                            <select value={artStyle} onChange={(e) => setArtStyle(e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none">
                                <option value="ORIGINAL">Estúdio Padrão (Fotorrealista)</option>
                                <option value="WATERCOLOR">Aquarela Manual</option>
                                <option value="VETOR">Vetor Flat (Traço Limpo)</option>
                                <option value="ACRILICA">Pintura Acrílica</option>
                            </select>
                        </div>
                         <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Formato / Layout</label>
                            <select value={targetLayout} onChange={(e) => setTargetLayout(e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none">
                                <option value="ORIGINAL">Padrão Corrido (Seamless)</option>
                                <option value="PAREO">Pareô / Lenço (Localizado)</option>
                            </select>
                        </div>
                    </div>

                    <button 
                        onClick={handleGenerate} 
                        disabled={isGenerating || !prompt}
                        className={`mt-auto w-full py-4 rounded-xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all ${isGenerating || !prompt ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-vingi-900 text-white hover:bg-black hover:scale-[1.02]'}`}
                    >
                        {isGenerating ? <Loader2 size={18} className="animate-spin"/> : <Wand2 size={18}/>}
                        {isGenerating ? 'CRIANDO...' : 'GERAR ESTAMPA'}
                    </button>
                </div>

                {/* AREA DE VISUALIZAÇÃO */}
                <div className="flex-1 bg-gray-100 relative overflow-hidden flex items-center justify-center p-4 md:p-10">
                    {!generatedPattern ? (
                        <ModuleLandingPage 
                            icon={Palette} 
                            title="Atelier Generativo" 
                            description="Motor de IA têxtil capaz de criar estampas corridas, localizadas e texturas de alta fidelidade para produção digital ou rotativa."
                            primaryActionLabel="Configurar Criação"
                            onPrimaryAction={() => { /* Focus on sidebar */ }}
                            customContent={
                                <div className="grid grid-cols-2 gap-4 max-w-md">
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 text-xs text-gray-500">
                                        <strong className="block text-gray-900 mb-1">Cilindro Mode</strong>
                                        Gera vetores com cores chapadas para gravação.
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 text-xs text-gray-500">
                                        <strong className="block text-gray-900 mb-1">Digital 4K</strong>
                                        Upscaling industrial para impressão digital direta.
                                    </div>
                                </div>
                            }
                        />
                    ) : (
                        <div className="relative w-full h-full max-w-4xl flex flex-col shadow-2xl rounded-2xl overflow-hidden bg-white animate-fade-in">
                            <div className="flex-1 relative bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')]">
                                <SmartImageViewer src={generatedPattern} />
                                
                                {isUpscaling && (
                                    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                                        <Loader2 size={48} className="animate-spin text-vingi-400 mb-4"/>
                                        <h3 className="text-xl font-black uppercase tracking-widest">Renderizando 4K</h3>
                                        <p className="text-xs text-gray-400 mt-2">Aplicando tratamento de redução de ruído...</p>
                                    </div>
                                )}
                            </div>

                            <div className="h-16 bg-white border-t border-gray-200 px-6 flex items-center justify-between shrink-0 relative z-20">
                                <div className="flex items-center gap-4">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        {printTechnique} • {targetLayout === 'PAREO' ? 'LOCALIZADO' : 'SEAMLESS'}
                                    </div>
                                </div>

                                <div className="flex gap-3 relative">
                                    <button onClick={transferToMockup} className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-bold flex items-center gap-2">
                                        <Zap size={14}/> Testar no Provador
                                    </button>
                                    <button onClick={onNavigateToLayerStudio} className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-bold flex items-center gap-2">
                                        <Layers size={14}/> Editar Camadas
                                    </button>
                                    
                                    <div className="relative">
                                        <button 
                                            onClick={() => setShowDownloadMenu(!showDownloadMenu)} 
                                            className="px-6 py-2 bg-vingi-900 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg hover:bg-black"
                                        >
                                            <Download size={14}/> EXPORTAR <ChevronDown size={12}/>
                                        </button>

                                        {showDownloadMenu && (
                                            <div className="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-slide-up">
                                                <div className="p-3 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase">
                                                    Formato de Saída
                                                </div>
                                                <button onClick={() => handleProductionDownload()} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between group">
                                                    <div>
                                                        <span className="block text-xs font-bold text-gray-800">Arquivo de Produção (TIFF/PNG)</span>
                                                        <span className="block text-[10px] text-gray-400">4K Upscaled • {targetSize}</span>
                                                    </div>
                                                    <Printer size={16} className="text-gray-300 group-hover:text-vingi-600"/>
                                                </button>
                                                <button onClick={() => { 
                                                    const l = document.createElement('a'); 
                                                    l.download = 'VINGI_PREVIEW.jpg'; 
                                                    l.href = generatedPattern; 
                                                    l.click(); 
                                                    setShowDownloadMenu(false);
                                                }} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between group border-t border-gray-100">
                                                    <div>
                                                        <span className="block text-xs font-bold text-gray-800">Preview Rápido (JPG)</span>
                                                        <span className="block text-[10px] text-gray-400">Baixa Resolução • Aprovação</span>
                                                    </div>
                                                    <Share2 size={16} className="text-gray-300 group-hover:text-vingi-600"/>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};