
import React, { useState, useRef, useEffect } from 'react';
// Added ArrowDownToLine to imports
import { UploadCloud, Wand2, Download, Palette, Loader2, Grid, Layers, Target, Droplets, Zap, Copy, ExternalLink, Search, X, RefreshCw, Sparkles, SlidersHorizontal, Image as ImageIcon, Check, ChevronRight, Pipette, Brush, Box, Ruler, Scissors, LayoutTemplate, Frame, ArrowDownToLine } from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader, ModuleLandingPage, SmartImageViewer } from '../components/Shared';

const PantoneChip: React.FC<{ color: PantoneColor, onDelete?: () => void }> = ({ color, onDelete }) => {
    const [showMenu, setShowMenu] = useState(false);
    
    const handleCopyHex = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(color.hex);
        setShowMenu(false);
    };

    const handleSearchPantone = (e: React.MouseEvent) => {
        e.stopPropagation();
        const query = color.code ? color.code : `${color.name} Pantone`;
        window.open(`https://www.pantone.com/color-finder/${query.replace(/\s+/g, '-')}`, '_blank');
        setShowMenu(false);
    };

    const handleSearchGoogle = (e: React.MouseEvent) => {
        e.stopPropagation();
        const query = `${color.code || color.hex} textile color trend`;
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
        setShowMenu(false);
    };

    return (
        <div 
            onClick={() => setShowMenu(!showMenu)} 
            className="flex flex-col bg-[#111] shadow-xl border border-white/5 rounded-xl overflow-hidden cursor-pointer h-16 w-full group relative hover:scale-105 transition-all duration-300"
        >
            <div className="h-9 w-full relative" style={{ backgroundColor: color.hex }}>
                {onDelete && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                        className="absolute top-1 right-1 bg-black/40 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X size={8} />
                    </button>
                )}
            </div>
            <div className="flex-1 flex flex-col justify-center bg-[#1a1a1a] px-2 py-1">
                <span className="text-[8px] font-black text-white/90 truncate uppercase tracking-tighter">{color.name}</span>
                <span className="text-[7px] text-gray-500 font-mono truncate">{color.code || color.hex}</span>
            </div>

            {showMenu && (
                <div className="absolute inset-0 bg-black/95 backdrop-blur-md flex flex-col items-stretch justify-center p-1 gap-1 animate-fade-in z-50">
                    <button onClick={handleCopyHex} className="flex items-center justify-between px-2 py-1 hover:bg-white/10 rounded-md text-[8px] font-bold text-white uppercase tracking-tighter">
                        <span>COPIAR HEX</span> <Copy size={8}/>
                    </button>
                    <button onClick={handleSearchGoogle} className="flex items-center justify-between px-2 py-1 hover:bg-blue-600/30 rounded-md text-[8px] font-bold text-blue-400 uppercase tracking-tighter">
                        <span>GOOGLE</span> <Search size={8}/>
                    </button>
                    <button onClick={handleSearchPantone} className="flex items-center justify-between px-2 py-1 hover:bg-vingi-600/30 rounded-md text-[8px] font-bold text-vingi-400 uppercase tracking-tighter">
                        <span>PANTONE</span> <ExternalLink size={8}/>
                    </button>
                </div>
            )}
        </div>
    );
};

const LAYOUT_OPTIONS = [
    { id: 'CORRIDA', label: 'Corrida', icon: Layers },
    { id: 'BARRADO', label: 'Barrado', icon: ArrowDownToLine },
    { id: 'LENCO', label: 'Lenço', icon: Frame }, 
    { id: 'LOCALIZADA', label: 'Localizada', icon: Target }
];

