
import React from 'react';
import { Palette, Loader2, Grid, Layers, Target, Droplets, Zap, Sparkles, Image as ImageIcon, Pipette, Brush, Box, Scissors, LayoutTemplate, Frame, ArrowDownToLine, Move, Sticker, RotateCcw, ChevronDown } from 'lucide-react';
import { PantoneColor } from '../../types';
import { SmartImageViewer } from '../../components/Shared';
import { PantoneGrid } from '../../components/PantoneHub';

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
}

export const AtelierMobile: React.FC<AtelierProps> = (props) => {
    const isStudioUnlocked = props.colors.length > 0;

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
            {/* Área de Visualização Mobile (Fixa no Topo) */}
            <div className="h-[45vh] relative shrink-0 border-b border-white/5 flex items-center justify-center p-4">
                {props.isProcessing && !props.generatedPattern ? (
                    <div className="flex flex-col items-center">
                        <Loader2 size={32} className="text-vingi-400 animate-spin mb-3" />
                        <span className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-500">Analisando...</span>
                    </div>
                ) : props.generatedPattern ? (
                    <div className="w-full h-full rounded-xl overflow-hidden border border-white/5">
                        <SmartImageViewer src={props.generatedPattern} />
                    </div>
                ) : (
                    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10">
                        <img src={props.referenceImage} className="w-full h-full object-cover grayscale opacity-30" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                            <Pipette size={30} className="text-vingi-400 mb-2" />
                            <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Desça para configurar as cores e layout.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Área de Ferramentas (Scrollable) */}
            {isStudioUnlocked && (
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a0a0a] rounded-t-[2.5rem] -mt-6 z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                    <div className="p-6 space-y-10 pb-32">
                        <div className="flex justify-center mb-2"><div className="w-12 h-1 bg-white/10 rounded-full"/></div>
                        
                        <div className="space-y-4">
                            <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Pipette size={14} className="text-vingi-400"/> Pantone Extracted</h3>
                            <PantoneGrid colors={props.colors} columns={3} />
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Grid size={14}/> Layout Industrial</h3>
                            <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
                                {['CORRIDA', 'BARRADO', 'LENCO', 'HALF_DROP', 'LOCALIZADA'].map(id => (
                                    <button key={id} onClick={() => props.setActiveLayout(id)} className={`flex-shrink-0 px-5 py-3 rounded-xl border text-[9px] font-bold transition-all ${props.activeLayout === id ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-gray-500'}`}>
                                        {id}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Brush size={14}/> Técnica Artística</h3>
                            <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
                                {['VETOR', 'WATERCOLOR', 'REALISM', 'BORDADO', 'POP_ART'].map(id => (
                                    <button key={id} onClick={() => props.setActiveStyle(id)} className={`flex-shrink-0 px-5 py-3 rounded-xl border text-[9px] font-bold transition-all ${props.activeStyle === id ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-gray-500'}`}>
                                        {id}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14}/> Direção Criativa</h3>
                            <textarea value={props.userPrompt} onChange={(e) => props.setUserPrompt(e.target.value)} className="w-full h-24 p-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-bold focus:border-vingi-500 outline-none text-white resize-none" placeholder="Ex: Adicionar flores tropicais..."/>
                        </div>
                    </div>
                </div>
            )}

            {/* Botão de Ação Mobile (Fixo) */}
            {isStudioUnlocked && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black to-transparent z-50">
                    <button onClick={props.handleGenerate} disabled={props.isProcessing} className="w-full py-4 bg-vingi-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95">
                        {props.isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16} className="fill-white"/>} Gerar Estampa
                    </button>
                </div>
            )}
        </div>
    );
};
