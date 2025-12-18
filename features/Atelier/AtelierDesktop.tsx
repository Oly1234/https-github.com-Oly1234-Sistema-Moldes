
import React, { useState } from 'react';
import { Palette, Loader2, Grid, Layers, Target, Droplets, Zap, Sparkles, Image as ImageIcon, Pipette, Brush, Box, Scissors, LayoutTemplate, Frame, ArrowDownToLine, Move, Sticker, RotateCcw, ChevronRight, Settings2, ShieldCheck, Printer, Maximize2 } from 'lucide-react';
import { PantoneColor } from '../../types';
import { SmartImageViewer } from '../../components/Shared';
import { PantoneGrid } from '../../components/PantoneHub';
import { SelvedgeTool, SelvedgePosition } from '../../components/SelvedgeTool';

const LAYOUT_OPTIONS = [
    { id: 'CORRIDA', label: 'Corrida (All-over)', icon: Layers },
    { id: 'BARRADO', label: 'Barrado Técnico', icon: ArrowDownToLine },
    { id: 'LENCO', label: 'Lenço (Square)', icon: Frame }, 
    { id: 'LOCALIZADA', label: 'Localizada', icon: Target },
    { id: 'HALF_DROP', label: 'Half-Drop', icon: Grid },
    { id: 'RAPPORT_4WAY', label: 'Rapport 4-Way', icon: Move },
];