const ART_STYLES = [
    { id: 'WATERCOLOR', label: 'Aquarela', icon: Droplets },
    { id: 'VETOR', label: 'Vetor Flat', icon: Box },
    { id: 'BORDADO', label: 'Bordado', icon: Scissors },
    { id: 'ORNAMENTAL', label: 'Barroco', icon: LayoutTemplate }
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

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden">
            <div className="bg-[#111] h-14 border-b border-white/5 px-4 flex items-center justify-between shrink-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="bg-vingi-900/50 p-1.5 rounded-lg border border-vingi-500/30 text-vingi-400"><Palette size={18}/></div>
                    <span className="font-black text-[10px] uppercase tracking-widest">Atelier AI Studio</span>
                </div>
                {generatedPattern && (
                    <div className="flex gap-2">
                        <button onClick={() => setShowDownloadMenu(true)} className="bg-white text-black px-4 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><Download size={12}/> Salvar</button>
                    </div>
                )}
            </div>

            {!referenceImage ? (
                <div className="flex-1 bg-white">
                    <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/*" />
                    <ModuleLandingPage icon={Palette} title="Atelier de Estamparia" description="Extraia a alma cromática de qualquer referência e gere novas artes vetoriais ou digitais 4K." primaryActionLabel="Iniciar Estúdio" onPrimaryAction={() => fileInputRef.current?.click()} partners={["PANTONE TCX", "VINGI ENGINE 4.2"]} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                    <div className="flex-1 relative bg-[#080808] flex items-center justify-center p-8">
                        {isProcessing ? (
                            <div className="flex flex-col items-center animate-fade-in">
                                <Loader2 size={48} className="text-vingi-400 animate-spin mb-4"/>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Processando Design...</span>
                            </div>
                        ) : generatedPattern ? (
                            <div className="w-full h-full relative shadow-2xl rounded-2xl overflow-hidden border border-white/5">
                                <SmartImageViewer src={generatedPattern} />
                            </div>
                        ) : (
                            <div className="text-center opacity-20">
                                <Sparkles size={64} className="mx-auto mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Aguardando Direção de Arte</p>
                            </div>
                        )}
                        <div className="absolute bottom-6 left-6 w-24 h-24 rounded-2xl border-2 border-white/10 overflow-hidden shadow-2xl bg-black hover:scale-150 transition-all z-20">
                            <img src={referenceImage} className="w-full h-full object-cover" />
                        </div>
                    </div>

                    <div className="w-full md:w-80 bg-[#0a0a0a] border-l border-white/5 flex flex-col shadow-2xl z-40">
                        <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar pb-32">
                            <div className="space-y-4">
                                <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Pipette size={14} className="text-vingi-400"/> Colorimetria Têxtil</h3>
                                <div className="grid grid-cols-4 gap-2">
                                    {colors.map((c, i) => ( <PantoneChip key={i} color={c} onDelete={() => setColors(prev => prev.filter((_, idx) => idx !== i))} /> ))}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Grid size={14}/> Layout</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {LAYOUT_OPTIONS.map(opt => (
                                        <button key={opt.id} onClick={() => setActiveLayout(opt.id)} className={`flex items-center gap-2 p-3 rounded-xl border text-[9px] font-bold transition-all ${activeLayout === opt.id ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'}`}>
                                            <opt.icon size={14}/> {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Brush size={14}/> Estilo</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {ART_STYLES.map(opt => (
                                        <button key={opt.id} onClick={() => setActiveStyle(opt.id)} className={`flex items-center gap-2 p-3 rounded-xl border text-[9px] font-bold transition-all ${activeStyle === opt.id ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'}`}>
                                            <opt.icon size={14}/> {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14} className="text-vingi-400"/> Prompt</h3>
                                <textarea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} className="w-full h-24 p-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-bold focus:border-vingi-500 outline-none text-white placeholder-gray-700 transition-all" placeholder="Descreva os elementos da estampa..."/>
                            </div>
                        </div>
                        <div className="p-5 bg-[#0a0a0a] border-t border-white/5 shrink-0">
                            <button onClick={handleGenerate} disabled={isProcessing} className="w-full py-4 bg-vingi-600 hover:bg-vingi-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95 disabled:opacity-50">
                                {isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16} className="fill-white"/>} Gerar Estampa
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showDownloadMenu && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-[#111] border border-white/10 rounded-[3rem] p-12 max-w-md w-full text-center space-y-8 shadow-2xl">
                        <h3 className="text-xl font-black uppercase tracking-widest">Exportar Estampa</h3>
                        <div className="grid gap-3">
                            <button onClick={() => { const l=document.createElement('a'); l.download='vingi-pattern.png'; l.href=generatedPattern!; l.click(); setShowDownloadMenu(false); }} className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-3 transition-all"><ImageIcon size={14}/> Preview (HD)</button>
                            <button onClick={() => setShowDownloadMenu(false)} className="text-[10px] text-gray-500 font-bold uppercase hover:text-white">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
