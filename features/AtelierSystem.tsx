
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Image as ImageIcon, Loader2, Sparkles, Layers, Grid3X3, Target, ArrowDownToLine, ArrowRightToLine, Check, Printer, Globe, X, ScanLine, Brush, Info, Search, Droplets, Shirt } from 'lucide-react';
import { PantoneColor } from '../types';
import { SelvedgeTool, SelvedgePosition } from '../components/SelvedgeTool';

// --- TYPES ---
interface AtelierSystemProps {
    onNavigateToMockup?: () => void;
    onNavigateToLayerStudio?: () => void; // NOVO
}

interface GeneratedAsset {
    id: string;
    imageUrl: string;
    prompt: string;
    layout: string;
    timestamp: number;
    specs: { width: number; height: number; dpi: number };
}

// --- CONSTANTES ---
const GENERATION_STEPS = [
    "Inicializando Atelier Digital...",
    "Mapeando Cores da Referência...",
    "Definindo Estrutura do Layout...",
    "Aplicando Textura Vetorial...",
    "Ajustando Iluminação e Sombra...",
    "Finalizando Renderização 4K..."
];

// Componente Pantone Melhorado
const PantoneCard: React.FC<{ color: PantoneColor | any }> = ({ color }) => {
    const handleSearch = () => {
        const query = `Pantone ${color.code} ${color.name} cotton swatch`;
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`, '_blank');
    };

    return (
        <div onClick={handleSearch} className="flex flex-col bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg hover:border-vingi-300 transition-all cursor-pointer group h-full hover:scale-[1.02]">
            <div className="h-14 w-full relative" style={{ backgroundColor: color.hex }}>
                 <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                 <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-1">
                     <Search size={10} className="text-gray-700"/>
                 </div>
            </div>
            <div className="p-2 flex flex-col justify-between flex-1">
                <div className="mb-1">
                    <span className="block text-[8px] font-extrabold text-gray-900 leading-tight uppercase truncate" title={color.name}>{color.name}</span>
                    <span className="block text-[9px] text-gray-600 font-mono font-bold">{color.code || 'PENDING'}</span>
                </div>
                {color.role && (
                    <span className="self-start text-[7px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 flex items-center gap-1 mt-1">
                       {color.role.includes('Tom') ? <Droplets size={6}/> : <Palette size={6}/>} {color.role}
                    </span>
                )}
            </div>
        </div>
    );
};

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    // --- STATE ---
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [detectedColors, setDetectedColors] = useState<PantoneColor[]>([]);
    
    // Configurações
    const [layoutType, setLayoutType] = useState<'Corrida' | 'Barrada' | 'Localizada'>('Corrida');
    const [selvedgePos, setSelvedgePos] = useState<SelvedgePosition>('Inferior');
    const [widthCm, setWidthCm] = useState<number>(140);
    const [heightCm, setHeightCm] = useState<number>(100);
    const [dpi, setDpi] = useState<number>(150);
    const [userInstruction, setUserInstruction] = useState<string>('');
    const [prompt, setPrompt] = useState<string>('');

    // UI Status
    const [isGenerating, setIsGenerating] = useState(false);
    const [genStep, setGenStep] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- EFFECTS ---
    useEffect(() => {
        // Checar por imagem transferida da aba de pesquisa
        const transferImage = localStorage.getItem('vingi_transfer_image');
        if (transferImage) {
            setReferenceImage(transferImage);
            localStorage.removeItem('vingi_transfer_image');
        }
    }, []);

    useEffect(() => {
        let interval: any;
        if (isGenerating) {
            setGenStep(0);
            interval = setInterval(() => { setGenStep(prev => (prev + 1) % GENERATION_STEPS.length); }, 1500);
        }
        return () => clearInterval(interval);
    }, [isGenerating]);

    // --- HANDLERS ---
    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setReferenceImage(ev.target?.result as string);
                setGeneratedPattern(null);
                setDetectedColors([]);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!referenceImage) return;
        setIsGenerating(true);
        setError(null);

        try {
            // 1. Primeiro analisamos a imagem para extrair cores e prompt técnico (Modo DESCRIBE)
            const compressedBase64 = referenceImage.split(',')[1]; // Simplificado (assumindo jpeg/png)
            
            // Passo 1: Análise Prévia (Extração de DNA Visual)
            const analysisRes = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'DESCRIBE_PATTERN',
                    mainImageBase64: compressedBase64,
                    mainMimeType: 'image/jpeg'
                })
            });
            const analysisData = await analysisRes.json();
            
            if (!analysisData.success) throw new Error("Falha na análise inicial da imagem.");
            
            const autoPrompt = analysisData.prompt;
            const autoColors = analysisData.colors || [];
            
            setDetectedColors(autoColors);
            setPrompt(autoPrompt);

            // 2. Passo 2: Geração Efetiva (Atelier)
            const finalPrompt = userInstruction 
            ? `${userInstruction}. Based on: ${autoPrompt}`
            : autoPrompt;

            const genRes = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: finalPrompt,
                    colors: autoColors,
                    textileSpecs: {
                        layout: layoutType,
                        selvedge: selvedgePos,
                        width: widthCm,
                        height: heightCm,
                        dpi: dpi,
                        styleGuide: 'High quality textile print'
                    }
                })
            });

            const genData = await genRes.json();
            if (genData.success && genData.image) {
                setGeneratedPattern(genData.image);
            } else {
                throw new Error(genData.error || "Erro na geração.");
            }

        } catch (err: any) {
            setError(err.message || "Ocorreu um erro no processo criativo.");
        } finally {
            setIsGenerating(false);
        }
    };

    const triggerDownload = (url: string) => {
        const link = document.createElement('a');
        link.download = `vingi-atelier-creation-${Date.now()}.jpg`;
        link.href = url;
        link.click();
    };

    const handleDownload = () => {
        if (!generatedPattern) return;
        triggerDownload(generatedPattern);
    };

    const handleTransferToMockup = () => {
        if (!generatedPattern || !onNavigateToMockup) return;
        // REMOVIDO: triggerDownload(generatedPattern); 
        // Agora transfere apenas internamente para UX fluida
        localStorage.setItem('vingi_mockup_pattern', generatedPattern);
        onNavigateToMockup();
    };

    const handleTransferToLayerStudio = () => {
        if (!generatedPattern || !onNavigateToLayerStudio) return;
        // REMOVIDO: triggerDownload(generatedPattern);
        // Agora transfere apenas internamente
        localStorage.setItem('vingi_layer_studio_source', generatedPattern);
        onNavigateToLayerStudio();
    };

    // --- RENDER ---
    return (
        <div className="h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar flex flex-col items-center">
             <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-vingi-900 p-2 rounded-lg text-white"><Brush size={20}/></div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 leading-tight">Atelier de Criação</h1>
                        <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">IA Generativa Têxtil</p>
                    </div>
                </div>
                {referenceImage && !isGenerating && (
                    <button onClick={() => { setReferenceImage(null); fileInputRef.current!.value = ''; }} className="text-xs font-bold text-gray-500 hover:text-red-500 flex items-center gap-1">
                        <X size={14}/> Resetar
                    </button>
                )}
            </header>

            <div className="w-full max-w-5xl p-6 md:p-10 space-y-10 pb-32">
                
                {/* 1. UPLOAD AREA (Se vazio) */}
                {!referenceImage ? (
                    <div className="min-h-[60vh] flex flex-col items-center justify-center animate-fade-in">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 max-w-2xl w-full">
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Atelier Generativo</h2>
                            <p className="text-gray-500">
                                Crie estampas exclusivas do zero. Carregue um desenho ou imagem de referência e defina o layout (Corrido, Barrado) para que a IA gere um arquivo de alta resolução pronto para impressão.
                            </p>
                        </div>

                        <div onClick={() => fileInputRef.current?.click()} className="w-full max-w-2xl h-96 bg-white rounded-3xl border-2 border-dashed border-gray-300 hover:border-vingi-500 hover:bg-vingi-50/30 transition-all cursor-pointer flex flex-col items-center justify-center gap-6 group shadow-sm hover:shadow-xl">
                             <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" />
                             <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                                 <UploadCloud size={40} className="text-gray-400 group-hover:text-vingi-500"/>
                             </div>
                             <div className="text-center px-4">
                                 <h3 className="text-2xl font-bold text-gray-700">Carregar Desenho ou Referência</h3>
                                 <p className="text-gray-400 mt-2 max-w-md mx-auto">A IA extrairá cores e estilo para gerar a nova estampa.</p>
                             </div>
                        </div>
                    </div>
                ) : (
                    // 2. WORKSPACE DE CRIAÇÃO
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                        
                        {/* COLUNA ESQUERDA: CONFIGURAÇÃO VISUAL */}
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><Target size={18} className="text-vingi-500"/> Definição de Layout</h3>
                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded font-bold uppercase">{layoutType}</span>
                                </div>

                                {/* FERRAMENTA VISUAL DE OURELA (AGORA ATIVA PARA TODOS OS MODOS) */}
                                <div className="mb-6">
                                    <SelvedgeTool 
                                        image={referenceImage} 
                                        selectedPos={selvedgePos} 
                                        onSelect={setSelvedgePos} 
                                        active={true}
                                    />
                                    <p className="text-[10px] text-vingi-500 mt-2 font-bold text-center flex items-center justify-center gap-1">
                                        <Info size={12}/> 
                                        {layoutType === 'Barrada' 
                                            ? 'Defina onde ficará a barra do desenho' 
                                            : 'Indique a orientação do fio do tecido (Ourela)'}
                                    </p>
                                </div>

                                {/* SELETORES DE LAYOUT */}
                                <div className="grid grid-cols-3 gap-2 mb-6">
                                    <button onClick={() => setLayoutType('Corrida')} className={`py-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${layoutType === 'Corrida' ? 'bg-vingi-900 text-white border-vingi-900 shadow-md' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                                        <Grid3X3 size={16}/> CORRIDA
                                    </button>
                                    <button onClick={() => setLayoutType('Barrada')} className={`py-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${layoutType === 'Barrada' ? 'bg-vingi-900 text-white border-vingi-900 shadow-md' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                                        <ArrowDownToLine size={16}/> BARRADA
                                    </button>
                                    <button onClick={() => setLayoutType('Localizada')} className={`py-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${layoutType === 'Localizada' ? 'bg-vingi-900 text-white border-vingi-900 shadow-md' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                                        <Target size={16}/> LOCAL
                                    </button>
                                </div>

                                {/* INPUTS TÉCNICOS */}
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Largura</label>
                                            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3">
                                                <input type="number" value={widthCm} onChange={e => setWidthCm(Number(e.target.value))} className="w-full py-2 bg-transparent outline-none text-sm font-bold text-gray-800"/>
                                                <span className="text-[10px] font-bold text-gray-400">CM</span>
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Altura</label>
                                            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3">
                                                <input type="number" value={heightCm} onChange={e => setHeightCm(Number(e.target.value))} className="w-full py-2 bg-transparent outline-none text-sm font-bold text-gray-800"/>
                                                <span className="text-[10px] font-bold text-gray-400">CM</span>
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Qualidade</label>
                                            <select value={dpi} onChange={e => setDpi(Number(e.target.value))} className="w-full py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-800 outline-none">
                                                <option value={72}>72 DPI</option>
                                                <option value={150}>150 DPI</option>
                                                <option value={300}>300 DPI</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Instruções Extras (Prompt)</label>
                                        <textarea 
                                            value={userInstruction} 
                                            onChange={e => setUserInstruction(e.target.value)} 
                                            placeholder="Ex: Quero cores mais vivas e traços de aquarela..."
                                            className="w-full h-20 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs resize-none focus:bg-white focus:border-vingi-500 outline-none transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            {!isGenerating && !generatedPattern && (
                                <button 
                                    onClick={handleGenerate}
                                    className="w-full py-5 bg-vingi-900 text-white rounded-2xl font-bold shadow-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
                                >
                                    <Wand2 size={24} className="text-purple-300"/>
                                    <span>CRIAR ESTAMPA AGORA</span>
                                </button>
                            )}
                        </div>

                        {/* COLUNA DIREITA: PREVIEW / RESULTADO */}
                        <div className="relative">
                            {isGenerating ? (
                                <div className="h-full min-h-[500px] bg-slate-900 rounded-3xl overflow-hidden relative border-4 border-slate-800 flex flex-col items-center justify-center text-center p-8 shadow-2xl">
                                    {/* Scan Animation */}
                                    <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,100,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,100,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                                    <div className="absolute top-0 left-0 w-full h-2 bg-vingi-400 shadow-[0_0_30px_rgba(96,165,250,1)] animate-scan z-10 opacity-80"></div>
                                    
                                    <Loader2 size={64} className="text-vingi-500 animate-spin mb-6 relative z-20"/>
                                    <h3 className="text-2xl font-bold text-white relative z-20 tracking-tight animate-pulse">{GENERATION_STEPS[genStep]}</h3>
                                    <p className="text-slate-400 mt-2 relative z-20 text-sm">O Atelier está processando {widthCm}x{heightCm}cm em {dpi} DPI</p>
                                </div>
                            ) : generatedPattern ? (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white group">
                                        <img src={generatedPattern} className="w-full h-full object-cover"/>
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm gap-4 flex-col md:flex-row p-4">
                                            <button onClick={handleDownload} className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold shadow-xl hover:scale-105 transition-transform flex items-center gap-2 w-full md:w-auto justify-center">
                                                <Download size={18}/> BAIXAR
                                            </button>
                                            {onNavigateToMockup && (
                                                <button onClick={handleTransferToMockup} className="bg-vingi-500 text-white px-6 py-3 rounded-full font-bold shadow-xl hover:scale-105 transition-transform flex items-center gap-2 w-full md:w-auto justify-center border-2 border-white/20">
                                                    <Shirt size={18}/> PROVAR
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* CTA PARA LAYER STUDIO (NOVO) */}
                                    {onNavigateToLayerStudio && (
                                        <div onClick={handleTransferToLayerStudio} className="bg-gradient-to-r from-gray-900 to-slate-800 p-4 rounded-xl shadow-lg cursor-pointer group border border-gray-700 hover:border-vingi-500 transition-all">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-vingi-600 p-2 rounded-lg text-white group-hover:scale-110 transition-transform"><Layers size={20}/></div>
                                                    <div>
                                                        <h4 className="font-bold text-white text-sm">Separe os Elementos & Altere (Layer Studio)</h4>
                                                        <p className="text-gray-400 text-xs mt-0.5">IA: Isolamento de fundo e regeneração de camadas.</p>
                                                    </div>
                                                </div>
                                                <ArrowRightToLine size={20} className="text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all"/>
                                            </div>
                                        </div>
                                    )}

                                    {/* RESULTADO: PANTONES */}
                                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Palette size={14}/> Paleta Gerada (Pantone TCX)
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {detectedColors.map((c, i) => <PantoneCard key={i} color={c} />)}
                                            {detectedColors.length === 0 && <p className="text-xs text-gray-400 col-span-4">Cores embutidas no arquivo.</p>}
                                        </div>
                                        <div className="mt-4 text-[10px] text-gray-400 italic text-center">
                                            *Clique na cor para visualizar a referência física
                                        </div>
                                    </div>
                                    
                                    <button onClick={() => setGeneratedPattern(null)} className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                                        Gerar Novamente
                                    </button>
                                </div>
                            ) : (
                                // PLACEHOLDER INICIAL (PREVIEW DA REFERENCIA)
                                <div className="h-full min-h-[400px] bg-gray-100 rounded-3xl border-2 border-dashed border-gray-300 flex items-center justify-center p-8 relative overflow-hidden">
                                     <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#94a3b8 2px, transparent 2px)', backgroundSize: '24px 24px' }} />
                                     <div className="text-center relative z-10 opacity-50">
                                         <Sparkles size={48} className="mx-auto mb-4 text-gray-400"/>
                                         <p className="font-bold text-gray-500">O preview da estampa aparecerá aqui</p>
                                     </div>
                                </div>
                            )}

                            {error && (
                                <div className="absolute top-4 left-4 right-4 bg-red-100 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-bold flex items-center gap-2 animate-fade-in shadow-lg">
                                    <Info size={18}/> {error}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