const ART_STYLES = [
    { id: 'WATERCOLOR', label: 'Aquarela Fluida', icon: Droplets },
    { id: 'VETOR', label: 'Vetor Flat 2D', icon: Box },
    { id: 'BORDADO', label: 'Bordado / Stitch', icon: Scissors },
    { id: 'REALISM', label: 'Realismo Têxtil', icon: ImageIcon },
    { id: 'POP_ART', label: 'Pop Art', icon: Sticker },
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
    const [technique, setTechnique] = useState<'CYLINDER' | 'DIGITAL'>('DIGITAL');
    const [colorCount, setColorCount] = useState(0); // 0 = Unlimited
    const [selvedge, setSelvedge] = useState<SelvedgePosition>('Inferior');
    const [isPreparingProduction, setIsPreparingProduction] = useState(false);

    const isStudioUnlocked = props.colors.length > 0;

    return (
        <div className="flex-1 flex w-full h-full bg-[#080808] animate-fade-in overflow-hidden">
            {/* Visualizador Central */}
            <div className="flex-1 relative flex items-center justify-center p-12 overflow-hidden border-r border-white/5">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

                {props.isProcessing || isPreparingProduction ? (
                    <div className="flex flex-col items-center z-10">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-vingi-500 blur-[60px] opacity-30 animate-pulse"></div>
                            <Loader2 size={64} className="text-vingi-400 animate-spin relative" />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-[0.5em] text-white">
                            {isPreparingProduction ? "Finalizando High-Res 4K..." : "Processando Design Têxtil..."}
                        </h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase mt-2 tracking-widest">Aguarde a renderização dos motivos e cores.</p>
                    </div>
                ) : props.generatedPattern ? (
                    <div className="w-full max-w-[1000px] aspect-square relative shadow-[0_50px_150px_rgba(0,0,0,0.7)] rounded-[3rem] overflow-hidden border-2 border-white/10 group bg-black">
                        <SmartImageViewer src={props.generatedPattern} />
                        <div className="absolute top-6 left-6 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <div className="bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-widest text-vingi-400 flex items-center gap-2">
                                <ShieldCheck size={12}/> Vingi Production Ready
                             </div>
                        </div>
                    </div>
                ) : (
                    <div className="relative max-w-xl w-full flex flex-col items-center gap-8">
                        <div className="relative w-80 h-80 rounded-[3rem] overflow-hidden shadow-2xl border-4 border-[#111] animate-fade-in group">
                            <img src={props.referenceImage} className="w-full h-full object-cover grayscale opacity-30 blur-sm group-hover:scale-110 transition-transform duration-1000" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                                <Pipette size={48} className="text-vingi-400 mb-4 animate-bounce" />
                                <h3 className="text-lg font-black uppercase tracking-widest text-white">DNA Mapeado</h3>
                            </div>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-[0.3em] text-gray-500 text-center max-w-sm">Acesse o estúdio avançado à direita para configurar a engenharia de produção.</p>
                    </div>
                )}
            </div>

            {/* Painel de Ferramentas lateral fixo (CONTROLES AVANÇADOS) */}
            {isStudioUnlocked && (
                <div className="w-[420px] bg-[#0a0a0a] flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)] z-40 overflow-hidden border-l border-white/10">
                    <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
                        
                        {/* 1. Engenharia de Produção */}
                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Settings2 size={16} className="text-vingi-400"/> Parâmetros de Indústria
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-2xl border border-white/5">
                                <button onClick={() => setTechnique('DIGITAL')} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${technique === 'DIGITAL' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>Digital (Degradê)</button>
                                <button onClick={() => setTechnique('CYLINDER')} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${technique === 'CYLINDER' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>Cilindro (Vetor)</button>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                    <span>Limite de Cores</span>
                                    <span>{colorCount === 0 ? 'ILIMITADO' : `${colorCount} CORES`}</span>
                                </div>
                                <input type="range" min="0" max="16" step="1" value={colorCount} onChange={e => setColorCount(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-vingi-500 cursor-pointer"/>
                            </div>
                        </div>

                        {/* 2. Paleta Pantone */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Pipette size={16} className="text-vingi-400"/> Colorimetria</h3>
                            <PantoneGrid colors={props.colors} columns={5} />
                        </div>
                        
                        {/* 3. Layout e Ourela */}
                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Grid size={16} className="text-gray-600"/> Layout Industrial</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {LAYOUT_OPTIONS.map(opt => (
                                    <button key={opt.id} onClick={() => props.setActiveLayout(opt.id)} className={`flex items-center gap-2 p-4 rounded-2xl border text-[10px] font-bold transition-all ${props.activeLayout === opt.id ? 'bg-white text-black border-white shadow-xl scale-105' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'}`}>
                                        <opt.icon size={16}/> {opt.label}
                                    </button>
                                ))}
                            </div>

                            {props.activeLayout === 'BARRADO' && (
                                <div className="space-y-3 animate-slide-up">
                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Posicionamento da Ourela</span>
                                    <SelvedgeTool image={props.referenceImage} active={true} selectedPos={selvedge} onSelect={setSelvedge} />
                                </div>
                            )}
                        </div>

                        {/* 4. Arte e Estilo */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Brush size={16} className="text-gray-600"/> Estilo Artístico</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {ART_STYLES.map(opt => (
                                    <button key={opt.id} onClick={() => props.setActiveStyle(opt.id)} className={`flex items-center gap-2 p-4 rounded-2xl border text-[10px] font-bold transition-all ${props.activeStyle === opt.id ? 'bg-white text-black border-white shadow-xl scale-105' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'}`}>
                                        <opt.icon size={16}/> {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 5. Direção Criativa */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={16} className="text-vingi-400"/> Direção Criativa</h3>
                            <textarea value={props.userPrompt} onChange={(e) => props.setUserPrompt(e.target.value)} className="w-full h-32 p-5 bg-white/5 border border-white/5 rounded-[1.5rem] text-[11px] font-bold focus:border-vingi-500 outline-none text-white placeholder-gray-700 resize-none transition-all" placeholder="Instruções para a IA (Ex: Flores maiores, fundo degradê...)"/>
                        </div>
                    </div>

                    <div className="p-8 bg-[#0a0a0a] border-t border-white/10 flex flex-col gap-3">
                        <button onClick={props.handleGenerate} disabled={props.isProcessing} className="w-full py-5 bg-white text-black rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 shadow-2xl transition-all active:scale-95 disabled:opacity-50">
                            {props.isProcessing ? <Loader2 size={18} className="animate-spin"/> : <Zap size={18} className="fill-black"/>} Gerar Amostra
                        </button>
                        
                        {props.generatedPattern && (
                            <button onClick={async () => {
                                setIsPreparingProduction(true);
                                try {
                                    const res = await fetch('/api/analyze', {
                                        method: 'POST',
                                        headers: {'Content-Type': 'application/json'},
                                        body: JSON.stringify({ action: 'PREPARE_PRODUCTION', mainImageBase64: props.generatedPattern?.split(',')[1], targetSize: '4K', technique })
                                    });
                                    const data = await res.json();
                                    if(data.success) {
                                        const l = document.createElement('a'); l.download = 'vingi-production-4k.png'; l.href = data.image; l.click();
                                    }
                                } catch(e) { console.error(e); } finally { setIsPreparingProduction(false); }
                            }} className="w-full py-4 bg-vingi-900 border border-vingi-500/30 text-vingi-400 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-vingi-800 transition-all">
                                <Printer size={16}/> Preparar Produção High-Res
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
