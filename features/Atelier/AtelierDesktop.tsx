
import React from 'react';
import { Palette, Loader2, Grid, Layers, Target, Droplets, Zap, Sparkles, Image as ImageIcon, Pipette, Brush, Box, Scissors, LayoutTemplate, Frame, ArrowDownToLine, Move, Sticker, RotateCcw, ChevronRight } from 'lucide-react';
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
        <div className="flex-1 flex w-full h-full bg-[#080808] animate-fade-in overflow-hidden">
            {/* Visualizador Central */}
            <div className="flex-1 relative flex items-center justify-center p-12 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '50px 50px' }} />

                {props.isProcessing && !props.generatedPattern ? (
                    <div className="flex flex-col items-center z-10">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-vingi-500 blur-3xl opacity-20 animate-pulse"></div>
                            <Loader2 size={48} className="text-vingi-400 animate-spin relative" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-400">
                            {props.colors.length === 0 ? "Extraindo DNA Têxtil..." : "Processando Design 4K..."}
                        </span>
                    </div>
                ) : props.generatedPattern ? (
                    <div className="w-full max-w-[900px] aspect-square relative shadow-[0_30px_100px_rgba(0,0,0,0.5)] rounded-3xl overflow-hidden border border-white/10">
                        <SmartImageViewer src={props.generatedPattern} />
                    </div>
                ) : (
                    <div className="relative max-w-lg w-full aspect-square rounded-[3rem] overflow-hidden shadow-2xl border-8 border-[#111] group">
                        <img src={props.referenceImage} className="w-full h-full object-cover grayscale opacity-20 blur-md transition-all duration-1000 group-hover:scale-110" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                            <div className="w-16 h-16 bg-vingi-900 rounded-2xl flex items-center justify-center mb-6 border border-vingi-500/30">
                                <Pipette size={32} className="text-vingi-400 animate-bounce" />
                            </div>
                            <h3 className="text-lg font-black uppercase tracking-widest text-white mb-2">Cores Mapeadas</h3>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-white/30 max-w-xs">Acesse o estúdio lateral para configurar layouts industriais e estilos artísticos.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Painel de Ferramentas lateral fixo */}
            {isStudioUnlocked && (
                <div className="w-[380px] bg-[#0a0a0a] border-l border-white/5 flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] z-40 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                        {/* 1. Paleta Extraída */}
                        <div className="space-y-4">
                            <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2"><Pipette size={14} className="text-vingi-400"/> Colorimetria Têxtil</h3>
                            <PantoneGrid colors={props.colors} columns={4} />
                        </div>
                        
                        {/* 2. Layouts */}
                        <div className="space-y-4">
                            <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2"><Grid size={14} className="text-gray-600"/> Engenharia de Layout</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {LAYOUT_OPTIONS.map(opt => (
                                    <button key={opt.id} onClick={() => props.setActiveLayout(opt.id)} className={`flex items-center gap-2 p-4 rounded-2xl border text-[10px] font-bold transition-all ${props.activeLayout === opt.id ? 'bg-white text-black border-white shadow-xl scale-105' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'}`}>
                                        <opt.icon size={16}/> {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3. Estilos */}
                        <div className="space-y-4">
                            <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2"><Brush size={14} className="text-gray-600"/> Técnica Artística</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {ART_STYLES.map(opt => (
                                    <button key={opt.id} onClick={() => props.setActiveStyle(opt.id)} className={`flex items-center gap-2 p-4 rounded-2xl border text-[10px] font-bold transition-all ${props.activeStyle === opt.id ? 'bg-white text-black border-white shadow-xl scale-105' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'}`}>
                                        <opt.icon size={16}/> {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 4. Direção Criativa */}
                        <div className="space-y-3">
                            <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2"><Sparkles size={14} className="text-vingi-400"/> Direção Criativa</h3>
                            <textarea value={props.userPrompt} onChange={(e) => props.setUserPrompt(e.target.value)} className="w-full h-32 p-5 bg-white/5 border border-white/5 rounded-[1.5rem] text-[11px] font-bold focus:border-vingi-500 outline-none text-white placeholder-gray-700 resize-none transition-all" placeholder="Adicione instruções extras para a IA..."/>
                        </div>
                    </div>

                    <div className="p-8 bg-[#0a0a0a] border-t border-white/5">
                        <button onClick={props.handleGenerate} disabled={props.isProcessing} className="w-full py-5 bg-vingi-600 hover:bg-vingi-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 shadow-2xl transition-all active:scale-95 disabled:opacity-50">
                            {props.isProcessing ? <Loader2 size={18} className="animate-spin"/> : <Zap size={18} className="fill-white"/>} Gerar Estampa Têxtil
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
