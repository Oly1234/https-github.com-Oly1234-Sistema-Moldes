
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Loader2, Grid3X3, Settings2, Image as ImageIcon, Type, Sparkles, FileWarning, RefreshCw, Sun, Moon, Contrast, Droplets, ArrowDownToLine, Move, ZoomIn, Minimize2, Check, Cylinder, Printer, Eye, Zap, Layers, Cpu, LayoutTemplate, PaintBucket, Ruler, Box, Target, BoxSelect, Maximize, Copy, FileText, PlusCircle, Pipette, Brush, PenTool, Scissors, Edit3, Feather, Frame, Send, ChevronRight, X } from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader, FloatingReference, ModuleLandingPage, SmartImageViewer } from '../components/Shared';

// --- COMPONENTS ---
const PantoneChip: React.FC<{ color: PantoneColor, onDelete?: () => void }> = ({ color, onDelete }) => {
    const [showMenu, setShowMenu] = useState(false);
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(color.hex);
    };
    return (
        <div onClick={() => setShowMenu(!showMenu)} className="flex flex-col bg-[#111] shadow-sm border border-gray-800 rounded-lg overflow-hidden cursor-pointer h-14 w-full group relative hover:scale-105 transition-transform">
            <div className="h-8 w-full relative" style={{ backgroundColor: color.hex }}>
                {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute top-1 right-1 bg-black/40 hover:bg-red-500 hover:text-white text-white rounded-full p-0.5 backdrop-blur-sm transition-colors"><XCircle size={10} /></button>}
            </div>
            <div className="flex-1 flex flex-col justify-center bg-[#1a1a1a] px-1.5 py-0.5">
                <span className="text-[9px] font-bold text-gray-300 truncate">{color.name}</span>
                <span className="text-[8px] text-gray-600 font-mono truncate">{color.code || color.hex}</span>
            </div>
            {showMenu && <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-2 animate-fade-in z-10"><button onClick={handleCopy} className="text-white text-[9px] font-bold flex items-center gap-1 hover:text-vingi-400"><Copy size={10}/> HEX</button></div>}
        </div>
    );
};

const XCircle = ({ size = 24, className = "" }) => ( <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg> );

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
            if (ctx) { ctx.drawImage(img, 0, 0, w, h); resolve(canvas.toDataURL('image/jpeg', 0.8)); } else reject(new Error("Canvas error"));
        };
        img.onerror = () => reject(new Error("Load error"));
    });
};

interface AtelierSystemProps {
    onNavigateToMockup?: () => void;
    onNavigateToLayerStudio?: () => void;
}

// --- CONFIGURAÇÕES DE LAYOUT E ESTILO ---
const LAYOUT_OPTIONS = [
    { id: 'ORIGINAL', label: 'Original', icon: ImageIcon },
    { id: 'CORRIDA', label: 'Corrida', icon: Layers },
    { id: 'BARRADO', label: 'Barrado', icon: ArrowDownToLine },
    { id: 'LENCO', label: 'Lenço', icon: Frame }, 
    { id: 'LOCALIZADA', label: 'Localizada', icon: Target },
    { id: 'PAREO', label: 'Pareô', icon: Maximize },
];

const SUB_LAYOUT_CONFIG: Record<string, { id: string, label: string, icon: any }[]> = {
    'LENCO': [
        { id: 'MEDALHAO', label: 'Medalhão', icon: Target },
        { id: 'BANDANA', label: 'Bandana', icon: BoxSelect },
        { id: 'LISTRADO', label: 'Listrado', icon: Grid3X3 },
        { id: 'FLORAL', label: 'Floral Frame', icon: Feather },
    ],
    'BARRADO': [
        { id: 'SIMPLES', label: 'Simples', icon: ArrowDownToLine },
        { id: 'DUPLO', label: 'Espelhado', icon: ArrowDownToLine }, 
        { id: 'DEGRADE', label: 'Degradê', icon: Droplets },
    ],
    'CORRIDA': [
        { id: 'TOSS', label: 'Aleatório', icon: Sparkles },
        { id: 'GRID', label: 'Grid', icon: Grid3X3 },
        { id: 'ORGANIC', label: 'Orgânico', icon: Droplets },
    ]
};

