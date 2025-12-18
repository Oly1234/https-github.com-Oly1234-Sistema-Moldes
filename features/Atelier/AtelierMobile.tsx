
import React from 'react';
import { Loader2, Palette, Zap, Frame, Grid, Sparkles, Download, Paintbrush2, X, Brush, Layers } from 'lucide-react';
import { SmartImageViewer } from '../../components/Shared';
import { LAYOUT_STRUCTURES, ART_STYLES } from './AtelierConstants';

export const AtelierMobile: React.FC<any> = (props) => {
    return (
        <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
            {/* Visualizador Principal */}
            <div className="flex-1 relative bg-black flex items-center justify-center p-4">
                {props.isProcessing ? (
                    <div className="flex flex-col items-center">
                        <Loader2 size={32} className="text-vingi-400 animate-spin mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">{props.statusMessage}</span>
                    </div>
                ) : props.generatedPattern ? (
                    <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                        <SmartImageViewer src={props.generatedPattern} />
                    </div>
                ) : (
                    <div className="text-center opacity-20">
                        <Sparkles size={48} className="mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Aguardando Configuração</p>
                    </div>
                )}

                {/* PIP Referência */}
                <div className="absolute top-6 left-6 w-16 h-16 rounded-xl border border-white/20 overflow-hidden shadow-2xl">
                    <img src={props.referenceImage} className="w-full h-full object-cover" />
                </div>
            </div>

            {/* DOCK FERRAMENTAS (INSHOT STYLE) */}
            <div className="h-[280px] bg-[#0a0a0a] rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] z-50 flex flex-col">
                <div className="p-4 flex justify-center"><div className="w-12 h-1 bg-white/10 rounded-full" /></div>
                
                <div className="flex-1 overflow-x-auto no-scrollbar px-6 flex items-center gap-6">
                    <ToolItem icon={Frame} label="Layout" onClick={() => {}} />
                    <ToolItem icon={Palette} label="Cores" onClick={() => {}} />
                    <ToolItem icon={Brush} label="Estilo" onClick={() => {}} />
                    <ToolItem icon={Layers} label="Textura" onClick={() => {}} />
                    <ToolItem icon={Paintbrush2} label="Pintar" onClick={() => props.setIsInpaintingMode(true)} />
                </div>

                <div className="p-6 pb-10 bg-black/50 border-t border-white/5">
                    <button onClick={props.onGenerate} disabled={props.isProcessing} className="w-full py-5 bg-white text-black rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 active:scale-95 transition-all">
                        {props.isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} fill="black" />} Gerar Estampa
                    </button>
                </div>
            </div>
        </div>
    );
};

const ToolItem = ({ icon: Icon, label, onClick }: any) => (
    <button onClick={onClick} className="flex flex-col items-center gap-2 shrink-0 group">
        <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 group-active:bg-vingi-900 group-active:border-vingi-500 transition-all">
            <Icon size={24} className="text-gray-400 group-active:text-white" />
        </div>
        <span className="text-[9px] font-black uppercase text-gray-500 group-active:text-white">{label}</span>
    </button>
);
