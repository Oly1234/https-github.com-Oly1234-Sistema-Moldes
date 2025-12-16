
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Loader2, Grid3X3, Settings2, Image as ImageIcon, Type, Sparkles, FileWarning, RefreshCw, Sun, Moon, Contrast, Droplets, ArrowDownToLine, Move, ZoomIn, Minimize2, Check, Cylinder, Printer, Eye, Zap, Layers, Cpu, LayoutTemplate, PaintBucket } from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader, FloatingReference, ModuleLandingPage } from '../components/Shared';
import { SelvedgeTool, SelvedgePosition } from '../components/SelvedgeTool';

// --- COMPONENTE: CHIP PANTONE INTERATIVO ---
const PantoneChip: React.FC<{ color: PantoneColor, onClick: () => void }> = ({ color, onClick }) => (
    <div 
        onClick={onClick}
        className="flex flex-col bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden cursor-pointer h-14 w-full group relative hover:scale-105 transition-transform"
        title={`${color.name} (${color.code})`}
    >
        <div className="h-9 w-full relative" style={{ backgroundColor: color.hex }}></div>
        <div className="flex-1 flex flex-col justify-center bg-white border-t border-gray-100 px-1">
            <span className="text-[7px] font-bold text-gray-800 font-mono text-center truncate">{color.code || color.hex}</span>
        </div>
    </div>
);

// --- HELPERS ---
const triggerTransfer = (targetModule: string, imageData: string) => {
    if (targetModule === 'MOCKUP') localStorage.setItem('vingi_mockup_pattern', imageData);
    if (targetModule === 'LAYER') localStorage.setItem('vingi_layer_studio_source', imageData);
    window.dispatchEvent(new CustomEvent('vingi_transfer', { detail: { module: targetModule } }));
};

const compressImage = (base64Str: string | null, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!base64Str) { reject(new Error("Imagem vazia")); return; }
        const img = new Image(); img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.drawImage(img, 0, 0, w, h); resolve(canvas.toDataURL('image/jpeg', 0.8)); }
            else reject(new Error("Canvas error"));
        };
        img.onerror = () => reject(new Error("Load error"));
    });
};

interface AtelierSystemProps {
    onNavigateToMockup?: () => void;
    onNavigateToLayerStudio?: () => void;
}

