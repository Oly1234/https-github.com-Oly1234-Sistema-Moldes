import React, { useState, useRef, useEffect } from 'react';
// Add RotateCcw to lucide-react imports
import { UploadCloud, Wand2, Download, Palette, Loader2, Grid, Layers, Target, Droplets, Zap, Sparkles, Image as ImageIcon, Check, ChevronRight, Pipette, Brush, Box, Ruler, Scissors, LayoutTemplate, Frame, ArrowDownToLine, MousePointer2, Settings2, Maximize2, Move, Type, Sticker, RotateCcw } from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader, ModuleLandingPage, SmartImageViewer } from '../components/Shared';
import { PantoneGrid } from '../components/PantoneHub';

const LAYOUT_OPTIONS = [
    { id: 'CORRIDA', label: 'Corrida (All-over)', icon: Layers },
    { id: 'BARRADO', label: 'Barrado Técnico', icon: ArrowDownToLine },
    { id: 'LENCO', label: 'Lenço (Square)', icon: Frame }, 
    { id: 'LOCALIZADA', label: 'Localizada', icon: Target },
    { id: 'HALF_DROP', label: 'Half-Drop', icon: Grid },
    { id: 'RAPPORT_4WAY', label: 'Rapport 4-Way', icon: Move },
    { id: 'XADREZ', label: 'Xadrez / Grid', icon: LayoutTemplate }
];

// Define Minus before it is used in ART_STYLES
const Minus = ({ size, className }: any) => <div className={className} style={{ width: size, height: 2, background: 'currentColor' }} />;

const ART_STYLES = [
    { id: 'WATERCOLOR', label: 'Aquarela Fluida', icon: Droplets },
    { id: 'VETOR', label: 'Vetor Flat 2D', icon: Box },
    { id: 'BORDADO', label: 'Bordado / Stitch', icon: Scissors },
    { id: 'ORNAMENTAL', label: 'Barroco / Damask', icon: LayoutTemplate },
    { id: 'REALISM', label: 'Realismo Têxtil', icon: ImageIcon },
    { id: 'POP_ART', label: 'Pop Art / Screen', icon: Sticker },
    { id: 'MINIMALIST', label: 'Minimalista', icon: Minus },
    { id: 'VINTAGE', label: 'Vintage 70s', icon: RotateCcw }
];

