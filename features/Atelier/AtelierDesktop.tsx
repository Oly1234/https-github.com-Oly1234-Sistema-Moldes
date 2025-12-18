
import React, { useState } from 'react';
import { Loader2, Grid, Layers, Zap, Sparkles, Image as ImageIcon, Brush, Box, Scissors, Frame, ArrowDownToLine, Settings2, Printer } from 'lucide-react';
import { PantoneColor } from '../../types';
import { SmartImageViewer } from '../../components/Shared';
import { AtelierPantone } from './AtelierPantone';
import { SelvedgeTool, SelvedgePosition } from './SelvedgeTool';
import { AtelierEngine } from './AtelierEngine';

interface AtelierProps {
    referenceImage: string;
    generatedPattern: string | null;
    colors: PantoneColor[];
    setColors: React.Dispatch<React.SetStateAction<PantoneColor[]>>;
    isProcessing: boolean;
    setIsProcessing: (v: boolean) => void;
    activeLayout: string;
    setActiveLayout: (v: string) => void;
    activeStyle: string;
    setActiveStyle: (v: string) => void;
    userPrompt: string;
    setUserPrompt: (v: string) => void;
    onGenerate: () => void;
}

export const AtelierDesktop: React.FC<AtelierProps> = (props) => {
    const [technique, setTechnique] = useState<'CYLINDER' | 'DIGITAL'>('DIGITAL');
    const [colorCount, setColorCount] = useState(0);
    const [selvedge, setSelvedge] = useState<SelvedgePosition>('Inferior');
    const [isUpscaling, setIsUpscaling] = useState(false);

    const handleProduction = async () => {
        if (!props.generatedPattern) return;
        setIsUpscaling(true);
        const img = await AtelierEngine.prepareProduction(props.generatedPattern, technique);
        if (img) {
            const l = document.createElement('a'); l.download = 'vingi-pro-4k.png'; l.href = img; l.click();
        }
        setIsUpscaling(false);
    };

    return (
        <div className="flex-1 flex w-full h-full bg-[#080808] animate-fade-in overflow-hidden">
            {/* Visualizador Central */}
            <div className="flex-1 relative flex items-center justify-center p-12 overflow-hidden border-r border-white/5">
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

                {props.isProcessing || isUpscaling ? (
                    <div className="flex flex-col items-center z-10">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-vingi-500 blur-[80px] opacity-20 animate-pulse"></div>
                            <Loader2 size={64} className="text-vingi-400 animate-spin relative" />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-[0.5em] text-white">
                            {isUpscaling ? "Processando Upscale 4K" : "Renderizando Design"}
                        </h3>
                    </div>
                ) : props.generatedPattern ? (
                    <div className="w-full max-w-[900px] aspect-square relative shadow-[0_50px_100px_rgba(0,0,0,0.8)] rounded-[3rem] overflow-hidden border border-white/10 bg-black">
                        <SmartImageViewer src={props.generatedPattern} />
                    </div>
                ) : (
                    <div className="relative max-w-lg w-full aspect-square rounded-[3rem] overflow-hidden shadow-2xl border-4 border-[#111] flex flex-col items-center justify-center text-center p-12 bg-white/5">
                        <img src={props.referenceImage} className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale blur-sm" />
                        <h3 className="relative text-lg font-black uppercase tracking-widest text-white mb-2">DNA Extraído</h3>
                        <p className="relative text-[10px] font-bold text-gray-500 uppercase tracking-widest">Configure os parâmetros industriais no painel lateral para gerar sua estampa.</p>
                    </div>
                )}
            </div>

            {/* Painel de Controle Desktop (Totalmente independente do Mobile) */}
            <div className="w-[420px] bg-[#0a0a0a] flex flex-col shadow-[0_0_100px_rgba(0,0,0,1)] z-40 overflow-hidden border-l border-white/5">
                <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
                    
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Settings2 size={16}/> Engenharia de Produção</h3>
                        <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-2xl border border-white/5">
                            <button onClick={() => setTechnique('DIGITAL')} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${technique === 'DIGITAL' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>Digital (Degradê)</button>
                            <button onClick={() => setTechnique('CYLINDER')} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${technique === 'CYLINDER' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>Cilindro (Vetor)</button>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                <span>Contagem de Cores</span>
                                <span>{colorCount === 0 ? 'ILIMITADO' : `${colorCount} C`}</span>
                            </div>
                            <input type="range" min="0" max="16" value={colorCount} onChange={e => setColorCount(parseInt(e.target.value))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-vingi-500 cursor-pointer"/>
                        </div>
                    </div>

                    <AtelierPantone colors={props.colors} onDelete={(idx) => props.setColors(prev => prev.filter((_, i) => i !== idx))} />

                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Grid size={16}/> Layout Industrial</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {['CORRIDA', 'BARRADO', 'LENCO', 'LOCALIZADA', 'HALF_DROP'].map(id => (
                                <button key={id} onClick={() => props.setActiveLayout(id)} className={`flex items-center gap-2 p-4 rounded-2xl border text-[10px] font-bold transition-all ${props.activeLayout === id ? 'bg-white text-black border-white shadow-xl' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'}`}>
                                    {id}
                                </button>
                            ))}
                        </div>
                        {props.activeLayout === 'BARRADO' && (
                            <div className="space-y-3">
                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Posição da Ourela</span>
                                <SelvedgeTool image={props.referenceImage} active={true} selectedPos={selvedge} onSelect={setSelvedge} />
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={16} className="text-vingi-400"/> Direção Criativa</h3>
                        <textarea value={props.userPrompt} onChange={(e) => props.setUserPrompt(e.target.value)} className="w-full h-32 p-5 bg-white/5 border border-white/5 rounded-[1.5rem] text-[11px] font-bold focus:border-vingi-500 outline-none text-white placeholder-gray-700 resize-none transition-all" placeholder="Adicione instruções extras para a IA..."/>
                    </div>
                </div>

                <div className="p-8 bg-[#0a0a0a] border-t border-white/5 flex flex-col gap-3">
                    <button onClick={props.onGenerate} disabled={props.isProcessing} className="w-full py-5 bg-white text-black rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 shadow-2xl transition-all active:scale-95 disabled:opacity-50">
                        {props.isProcessing ? <Loader2 size={18} className="animate-spin"/> : <Zap size={18} className="fill-black"/>} Gerar Amostra
                    </button>
                    {props.generatedPattern && (
                        <button onClick={handleProduction} className="w-full py-4 bg-vingi-900 border border-vingi-500/30 text-vingi-400 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-vingi-800 transition-all">
                            <Printer size={16}/> Preparar Produção 4K
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