// --- LAYOUT TYPES ---
const LAYOUT_OPTIONS = [
    { id: 'ORIGINAL', label: 'Conforme Original' },
    { id: 'CORRIDA', label: 'Corrida (All-over)' },
    { id: 'BARRADO', label: 'Barrado (Border)' },
    { id: 'LENCO', label: 'Lenço (Scarf)' },
    { id: 'PAREO', label: 'Pareô/Canga' },
    { id: 'LOCALIZADA', label: 'Localizada (T-shirt)' },
];

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    // --- ESTADOS GERAIS ---
    const [creationMode, setCreationMode] = useState<'IMAGE' | 'TEXT'>('IMAGE');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [userPrompt, setUserPrompt] = useState<string>('');
    
    // --- ESTADOS TÉCNICOS ---
    const [printTechnique, setPrintTechnique] = useState<'CYLINDER' | 'DIGITAL'>('CYLINDER');
    const [colors, setColors] = useState<PantoneColor[]>([]);
    const [colorCount, setColorCount] = useState<number>(0); // 0 = Auto
    const [targetLayout, setTargetLayout] = useState<string>('ORIGINAL');
    
    // --- ESTADOS DE TEXTURA (AGORA PARA AMBOS) ---
    const [useTextureOverlay, setUseTextureOverlay] = useState(false);
    const [textureOpacity, setTextureOpacity] = useState(30); // %
    const [textureType, setTextureType] = useState<'CANVAS' | 'LINEN' | 'SILK' | 'CUSTOM'>('CANVAS');
    const [textureBlend, setTextureBlend] = useState<'multiply' | 'overlay' | 'soft-light'>('multiply');
    
    // --- ESTADOS DE STATUS ---
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loadingColors, setLoadingColors] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial Load from Transfer
    useEffect(() => {
        const transferImage = localStorage.getItem('vingi_transfer_image');
        if (transferImage) {
            handleReferenceUpload(transferImage);
            localStorage.removeItem('vingi_transfer_image');
        }
    }, []);

    const resetSession = () => {
        setReferenceImage(null);
        setGeneratedPattern(null);
        setUserPrompt('');
        setColors([]);
        setError(null);
        setCreationMode('IMAGE');
        // Reset defaults
        setTargetLayout('ORIGINAL');
        setColorCount(0);
        setUseTextureOverlay(false);
    };

    // --- ANALISADORES MODULARES ---
    
    const analyzePrompt = async (cleanBase64: string) => {
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ANALYZE_REFERENCE_FOR_PROMPT', mainImageBase64: cleanBase64 })
            });
            const data = await res.json();
            if (data.success && data.prompt) setUserPrompt(data.prompt);
        } catch (e) { console.warn("Erro no Prompt Auto:", e); }
    };

    const analyzeColors = async (cleanBase64: string, variation: string = 'NATURAL') => {
        setLoadingColors(true);
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ANALYZE_COLOR_TREND', mainImageBase64: cleanBase64, variation })
            });
            const data = await res.json();
            if (data.success && data.colors) setColors(data.colors);
        } catch (e) { console.warn("Erro no Color Dept:", e); }
        setLoadingColors(false);
    };

    const handleReferenceUpload = async (imgBase64: string) => {
        setReferenceImage(imgBase64);
        setCreationMode('IMAGE');
        setIsProcessing(true);
        setStatusMessage("Iniciando Análise Modular...");
        
        try {
            const compressed = await compressImage(imgBase64);
            const cleanBase64 = compressed.split(',')[1];
            
            // Dispara análises em paralelo (Se uma falhar, a outra continua)
            await Promise.allSettled([
                analyzePrompt(cleanBase64),
                analyzeColors(cleanBase64, 'NATURAL')
            ]);
            
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleColorVariation = async (variant: string) => {
        if (!referenceImage) return;
        const compressed = await compressImage(referenceImage);
        analyzeColors(compressed.split(',')[1], variant);
    };

    const handleGenerate = async () => {
        if (!userPrompt.trim()) { setError("Por favor, descreva a estampa."); return; }

        setIsProcessing(true);
        setStatusMessage(printTechnique === 'DIGITAL' ? "Renderizando Detalhes 4K..." : "Gerando Vetores Chapados...");
        setGeneratedPattern(null);
        setError(null);

        // Feedback Visual
        setTimeout(() => setStatusMessage(printTechnique === 'DIGITAL' ? "Aplicando Iluminação..." : `Separando em ${colorCount || 'Auto'} cores...`), 1500);

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: userPrompt,
                    colors: colors, // Envia cores atuais
                    selvedge: 'NENHUMA', // Deprecated in favor of layoutStyle
                    layoutStyle: targetLayout, // Novo: Corrida, Lenço, etc.
                    colorCount: colorCount, // Novo: 1-12
                    technique: printTechnique // CYLINDER vs DIGITAL
                })
            });

            const data = await res.json();
            if (data.success && data.image) {
                setGeneratedPattern(data.image);
                // Ativa overlay automaticamente se for Digital (opcional)
                if (printTechnique === 'DIGITAL') setUseTextureOverlay(true);
            } else {
                throw new Error(data.error || "A IA não conseguiu gerar.");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => handleReferenceUpload(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleTransfer = (target: string) => {
        if (!generatedPattern) return;
        triggerTransfer(target, generatedPattern);
        if (target === 'MOCKUP' && onNavigateToMockup) onNavigateToMockup();
        if (target === 'LAYER' && onNavigateToLayerStudio) onNavigateToLayerStudio();
    };

    const hasActiveSession = referenceImage || generatedPattern;

    // --- TEXTURE ASSETS (SVG Patterns) ---
    const getTextureStyle = () => {
        let svg = "";
        switch(textureType) {
            case 'LINEN':
                svg = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E`;
                break;
            case 'SILK': // Smooth gradient flow
                svg = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23ffffff' stop-opacity='0.2'/%3E%3Cstop offset='100%25' stop-color='%23000000' stop-opacity='0.1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23g)'/%3E%3C/svg%3E`;
                break;
            case 'CUSTOM': // Placeholder for AI Texture
            case 'CANVAS':
            default:
                svg = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E`;
                break;
        }
        return {
            backgroundImage: `url("${svg}")`,
            opacity: textureOpacity / 100,
            mixBlendMode: textureBlend
        };
    };

    return (
        <div className="h-full bg-[#f8fafc] flex flex-col overflow-hidden">
            <ModuleHeader 
                icon={Palette} 
                title="Estúdio de Criação" 
                subtitle={hasActiveSession ? (printTechnique === 'CYLINDER' ? "Modo Cilindro (Vetorial)" : "Modo Digital (Alta Definição)") : undefined}
                actionLabel={hasActiveSession ? "Reiniciar" : undefined}
                onAction={resetSession}
            />

            {/* MODAL FLUTUANTE DE REFERÊNCIA (Só aparece se tiver imagem) */}
            {referenceImage && <FloatingReference image={referenceImage} label="Inspiração" />}

            {!hasActiveSession ? (
                // LANDING PAGE COM A NOVA CAPA CUSTOMIZADA
                <div className="flex-1 overflow-y-auto">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    <ModuleLandingPage 
                        icon={Palette}
                        title="Estúdio de Criação"
                        description="Inteligência Artificial Generativa para criação têxtil. Transforme ideias ou referências visuais em arquivos de estampa prontos para produção."
                        features={["Prompt to Print", "Image to Pattern", "Separação de Cores", "Rapport Automático"]}
                        partners={["STORK", "EPSON TEXTILE", "REGGIANI", "MS PRINTING"]}
                        // CENTRALIZANDO A ESCOLHA DE TÉCNICA NA CAPA
                        customContent={
                            <div className="flex flex-col gap-6 mt-8">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Selecione o Motor de Geração</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* CARD CILINDRO */}
                                    <div 
                                        onClick={() => { setPrintTechnique('CYLINDER'); fileInputRef.current?.click(); }}
                                        className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:border-vingi-300 hover:-translate-y-1 transition-all cursor-pointer group flex flex-col gap-4 relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Cylinder size={64} className="text-vingi-600"/>
                                        </div>
                                        <div className="w-12 h-12 bg-vingi-50 text-vingi-600 rounded-xl flex items-center justify-center">
                                            <Cylinder size={24}/>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800 mb-1">Cilindro (Vetorial)</h3>
                                            <p className="text-sm text-slate-500 leading-relaxed">Gera artes chapadas com cores sólidas e separadas. Ideal para gravação de quadros, cilindros e serigrafia.</p>
                                        </div>
                                        <div className="mt-auto pt-4 flex items-center gap-2 text-xs font-bold text-vingi-600">
                                            <span>INICIAR MODO VETORIAL</span> <Check size={14}/>
                                        </div>
                                    </div>

                                    {/* CARD DIGITAL */}
                                    <div 
                                        onClick={() => { setPrintTechnique('DIGITAL'); fileInputRef.current?.click(); }}
                                        className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:border-purple-300 hover:-translate-y-1 transition-all cursor-pointer group flex flex-col gap-4 relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Cpu size={64} className="text-purple-600"/>
                                        </div>
                                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                                            <Printer size={24}/>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800 mb-1">Digital (4K)</h3>
                                            <p className="text-sm text-slate-500 leading-relaxed">Gera artes com profundidade, textura, iluminação e milhões de cores. Ideal para sublimação e impressão digital direta.</p>
                                        </div>
                                        <div className="mt-auto pt-4 flex items-center gap-2 text-xs font-bold text-purple-600">
                                            <span>INICIAR MODO DIGITAL</span> <Check size={14}/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        }
                        secondaryAction={
                            <div className="h-full flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-2 h-2 rounded-full bg-vingi-500"></span>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Workflow</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-left flex items-start gap-3">
                                        <div className="p-2 bg-gray-50 rounded-lg shrink-0"><ImageIcon size={16} className="text-gray-400"/></div>
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-800 mb-1">1. Referência</h4>
                                            <p className="text-xs text-gray-500">Carregue uma imagem para a IA extrair cores e estilo.</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-left flex items-start gap-3">
                                        <div className="p-2 bg-gray-50 rounded-lg shrink-0"><Wand2 size={16} className="text-gray-400"/></div>
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-800 mb-1">2. Geração</h4>
                                            <p className="text-xs text-gray-500">A IA cria uma variação única com rapport perfeito.</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-left flex items-start gap-3">
                                        <div className="p-2 bg-gray-50 rounded-lg shrink-0"><Settings2 size={16} className="text-gray-400"/></div>
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-800 mb-1">3. Aplicação</h4>
                                            <p className="text-xs text-gray-500">Envie direto para o Provador ou Lab de Imagem.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        }
                    />
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* ÁREA VISUAL (CANVAS) */}
                    <div className="flex-1 bg-slate-900 relative flex items-center justify-center p-4 min-h-[40vh]">
                        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,#ffffff_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                        
                        {isProcessing ? (
                            <div className="text-center relative z-10 animate-fade-in">
                                <Loader2 size={48} className="text-vingi-400 animate-spin mx-auto mb-4"/>
                                <h2 className="text-white font-bold text-xl tracking-tight">{statusMessage}</h2>
                                <p className="text-slate-400 text-sm mt-2">Motor: {printTechnique === 'DIGITAL' ? 'Vingi DreamEngine 4K' : 'Vingi Vector Core'}</p>
                            </div>
                        ) : generatedPattern ? (
                            <div className="relative shadow-2xl bg-white max-w-full max-h-full flex items-center justify-center border border-white/20 animate-fade-in group overflow-hidden">
                                <img src={generatedPattern} className="max-w-full max-h-[80vh] object-contain" />
                                
                                {/* OVERLAY DE TEXTURA (UNIFICADO) */}
                                {useTextureOverlay && (
                                    <div 
                                        className="absolute inset-0 pointer-events-none w-full h-full"
                                        style={getTextureStyle()}
                                    />
                                )}

                                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[9px] px-2 py-1 rounded backdrop-blur font-mono flex flex-col items-end">
                                    <span>{printTechnique} QUALITY</span>
                                    {targetLayout !== 'ORIGINAL' && <span>LAYOUT: {targetLayout}</span>}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center opacity-30 select-none">
                                <Grid3X3 size={64} className="mx-auto mb-4 text-white"/>
                                <p className="text-white text-sm">Área de Criação</p>
                            </div>
                        )}

                        {error && (
                            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-4 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 animate-bounce-subtle z-50 border border-red-400 max-w-md">
                                <FileWarning size={20} className="shrink-0"/> 
                                <div><p>{error}</p></div>
                            </div>
                        )}
                    </div>

                    {/* PAINEL DE CONTROLE */}
                    <div className="w-full md:w-[420px] bg-white border-l border-gray-200 flex flex-col z-20 shadow-xl overflow-y-auto custom-scrollbar h-[50vh] md:h-full">
                        
                        {/* TABS DE MODO */}
                        <div className="flex border-b border-gray-200">
                            <button 
                                onClick={() => setCreationMode('IMAGE')} 
                                className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 ${creationMode === 'IMAGE' ? 'text-vingi-600 border-b-2 border-vingi-600 bg-vingi-50' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <UploadCloud size={14}/> POR IMAGEM
                            </button>
                            <button 
                                onClick={() => setCreationMode('TEXT')} 
                                className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 ${creationMode === 'TEXT' ? 'text-vingi-600 border-b-2 border-vingi-600 bg-vingi-50' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <Type size={14}/> POR TEXTO
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            
                            {/* 1. INPUT DE REFERÊNCIA (Só no modo Imagem) */}
                            {creationMode === 'IMAGE' && (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <ImageIcon size={14}/> Base Visual
                                    </h3>
                                    <div className="flex gap-4 items-center">
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex-1 bg-white border border-gray-200 text-gray-600 rounded-lg py-3 text-xs font-bold hover:bg-vingi-50 hover:border-vingi-200 hover:text-vingi-700 transition-all flex items-center justify-center gap-2"
                                        >
                                            <ImageIcon size={16}/> {referenceImage ? "Trocar Imagem" : "Carregar Foto"}
                                        </button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                                    </div>
                                </div>
                            )}

                            {/* 2. PROMPT TEXTUAL */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Sparkles size={14}/> Instrução Criativa
                                </h3>
                                <textarea 
                                    value={userPrompt}
                                    onChange={(e) => setUserPrompt(e.target.value)}
                                    placeholder={creationMode === 'TEXT' ? "Descreva sua ideia (Ex: Geométrico anos 70, cores terrosas...)" : "Aguardando análise da imagem..."}
                                    className="w-full h-24 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:border-vingi-500 focus:bg-white outline-none transition-all shadow-inner text-gray-800"
                                />
                            </div>

                            {/* 3. CONTROLE DE LAYOUT (Estilo da Estampa) */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <LayoutTemplate size={14}/> Formato de Saída
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {LAYOUT_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setTargetLayout(opt.id)}
                                            className={`py-2 px-3 rounded-lg text-[10px] font-bold border transition-all truncate ${targetLayout === opt.id ? 'bg-vingi-600 text-white border-vingi-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 4. CORES & PANTONES (CILINDRO ONLY) */}
                            {(colors.length > 0 || creationMode === 'TEXT') && printTechnique === 'CYLINDER' && (
                                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-xs font-bold text-orange-800 uppercase tracking-widest flex items-center gap-2">
                                            <Palette size={14}/> Paleta & Separação
                                        </h3>
                                        {creationMode === 'IMAGE' && referenceImage && (
                                            <div className="flex bg-white rounded-lg p-0.5 border border-orange-200">
                                                <button onClick={() => handleColorVariation('NATURAL')} title="Natural" className="p-1 hover:bg-orange-100 rounded text-gray-500 hover:text-orange-600"><Droplets size={12}/></button>
                                                <button onClick={() => handleColorVariation('VIVID')} title="Mais Vivo" className="p-1 hover:bg-orange-100 rounded text-gray-500 hover:text-orange-600"><Sun size={12}/></button>
                                                <button onClick={() => handleColorVariation('PASTEL')} title="Pastel" className="p-1 hover:bg-orange-100 rounded text-gray-500 hover:text-orange-600"><Contrast size={12}/></button>
                                                <button onClick={() => handleColorVariation('DARK')} title="Escuro" className="p-1 hover:bg-orange-100 rounded text-gray-500 hover:text-orange-600"><Moon size={12}/></button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* CONTROLE DE CONTAGEM DE CORES */}
                                    <div className="mb-4">
                                        <div className="flex justify-between text-[9px] font-bold text-orange-600 uppercase mb-1">
                                            <span>Limite de Cores (Cilindros)</span>
                                            <span>{colorCount === 0 ? 'AUTO' : `${colorCount} Cores`}</span>
                                        </div>
                                        <input 
                                            type="range" min="0" max="12" step="1"
                                            value={colorCount} 
                                            onChange={(e) => setColorCount(parseInt(e.target.value))}
                                            className="w-full h-1.5 bg-orange-200 rounded-lg appearance-none accent-orange-600"
                                        />
                                    </div>

                                    {/* Chips de Cores Detectadas (Referência) */}
                                    {loadingColors ? (
                                        <div className="h-16 flex items-center justify-center text-xs text-gray-400 gap-2"><Loader2 size={14} className="animate-spin"/> Recalculando Cores...</div>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2">
                                            {colors.slice(0, 4).map((c, i) => (
                                                <PantoneChip key={i} color={c} onClick={() => {}} />
                                            ))}
                                            {colors.length === 0 && creationMode === 'TEXT' && (
                                                <div className="col-span-4 text-center text-[10px] text-gray-400 py-2 border border-dashed rounded bg-white">
                                                    Cores automáticas.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 5. TEXTURA (UNIFICADO PARA AMBOS OS MODOS) */}
                            <div className="animate-fade-in bg-gray-50 border border-gray-200 rounded-xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest flex items-center gap-2">
                                        <Layers size={14}/> Textura & Acabamento
                                    </h3>
                                    <button 
                                        onClick={() => setUseTextureOverlay(!useTextureOverlay)}
                                        className={`p-1 rounded transition-colors ${useTextureOverlay ? 'text-vingi-600 bg-white shadow-sm' : 'text-gray-400'}`}
                                        title={useTextureOverlay ? "Textura Ativa" : "Sem Textura"}
                                    >
                                        <Eye size={16}/>
                                    </button>
                                </div>
                                
                                {useTextureOverlay ? (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                                            {['CANVAS', 'LINEN', 'SILK', 'CUSTOM'].map(t => (
                                                <button
                                                    key={t}
                                                    onClick={() => setTextureType(t as any)}
                                                    className={`px-3 py-1.5 rounded text-[9px] font-bold border whitespace-nowrap ${textureType === t ? 'bg-gray-800 text-white border-gray-800' : 'bg-white border-gray-200 text-gray-500'}`}
                                                >
                                                    {t === 'CUSTOM' ? 'AI TEXTURE' : t}
                                                </button>
                                            ))}
                                        </div>

                                        {textureType === 'CUSTOM' && (
                                            <input 
                                                type="text" 
                                                placeholder="Descreva a textura (Ex: Jeans gasto...)" 
                                                className="w-full px-3 py-2 text-[10px] border border-gray-300 rounded bg-white"
                                            />
                                        )}

                                        <div>
                                            <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase mb-1">
                                                <span>Intensidade</span>
                                                <span>{textureOpacity}%</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="100" 
                                                value={textureOpacity} 
                                                onChange={(e) => setTextureOpacity(parseInt(e.target.value))}
                                                className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none accent-gray-600"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-gray-400 text-center italic">Ative para simular substratos (Algodão, Seda, etc).</p>
                                )}
                            </div>

                            {/* 6. AÇÕES */}
                            <div className="space-y-3 pt-4 border-t border-gray-100">
                                {!isProcessing && (
                                    <button 
                                        onClick={handleGenerate}
                                        className={`w-full py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 text-white ${printTechnique === 'DIGITAL' ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-vingi-900'}`}
                                    >
                                        <Wand2 size={18} className="text-white/80"/>
                                        {generatedPattern ? "GERAR NOVAMENTE" : `CRIAR ESTAMPA ${printTechnique}`}
                                    </button>
                                )}

                                {generatedPattern && !isProcessing && (
                                    <div className="grid grid-cols-2 gap-2 animate-fade-in">
                                        <button onClick={() => handleTransfer('MOCKUP')} className="py-3 bg-white border border-gray-200 text-gray-700 rounded-lg font-bold text-xs hover:bg-gray-50 flex items-center justify-center gap-2"><Settings2 size={14}/> PROVAR</button>
                                        <button onClick={() => { const l = document.createElement('a'); l.href = generatedPattern!; l.download = `vingi-estampa-${printTechnique.toLowerCase()}.png`; l.click(); }} className="py-3 bg-white border border-gray-200 text-gray-700 rounded-lg font-bold text-xs hover:bg-gray-50 flex items-center justify-center gap-2"><Download size={14}/> BAIXAR</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
