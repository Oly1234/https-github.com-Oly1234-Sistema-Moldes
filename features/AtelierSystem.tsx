
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Loader2, Grid3X3, Settings2, Image as ImageIcon, Type, Sparkles, FileWarning, RefreshCw, Sun, Moon, Contrast, Droplets, ArrowDownToLine, Move, ZoomIn, Minimize2, Check, Cylinder, Printer, Eye, Zap } from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader, FloatingReference } from '../components/Shared';
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

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    // --- ESTADOS GERAIS ---
    const [creationMode, setCreationMode] = useState<'IMAGE' | 'TEXT'>('IMAGE');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [userPrompt, setUserPrompt] = useState<string>('');
    
    // --- ESTADOS TÉCNICOS ---
    const [printTechnique, setPrintTechnique] = useState<'CYLINDER' | 'DIGITAL'>('CYLINDER');
    const [colors, setColors] = useState<PantoneColor[]>([]);
    const [selvedgePos, setSelvedgePos] = useState<SelvedgePosition>('Inferior');
    const [useSelvedge, setUseSelvedge] = useState(false);
    
    // --- ESTADOS DE TEXTURA (DIGITAL MODE) ---
    const [useTextureOverlay, setUseTextureOverlay] = useState(false);
    const [textureOpacity, setTextureOpacity] = useState(30); // %
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
        setTimeout(() => setStatusMessage(printTechnique === 'DIGITAL' ? "Aplicando Iluminação..." : "Separando Cores..."), 1500);

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: userPrompt,
                    colors: colors, // Envia cores atuais
                    selvedge: useSelvedge ? selvedgePos : 'NENHUMA', // Envia info técnica
                    technique: printTechnique // CYLINDER vs DIGITAL
                })
            });

            const data = await res.json();
            if (data.success && data.image) {
                setGeneratedPattern(data.image);
                // Ativa overlay automaticamente se for Digital
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
        // Se estiver no modo Digital com Overlay, deveríamos idealmente "fundir" as imagens antes.
        // Como simplificação, enviamos a base.
        if (!generatedPattern) return;
        triggerTransfer(target, generatedPattern);
        if (target === 'MOCKUP' && onNavigateToMockup) onNavigateToMockup();
        if (target === 'LAYER' && onNavigateToLayerStudio) onNavigateToLayerStudio();
    };

    return (
        <div className="h-full bg-[#f8fafc] flex flex-col overflow-hidden">
            <ModuleHeader 
                icon={Palette} 
                title="Estúdio de Criação" 
                subtitle={printTechnique === 'CYLINDER' ? "Modo Rotativo (Vetorial)" : "Modo Digital (Alta Definição)"}
                actionLabel={referenceImage || generatedPattern ? "Reiniciar" : undefined}
                onAction={resetSession}
                rightContent={
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button 
                            onClick={() => setPrintTechnique('CYLINDER')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${printTechnique === 'CYLINDER' ? 'bg-white shadow-sm text-vingi-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Cylinder size={12}/> ROTATIVA
                        </button>
                        <button 
                            onClick={() => setPrintTechnique('DIGITAL')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${printTechnique === 'DIGITAL' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Printer size={12}/> DIGITAL
                        </button>
                    </div>
                }
            />

            {/* MODAL FLUTUANTE DE REFERÊNCIA (Só aparece se tiver imagem) */}
            {referenceImage && <FloatingReference image={referenceImage} label="Inspiração" />}

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
                            
                            {/* OVERLAY DE TEXTURA DIGITAL */}
                            {printTechnique === 'DIGITAL' && useTextureOverlay && (
                                <div 
                                    className="absolute inset-0 pointer-events-none w-full h-full"
                                    style={{
                                        // Standard Noise/Weave Pattern simulation via CSS
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                                        opacity: textureOpacity / 100,
                                        mixBlendMode: textureBlend
                                    }}
                                />
                            )}

                            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[9px] px-2 py-1 rounded backdrop-blur font-mono flex flex-col items-end">
                                <span>{printTechnique} QUALITY</span>
                                {useSelvedge && <span>BARRADO {selvedgePos.toUpperCase()}</span>}
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
                            <Type size={14}/> POR TEXTO (TEXT-TO-PRINT)
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
                                {referenceImage && (
                                    <div className="mt-3 flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                                        <button onClick={() => setUseSelvedge(!useSelvedge)} className={`px-2 py-1 rounded text-[9px] font-bold border flex items-center gap-1 shrink-0 ${useSelvedge ? 'bg-vingi-100 border-vingi-300 text-vingi-700' : 'bg-white border-gray-200 text-gray-500'}`}>
                                            <ArrowDownToLine size={10}/> {useSelvedge ? 'Ourela Ativa' : 'Definir Ourela'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* FERRAMENTA DE OURELA (CONDICIONAL) */}
                        {creationMode === 'IMAGE' && referenceImage && useSelvedge && (
                            <div className="animate-fade-in">
                                <SelvedgeTool 
                                    image={referenceImage} 
                                    selectedPos={selvedgePos} 
                                    onSelect={setSelvedgePos} 
                                    active={true}
                                />
                                <p className="text-[9px] text-gray-400 text-center mt-1">Defina onde ficará o barrado da estampa.</p>
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

                        {/* 3. CORES & PANTONES */}
                        {(colors.length > 0 || creationMode === 'TEXT') && printTechnique === 'CYLINDER' && (
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Palette size={14}/> Paleta Técnica (Cilindro)
                                    </h3>
                                    {creationMode === 'IMAGE' && referenceImage && (
                                        <div className="flex bg-gray-100 rounded-lg p-0.5">
                                            <button onClick={() => handleColorVariation('NATURAL')} title="Natural" className="p-1 hover:bg-white rounded text-gray-500 hover:text-vingi-600"><Droplets size={12}/></button>
                                            <button onClick={() => handleColorVariation('VIVID')} title="Mais Vivo" className="p-1 hover:bg-white rounded text-gray-500 hover:text-orange-500"><Sun size={12}/></button>
                                            <button onClick={() => handleColorVariation('PASTEL')} title="Pastel" className="p-1 hover:bg-white rounded text-gray-500 hover:text-pink-400"><Contrast size={12}/></button>
                                            <button onClick={() => handleColorVariation('DARK')} title="Escuro" className="p-1 hover:bg-white rounded text-gray-500 hover:text-slate-800"><Moon size={12}/></button>
                                        </div>
                                    )}
                                </div>
                                
                                {loadingColors ? (
                                    <div className="h-16 flex items-center justify-center text-xs text-gray-400 gap-2"><Loader2 size={14} className="animate-spin"/> Recalculando Cores...</div>
                                ) : (
                                    <div className="grid grid-cols-4 gap-2">
                                        {colors.slice(0, 4).map((c, i) => (
                                            <PantoneChip key={i} color={c} onClick={() => {}} />
                                        ))}
                                        {colors.length === 0 && creationMode === 'TEXT' && (
                                            <div className="col-span-4 text-center text-[10px] text-gray-400 py-2 border border-dashed rounded bg-gray-50">
                                                Cores automáticas.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 4. DIGITAL TEXTURE CONTROL (Somente no Modo Digital) */}
                        {printTechnique === 'DIGITAL' && (
                            <div className="animate-fade-in bg-purple-50 border border-purple-100 rounded-xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-xs font-bold text-purple-700 uppercase tracking-widest flex items-center gap-2">
                                        <Zap size={14}/> Acabamento Digital
                                    </h3>
                                    <button 
                                        onClick={() => setUseTextureOverlay(!useTextureOverlay)}
                                        className={`p-1 rounded transition-colors ${useTextureOverlay ? 'text-purple-600 bg-white shadow-sm' : 'text-gray-400'}`}
                                        title={useTextureOverlay ? "Textura Ativa" : "Sem Textura"}
                                    >
                                        <Eye size={16}/>
                                    </button>
                                </div>
                                
                                {useTextureOverlay ? (
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-[9px] font-bold text-purple-400 uppercase mb-1">
                                                <span>Intensidade da Trama</span>
                                                <span>{textureOpacity}%</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="100" 
                                                value={textureOpacity} 
                                                onChange={(e) => setTextureOpacity(parseInt(e.target.value))}
                                                className="w-full h-1.5 bg-purple-200 rounded-lg appearance-none accent-purple-600"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-bold text-purple-400 uppercase mb-1 block">Modo de Fusão</span>
                                            <div className="flex gap-1">
                                                {['multiply', 'overlay', 'soft-light'].map((m) => (
                                                    <button 
                                                        key={m}
                                                        onClick={() => setTextureBlend(m as any)}
                                                        className={`flex-1 py-1.5 text-[9px] font-bold rounded border uppercase ${textureBlend === m ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-400 border-purple-200'}`}
                                                    >
                                                        {m.replace('-', ' ')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-purple-400 text-center italic">Ative a textura para simular tecidos (Overlay).</p>
                                )}
                            </div>
                        )}

                        {/* 5. AÇÕES */}
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
        </div>
    );
};