const ART_STYLES = [
    { id: 'ORIGINAL', label: 'Original', icon: ImageIcon },
    { id: 'WATERCOLOR', label: 'Aquarela', icon: Droplets },
    { id: 'GIZ', label: 'Giz Pastel', icon: Edit3 },
    { id: 'ACRILICA', label: 'Acrílica', icon: Palette },
    { id: 'VETOR', label: 'Vetor Flat', icon: Box },
    { id: 'BORDADO', label: 'Bordado', icon: Scissors },
    { id: 'LINHA', label: 'Line Art', icon: PenTool },
    { id: 'ORNAMENTAL', label: 'Barroco', icon: Feather },
];

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    const [creationMode, setCreationMode] = useState<'IMAGE' | 'TEXT'>('IMAGE');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    
    // Prompt System
    const [userPrompt, setUserPrompt] = useState<string>(''); // Prompt da IA
    const [customInstruction, setCustomInstruction] = useState<string>(''); // Prompt do Usuário (Novo)

    const [printTechnique, setPrintTechnique] = useState<'CYLINDER' | 'DIGITAL'>('CYLINDER');
    const [colors, setColors] = useState<PantoneColor[]>([]);
    const [colorCount, setColorCount] = useState<number>(0); 
    
    // LAYOUT & STYLE STATE
    const [targetLayout, setTargetLayout] = useState<string>('ORIGINAL');
    const [subLayout, setSubLayout] = useState<string>(''); 
    const [artStyle, setArtStyle] = useState<string>('ORIGINAL');

    const [customColorInput, setCustomColorInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial Load Transfer Check
    useEffect(() => {
        const transferImage = localStorage.getItem('vingi_transfer_image');
        if (transferImage) {
            handleReferenceUpload(transferImage);
            localStorage.removeItem('vingi_transfer_image');
        }
    }, []);

    useEffect(() => { setSubLayout(''); }, [targetLayout]);

    const resetSession = () => {
        setReferenceImage(null); setGeneratedPattern(null); setUserPrompt(''); setCustomInstruction(''); setColors([]); setError(null); setCreationMode('IMAGE');
        setTargetLayout('ORIGINAL'); setSubLayout(''); setArtStyle('ORIGINAL'); setColorCount(0); 
    };

    const analyzePrompt = async (cleanBase64: string) => {
        try {
            const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ANALYZE_REFERENCE_FOR_PROMPT', mainImageBase64: cleanBase64 }) });
            const data = await res.json();
            if (data.success && data.prompt) setUserPrompt(data.prompt);
        } catch (e) { console.warn("Erro no Prompt Auto:", e); }
    };

    const analyzeColors = async (cleanBase64: string, variation: string = 'NATURAL') => {
        try {
            const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ANALYZE_COLOR_TREND', mainImageBase64: cleanBase64, variation }) });
            const data = await res.json();
            if (data.success && data.colors) setColors(data.colors);
        } catch (e) { console.warn("Erro no Color Dept:", e); }
    };

    const handleReferenceUpload = async (imgBase64: string) => {
        setReferenceImage(imgBase64); setCreationMode('IMAGE'); setIsProcessing(true); setStatusMessage("Extraindo DNA & Cores...");
        try {
            const compressed = await compressImage(imgBase64); const cleanBase64 = compressed.split(',')[1];
            await Promise.allSettled([ analyzePrompt(cleanBase64), analyzeColors(cleanBase64, 'NATURAL') ]);
        } catch (e) { console.error(e); } finally { setIsProcessing(false); }
    };

    const handleGenerate = async () => {
        if (!userPrompt.trim()) { setError("Aguarde a análise da referência ou digite um prompt."); return; }
        
        // CONCATENATE USER INSTRUCTION TO PROMPT
        const finalPrompt = customInstruction 
            ? `USER DIRECTIVE: "${customInstruction}". \nBASE DESCRIPTION: ${userPrompt}` 
            : userPrompt;

        setIsProcessing(true); setStatusMessage(printTechnique === 'DIGITAL' ? "Renderizando Detalhes 4K..." : "Gerando Vetores Chapados...");
        setGeneratedPattern(null); setError(null);
        setTimeout(() => setStatusMessage("Aplicando Layout & Estilo..."), 1200);
        
        try {
            const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                action: 'GENERATE_PATTERN', 
                prompt: finalPrompt, 
                colors: colors, 
                selvedge: 'NENHUMA', 
                layoutStyle: targetLayout, 
                subLayoutStyle: subLayout, 
                artStyle: artStyle,
                colorCount: colorCount, 
                technique: printTechnique 
            }) });
            const data = await res.json();
            if (data.success && data.image) {
                setGeneratedPattern(data.image);
            } else { throw new Error(data.error || "A IA não conseguiu gerar."); }
        } catch (err: any) { setError(err.message); } finally { setIsProcessing(false); }
    };

    const handleTransfer = (target: string) => {
        if (!generatedPattern) return;
        triggerTransfer(target, generatedPattern);
        if (target === 'MOCKUP' && onNavigateToMockup) onNavigateToMockup();
        if (target === 'LAYER' && onNavigateToLayerStudio) onNavigateToLayerStudio();
    };

    const handleAddCustomColor = () => {
        if (!customColorInput) return;
        const newColor: PantoneColor = { name: "Manual", code: customColorInput, hex: customColorInput.startsWith('#') ? customColorInput : '#000', role: 'User' };
        setColors(prev => [newColor, ...prev]); setCustomColorInput('');
    };

    const hasActiveSession = referenceImage || generatedPattern;

    return (
        <div className="h-full w-full bg-[#000000] flex flex-col overflow-hidden text-white">
            {/* HEADER COMPACTO DARK */}
            <div className="bg-[#111111] px-4 py-2 flex items-center justify-between border-b border-gray-900 shrink-0 z-50 h-14">
                <div className="flex items-center gap-2"><Palette size={18} className="text-vingi-400"/><span className="font-bold text-sm">Atelier AI</span></div>
                <div className="flex gap-2">
                    {hasActiveSession && (
                        <button onClick={resetSession} className="text-[10px] bg-gray-800 px-3 py-1.5 rounded hover:bg-gray-700 font-medium border border-gray-700">Novo</button>
                    )}
                    {generatedPattern && (
                        <div className="flex gap-1">
                            <button onClick={() => handleTransfer('MOCKUP')} className="text-[10px] bg-vingi-900 text-white px-3 py-1.5 rounded font-bold hover:bg-vingi-800 flex items-center gap-1 border border-vingi-700"><Settings2 size={12}/> Provar</button>
                            <button onClick={() => { const l=document.createElement('a'); l.download='vingi-pattern.png'; l.href=generatedPattern; l.click(); }} className="text-[10px] bg-green-900 text-white px-3 py-1.5 rounded font-bold hover:bg-green-800 flex items-center gap-1 border border-green-700"><Download size={12}/> Baixar</button>
                        </div>
                    )}
                </div>
            </div>

            {!hasActiveSession ? (
                <div className="flex-1 bg-[#050505] overflow-y-auto">
                    <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onload=(ev)=>handleReferenceUpload(ev.target?.result as string); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
                    <ModuleLandingPage 
                        icon={Palette} 
                        title="Atelier Generativo" 
                        description="Crie estampas exclusivas a partir de referências visuais. Combine estilos artísticos, layouts de lenço e paletas Pantone." 
                        primaryActionLabel="Criar Estampa" 
                        onPrimaryAction={() => fileInputRef.current?.click()} 
                        features={["Vetorial & Digital", "Variação de Estilo", "Layouts de Lenço", "Pantone TCX"]}
                        customContent={
                            <div className="flex flex-col gap-6 mt-8 w-full max-w-2xl mx-auto">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Escolha a Tecnologia de Impressão</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button onClick={() => { setPrintTechnique('CYLINDER'); fileInputRef.current?.click(); }} className="bg-[#111] border border-gray-800 p-6 rounded-2xl hover:border-vingi-500 transition-all flex flex-col items-center gap-3 group text-center">
                                        <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center group-hover:bg-vingi-900 transition-colors"><Cylinder size={24} className="text-gray-400 group-hover:text-vingi-400"/></div>
                                        <div><h3 className="text-lg font-bold text-white">Cilindro (Vetorial)</h3><p className="text-xs text-gray-500 mt-1">Cores chapadas, separação nítida.</p></div>
                                    </button>
                                    <button onClick={() => { setPrintTechnique('DIGITAL'); fileInputRef.current?.click(); }} className="bg-[#111] border border-gray-800 p-6 rounded-2xl hover:border-purple-500 transition-all flex flex-col items-center gap-3 group text-center">
                                        <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center group-hover:bg-purple-900 transition-colors"><Printer size={24} className="text-gray-400 group-hover:text-purple-400"/></div>
                                        <div><h3 className="text-lg font-bold text-white">Digital (4K)</h3><p className="text-xs text-gray-500 mt-1">Textura fotográfica, degradês complexos.</p></div>
                                    </button>
                                </div>
                            </div>
                        }
                    />
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0">
                    {/* CANVAS AREA */}
                    <div className="flex-1 bg-[#050505] relative flex items-center justify-center p-4 min-h-[40vh]">
                        {/* Background Grid */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                        
                        {isProcessing ? (
                            <div className="text-center relative z-10 animate-fade-in flex flex-col items-center">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-vingi-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                                    <Loader2 size={48} className="text-vingi-400 animate-spin relative z-10 mb-6"/>
                                </div>
                                <h2 className="text-white font-bold text-xl tracking-tight">{statusMessage}</h2>
                                <p className="text-gray-500 text-xs mt-2 font-mono uppercase tracking-widest">Processando IA...</p>
                            </div>
                        ) : generatedPattern ? (
                            <div className="relative shadow-2xl bg-white w-full h-full max-h-[80vh] max-w-[80vh] flex items-center justify-center border border-gray-800 animate-fade-in group overflow-hidden rounded-sm">
                                <SmartImageViewer src={generatedPattern} />
                            </div>
                        ) : (
                            <div className="relative shadow-xl w-full h-full max-h-[60vh] max-w-[60vh] flex items-center justify-center border-2 border-dashed border-gray-800 rounded-xl opacity-50">
                                <div className="text-center">
                                    <Grid3X3 size={48} className="mx-auto mb-4 text-gray-700"/>
                                    <p className="text-gray-500 text-sm">Preview da Estampa</p>
                                </div>
                            </div>
                        )}
                        {error && ( <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-900/90 text-white px-6 py-4 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 animate-bounce-subtle z-50 border border-red-700 max-w-md backdrop-blur"><FileWarning size={20} className="shrink-0"/> <div><p>{error}</p></div></div> )}
                        
                        {/* Floating Reference (Mini) */}
                        {referenceImage && <div className="absolute bottom-4 left-4 w-20 h-20 rounded-lg border-2 border-gray-700 overflow-hidden shadow-lg bg-black z-20"><img src={referenceImage} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" /></div>}
                    </div>

                    {/* CONTROL DECK (INSHOT STYLE - SIDEBAR ON DESKTOP, BOTTOM SHEET ON MOBILE) */}
                    <div className="w-full md:w-[380px] bg-[#111] border-t md:border-t-0 md:border-l border-gray-800 flex flex-col z-20 shadow-2xl h-[55vh] md:h-full shrink-0">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                            
                            {/* 1. MAGIC INPUT (DIREÇÃO CRIATIVA) */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={12} className="text-vingi-400"/> Direção Criativa</h3>
                                </div>
                                <div className="relative group">
                                    <textarea 
                                        value={customInstruction} 
                                        onChange={(e) => setCustomInstruction(e.target.value)} 
                                        className="w-full h-20 p-3 bg-[#1a1a1a] border border-gray-800 rounded-xl text-xs resize-none focus:border-vingi-500 outline-none text-white placeholder-gray-600 transition-all focus:bg-black" 
                                        placeholder="Ex: Deixe mais vintage, adicione flores azuis, fundo preto..."
                                    />
                                    <div className="absolute bottom-2 right-2 text-[8px] text-gray-600 font-mono">IA PROMPT MODIFIER</div>
                                </div>
                            </div>

                            {/* 2. CORES (EXTRAÍDAS) */}
                            {(colors.length > 0) && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Palette size={12}/> Paleta Detectada</h3>
                                        <span className="text-[9px] text-gray-600">{colors.length} Cores</span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {colors.map((c, i) => ( <PantoneChip key={i} color={c} onDelete={() => setColors(prev => prev.filter((_, idx) => idx !== i))} /> ))}
                                    </div>
                                </div>
                            )}

                            {/* 3. SCROLL HORIZONTAL DE LAYOUTS */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><LayoutTemplate size={12}/> Layout da Estampa</h3>
                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                    {LAYOUT_OPTIONS.map(opt => (
                                        <button 
                                            key={opt.id} 
                                            onClick={() => setTargetLayout(opt.id)}
                                            className={`flex flex-col items-center justify-center min-w-[64px] h-[64px] p-1 rounded-lg border transition-all ${targetLayout === opt.id ? 'bg-vingi-900 border-vingi-500 text-white shadow-sm' : 'bg-[#1a1a1a] border-gray-800 text-gray-500 hover:bg-gray-800'}`}
                                        >
                                            <opt.icon size={20} strokeWidth={1.5} className="mb-1.5"/>
                                            <span className="text-[9px] font-bold">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                                
                                {/* SUB-LAYOUT CONTEXTUAL (Expandido) */}
                                {SUB_LAYOUT_CONFIG[targetLayout] && (
                                    <div className="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 animate-slide-down">
                                        <div className="grid grid-cols-2 gap-2">
                                            {SUB_LAYOUT_CONFIG[targetLayout].map(sub => (
                                                <button 
                                                    key={sub.id} 
                                                    onClick={() => setSubLayout(sub.id)}
                                                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-bold transition-all ${subLayout === sub.id ? 'bg-white text-black border-white' : 'bg-transparent border-gray-700 text-gray-400 hover:bg-gray-800'}`}
                                                >
                                                    <sub.icon size={12} /> {sub.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 4. ESTILO ARTÍSTICO (GRID) */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Brush size={12}/> Estilo Artístico</h3>
                                <div className="grid grid-cols-4 gap-2">
                                    {ART_STYLES.map(style => (
                                        <button 
                                            key={style.id} 
                                            onClick={() => setArtStyle(style.id)}
                                            className={`flex flex-col items-center justify-center h-16 p-1 rounded-lg border transition-all ${artStyle === style.id ? 'bg-purple-900/50 border-purple-500 text-purple-200 shadow-sm' : 'bg-[#1a1a1a] border-gray-800 text-gray-500 hover:bg-gray-800'}`}
                                        >
                                            <style.icon size={18} strokeWidth={1.5} className="mb-1"/>
                                            <span className="text-[9px] font-bold text-center leading-none">{style.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* BIG GENERATE BUTTON */}
                        <div className="p-4 border-t border-gray-800 bg-[#0a0a0a] pb-[env(safe-area-inset-bottom)]">
                            {!isProcessing && (
                                <button onClick={handleGenerate} className={`w-full py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 text-white transition-transform active:scale-95 text-sm ${printTechnique === 'DIGITAL' ? 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:brightness-110' : 'bg-gradient-to-r from-vingi-700 to-blue-700 hover:brightness-110'}`}>
                                    <Wand2 size={18}/> {generatedPattern ? "Regerar Variação" : "Gerar Estampa"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
