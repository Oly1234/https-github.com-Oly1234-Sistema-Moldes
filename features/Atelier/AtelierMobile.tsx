
import React from 'react';
import { Loader2, Palette, Zap, Grid, Sparkles, Pipette } from 'lucide-react';
import { PantoneColor } from '../../types';
import { SmartImageViewer } from '../../components/Shared';

interface AtelierProps {
    referenceImage: string;
    generatedPattern: string | null;
    colors: PantoneColor[];
    isProcessing: boolean;
    activeLayout: string;
    setActiveLayout: (v: string) => void;
    userPrompt: string;
    setUserPrompt: (v: string) => void;
    onGenerate: () => void;
}

export const AtelierMobile: React.FC<AtelierProps> = (props) => {
    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
            {/* Viewport Mobile */}
            <div className="h-[45vh] relative shrink-0 border-b border-white/5 flex items-center justify-center p-4 bg-black">
                {props.isProcessing ? (
                    <div className="flex flex-col items-center">
                        <Loader2 size={32} className="text-vingi-400 animate-spin mb-3" />
                        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-500">IA Criando...</span>
                    </div>
                ) : props.generatedPattern ? (
                    <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                        <SmartImageViewer src={props.generatedPattern} />
                    </div>
                ) : (
                    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-white/5 border border-white/5 flex flex-col items-center justify-center p-6 text-center">
                        <img src={props.referenceImage} className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale" />
                        <Pipette size={32} className="text-vingi-400 mb-2 relative" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40 relative">DNA Mapeado</span>
                    </div>
                )}
            </div>

            {/* Ferramentas Mobile (Scroll Vertical) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a0a0a] rounded-t-[3rem] -mt-10 z-10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] p-8 pb-32 space-y-12">
                <div className="flex justify-center"><div className="w-16 h-1.5 bg-white/10 rounded-full"/></div>
                
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Palette size={14}/> Cores Pantone</h3>
                    <div className="flex flex-wrap gap-2">
                        {props.colors.map((c, i) => (
                            <div key={i} className="w-10 h-10 rounded-full border border-white/10 shadow-lg" style={{ backgroundColor: c.hex }} />
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Grid size={14}/> Layout Industrial</h3>
                    <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2">
                        {['CORRIDA', 'BARRADO', 'LENCO', 'LOCALIZADA'].map(id => (
                            <button key={id} onClick={() => props.setActiveLayout(id)} className={`px-6 py-4 rounded-2xl border text-[10px] font-black uppercase transition-all whitespace-nowrap ${props.activeLayout === id ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-gray-500'}`}>
                                {id}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14}/> Direção Criativa</h3>
                    <textarea value={props.userPrompt} onChange={(e) => props.setUserPrompt(e.target.value)} className="w-full h-32 p-5 bg-white/5 border border-white/5 rounded-[2rem] text-xs font-bold outline-none text-white focus:border-vingi-500 transition-all" placeholder="Ex: Adicione flores azuis..."/>
                </div>
            </div>

            {/* Action Bar Mobile Fixed */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black to-transparent z-[100]">
                <button onClick={props.onGenerate} disabled={props.isProcessing} className="w-full py-5 bg-vingi-600 text-white rounded-3xl font-black text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 shadow-2xl shadow-vingi-900/50">
                    {props.isProcessing ? <Loader2 size={18} className="animate-spin"/> : <Zap size={18} fill="white"/>} Gerar Estampa
                </button>
            </div>
        </div>
    );
};
