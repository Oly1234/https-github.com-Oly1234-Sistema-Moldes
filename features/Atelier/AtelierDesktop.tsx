
import React from 'react';
import { Palette, Loader2, Grid, Layers, Target, Droplets, Zap, Sparkles, Image as ImageIcon, Pipette, Brush, Box, Scissors, LayoutTemplate, Frame, ArrowDownToLine, Move, Sticker, RotateCcw } from 'lucide-react';
import { PantoneColor } from '../../types';
import { SmartImageViewer } from '../../components/Shared';
import { PantoneGrid } from '../../components/PantoneHub';

const LAYOUT_OPTIONS = [
    { id: 'CORRIDA', label: 'Corrida (All-over)', icon: Layers },
    { id: 'BARRADO', label: 'Barrado Técnico', icon: ArrowDownToLine },
    { id: 'LENCO', label: 'Lenço (Square)', icon: Frame }, 
    { id: 'LOCALIZADA', label: 'Localizada', icon: Target },
    { id: 'HALF_DROP', label: 'Half-Drop', icon: Grid },
    { id: 'RAPPORT_4WAY', label: 'Rapport 4-Way', icon: Move },
    { id: 'XADREZ', label: 'Xadrez / Grid', icon: LayoutTemplate }
];

const ART_STYLES = [
    { id: 'WATERCOLOR', label: 'Aquarela Fluida', icon: Droplets },
    { id: 'VETOR', label: 'Vetor Flat 2D', icon: Box },
    { id: 'BORDADO', label: 'Bordado / Stitch', icon: Scissors },
    { id: 'ORNAMENTAL', label: 'Barroco / Damask', icon: LayoutTemplate },
    { id: 'REALISM', label: 'Realismo Têxtil', icon: ImageIcon },
    { id: 'POP_ART', label: 'Pop Art / Screen', icon: Sticker },
    { id: 'VINTAGE', label: 'Vintage 70s', icon: RotateCcw }
];

interface AtelierProps {
    referenceImage: string;
    generatedPattern: string | null;
    colors: PantoneColor[];
    isProcessing: boolean;
    activeLayout: string;
    activeStyle: string;
    userPrompt: string;
    setActiveLayout: (v: string) => void;
    setActiveStyle: (v: string) => void;
    setUserPrompt: (v: string) => void;
    handleGenerate: () => void;
    analyzeReference: (b: string) => void;
}

export const AtelierDesktop: React.FC<AtelierProps> = (props) => {
    const isStudioUnlocked = props.colors.length > 0;

    return (
        <div className="flex-1 flex overflow-hidden animate-fade-in">
            {/* Visualizador (Preview) */}
            <div className="flex-1 relative bg-[#080808] flex items-center justify-center p-12 overflow-hidden border-r border-white/5">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                {props.isProcessing && !props.generatedPattern ? (
                    <div className="flex flex-col items-center z-10">
                        <Loader2 size={48} className="text-vingi-400 animate-spin mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">
                            {props.colors.length === 0 ? "Extraindo DNA das Cores..." : "Gerando Estampa Técnica..."}
                        </span>
                    </div>
                ) : props.generatedPattern ? (
                    <div className="w-full h-full max-w-4xl relative shadow-2xl rounded-2xl overflow-hidden border border-white/5">
                        <SmartImageViewer src={props.generatedPattern} />
                    </div>
                ) : (
                    <div className="relative max-w-md w-full aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-[#111]">
                        <img src={props.referenceImage} className="w-full h-full object-cover grayscale opacity-40 blur-sm" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                            <Pipette size={40} className="text-vingi-400 mb-4 animate-bounce" />
                            <p className="text-[11px] font-black uppercase tracking-widest text-white/50">Cores extraídas. Use o menu lateral para criar.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Ferramentas (Sidebar) */}
            {isStudioUnlocked && (
                <div className="w-80 bg-[#0a0a0a] flex flex-col shadow-2xl overflow-y-auto custom-scrollbar">
                    <div className="p-6 space-y-8">
                        <div className="space-y-4">
                            <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Pipette size={14} className="text-vingi-400"/> Colorimetria</h3>
                            <PantoneGrid colors={props.colors} columns={4} />
                        </div>
                        
                        <div className="space-y-4">
                            <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Grid size={14}/> Layout</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {LAYOUT_OPTIONS.map(opt => (
                                    <button key={opt.id} onClick={() => props.setActiveLayout(opt.id)} className={`flex items-center gap-2 p-3 rounded-xl border text-[9px] font-bold transition-all ${props.activeLayout === opt.id ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'}`}>
                                        <opt.icon size={14}/> {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Brush size={14}/> Estilo</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {ART_STYLES.map(opt => (
                                    <button key={opt.id} onClick={() => props.setActiveStyle(opt.id)} className={`flex items-center gap-2 p-3 rounded-xl border text-[9px] font-bold transition-all ${props.activeStyle === opt.id ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'}`}>
                                        <opt.icon size={14}/> {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14}/> Prompt</h3>
                            <textarea value={props.userPrompt} onChange={(e) => props.setUserPrompt(e.target.value)} className="w-full h-24 p-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-bold focus:border-vingi-500 outline-none text-white placeholder-gray-700 resize-none" placeholder="Detalhes extras..."/>
                        </div>
                    </div>

                    <div className="p-5 mt-auto bg-[#0a0a0a] border-t border-white/5 sticky bottom-0">
                        <button onClick={props.handleGenerate} disabled={props.isProcessing} className="w-full py-4 bg-vingi-600 hover:bg-vingi-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl transition-all">
                            {props.isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16} className="fill-white"/>} Gerar Estampa
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