export const AtelierSystem: React.FC<{ onNavigateToMockup: () => void, onNavigateToLayerStudio: () => void }> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [userPrompt, setUserPrompt] = useState<string>(''); 
    const [colors, setColors] = useState<PantoneColor[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeLayout, setActiveLayout] = useState('CORRIDA');
    const [activeStyle, setActiveStyle] = useState('VETOR');
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const studioRef = useRef<HTMLDivElement>(null);

    // Garante que o scroll não pule no mobile
    useEffect(() => {
        if (colors.length > 0 && studioRef.current) {
            // No mobile, o scroll é gerenciado pelo overflow-y do painel lateral
        }
    }, [colors]);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const r = new FileReader();
            r.onload = (ev) => {
                const base64 = ev.target?.result as string;
                setReferenceImage(base64);
                analyzeReference(base64);
            };
            r.readAsDataURL(file);
        }
    };

    const analyzeReference = async (base64: string) => {
        setIsProcessing(true);
        setColors([]); // Reseta cores para forçar fase de análise
        try {
            const clean = base64.split(',')[1];
            const res = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ action: 'ANALYZE_COLOR_TREND', mainImageBase64: clean, variation: 'NATURAL' }) 
            });
            const data = await res.json();
            if (data.success) setColors(data.colors);
        } catch (e) { console.error(e); } finally { setIsProcessing(false); }
    };

    const handleGenerate = async () => {
        setIsProcessing(true);
        setGeneratedPattern(null);
        try {
            const res = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: userPrompt || "Exclusive textile print", 
                    colors: colors, 
                    layoutStyle: activeLayout, 
                    artStyle: activeStyle 
                }) 
            });
            const data = await res.json();
            if (data.success) setGeneratedPattern(data.image);
        } catch (e) { console.error(e); } finally { setIsProcessing(false); }
    };

    // Estágios da Interface
    const isStudioUnlocked = colors.length > 0;

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden fixed inset-0">
            {/* Header Fixo */}
            <div className="bg-[#111] h-14 border-b border-white/5 px-4 flex items-center justify-between shrink-0 z-[100]">
                <div className="flex items-center gap-2">
                    <div className="bg-vingi-900/50 p-1.5 rounded-lg border border-vingi-500/30 text-vingi-400"><Palette size={18}/></div>
                    <div className="flex flex-col">
                        <span className="font-black text-[10px] uppercase tracking-widest leading-none">Atelier AI Studio</span>
                        <span className="text-[8px] text-vingi-500 font-bold uppercase tracking-tighter mt-1">Design de Superfície 4.0</span>
                    </div>
                </div>
                {generatedPattern && (
                    <button onClick={() => setShowDownloadMenu(true)} className="bg-white text-black px-4 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-transform active:scale-95 shadow-lg"><Download size={12}/> Salvar</button>
                )}
            </div>

            {!referenceImage ? (
                <div className="flex-1 bg-white">
                    <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/*" />
                    <ModuleLandingPage icon={Palette} title="Atelier de Estamparia" description="Extraia o DNA cromático de referências reais e gere estampas industriais exclusivas com controle de layout e estilo artístico." primaryActionLabel="Selecionar Referência" onPrimaryAction={() => fileInputRef.current?.click()} partners={["PANTONE TCX", "VINGI GENERATIVE", "CAD TEXTILE"]} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                    
                    {/* Visualizador de Referência / Preview (Lado Esquerdo) */}
                    <div className="flex-1 relative bg-[#080808] flex items-center justify-center p-6 md:p-12 overflow-hidden">
                        
                        {/* Fundo com Grid Técnico */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

                        {isProcessing && !generatedPattern ? (
                            <div className="flex flex-col items-center animate-fade-in z-10">
                                <div className="relative mb-6">
                                    <div className="absolute inset-0 bg-vingi-500 blur-[40px] opacity-20 animate-pulse"></div>
                                    <Loader2 size={48} className="text-vingi-400 animate-spin relative" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 text-center">
                                    {colors.length === 0 ? "Extraindo DNA das Cores..." : "Gerando Estampa Técnica..."}
                                </span>
                            </div>
                        ) : generatedPattern ? (
                            <div className="w-full h-full max-w-4xl max-h-4xl relative shadow-[0_0_100px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden border border-white/5 animate-fade-in">
                                <SmartImageViewer src={generatedPattern} />
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <div className="relative max-w-md w-full aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-[#111] animate-fade-in">
                                    <img src={referenceImage} className="w-full h-full object-cover grayscale opacity-40 blur-sm" />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                                        <Pipette size={40} className="text-vingi-400 mb-4 animate-bounce" />
                                        <p className="text-[11px] font-black uppercase tracking-widest text-white/50">Cores extraídas com sucesso. Libere as ferramentas de design no menu ao lado.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Thumbnail Flutuante da Referência Original */}
                        {isStudioUnlocked && (
                            <div className="absolute bottom-6 left-6 w-20 h-20 md:w-28 md:h-28 rounded-2xl border-2 border-white/10 overflow-hidden shadow-2xl bg-black hover:scale-110 transition-all z-[60] cursor-help group">
                                <img src={referenceImage} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <span className="text-[8px] font-black uppercase">REF</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Menu de Ferramentas (Lado Direito - Aparece só após cores) */}
                    {isStudioUnlocked && (
                        <div className="w-full md:w-80 bg-[#0a0a0a] border-l border-white/5 flex flex-col shadow-2xl z-40 animate-slide-right">
                            <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar pb-32">
                                
                                {/* 1. Cores Pantone */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Pipette size={14} className="text-vingi-400"/> Colorimetria Têxtil</h3>
                                        <button onClick={() => analyzeReference(referenceImage!)} className="text-[8px] font-black text-vingi-500 hover:text-vingi-400 uppercase tracking-widest">Recalcular</button>
                                    </div>
                                    <PantoneGrid colors={colors} onDelete={(idx) => setColors(prev => prev.filter((_, i) => i !== idx))} columns={4} />
                                </div>

                                {/* 2. Layouts Industriais */}
                                <div className="space-y-4">
                                    <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Grid size={14} className="text-gray-600"/> Layout & Rapport</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {LAYOUT_OPTIONS.map(opt => (
                                            <button key={opt.id} onClick={() => setActiveLayout(opt.id)} className={`flex items-center gap-2 p-3 rounded-xl border text-[9px] font-bold transition-all ${activeLayout === opt.id ? 'bg-white text-black border-white shadow-[0_5px_15px_rgba(255,255,255,0.1)]' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'}`}>
                                                <opt.icon size={14}/> {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 3. Estilos Artísticos */}
                                <div className="space-y-4">
                                    <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Brush size={14} className="text-gray-600"/> Técnica & Arte</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {ART_STYLES.map(opt => (
                                            <button key={opt.id} onClick={() => setActiveStyle(opt.id)} className={`flex items-center gap-2 p-3 rounded-xl border text-[9px] font-bold transition-all ${activeStyle === opt.id ? 'bg-white text-black border-white shadow-[0_5px_15px_rgba(255,255,255,0.1)]' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'}`}>
                                                <opt.icon size={14}/> {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 4. Direção de Arte (Prompt) */}
                                <div className="space-y-3">
                                    <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14} className="text-vingi-400"/> Direção Criativa</h3>
                                    <textarea 
                                        value={userPrompt} 
                                        onChange={(e) => setUserPrompt(e.target.value)} 
                                        className="w-full h-24 p-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-bold focus:border-vingi-500 outline-none text-white placeholder-gray-700 transition-all resize-none" 
                                        placeholder="Ex: Adicionar flores de hibisco em estilo vintage com traços finos..."
                                    />
                                </div>
                            </div>

                            {/* Botão Gerar Fixo no Menu */}
                            <div className="p-5 bg-[#0a0a0a] border-t border-white/5 shrink-0">
                                <button 
                                    onClick={handleGenerate} 
                                    disabled={isProcessing} 
                                    className="w-full py-4 bg-vingi-600 hover:bg-vingi-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16} className="fill-white"/>} Gerar Estampa Têxtil
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Menu de Download */}
            {showDownloadMenu && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-[#111] border border-white/10 rounded-[3rem] p-10 max-w-md w-full text-center space-y-6 shadow-2xl">
                        <div className="w-16 h-16 bg-vingi-900 rounded-2xl flex items-center justify-center mx-auto border border-vingi-500/30">
                            <Download className="text-vingi-400" size={32}/>
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-widest">Exportar Estampa</h3>
                        <p className="text-gray-500 text-[10px] font-bold uppercase">A imagem será salva em alta definição (Digital 4K) para produção industrial.</p>
                        <div className="grid gap-2">
                            <button onClick={() => { const l=document.createElement('a'); l.download='vingi-pattern-4k.png'; l.href=generatedPattern!; l.click(); setShowDownloadMenu(false); }} className="w-full py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-3 transition-all hover:bg-gray-100"><ImageIcon size={14}/> Download PNG (4K)</button>
                            <button onClick={() => setShowDownloadMenu(false)} className="text-[10px] text-gray-500 font-bold uppercase hover:text-white pt-4">Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};