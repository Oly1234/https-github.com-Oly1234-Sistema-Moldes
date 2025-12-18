
import React from 'react';
import { Wand2, Sliders, Hand, Eraser, Download, Grid, BoxSelect, Maximize2, Move } from 'lucide-react';

interface MockupProps {
    canvasRef: React.RefObject<HTMLCanvasElement>;
    activeTool: string;
    setActiveTool: (t: any) => void;
    activeScale: number;
    setActiveScale: (v: number) => void;
    activeRotation: number;
    setActiveRotation: (v: number) => void;
    onDownload: () => void;
    onReset: () => void;
}

export const MockupDesktop: React.FC<MockupProps> = (props) => {
    return (
        <div className="flex-1 flex w-full h-full bg-[#050505] overflow-hidden">
            {/* Canvas Area */}
            <div className="flex-1 relative flex items-center justify-center p-12 bg-black border-r border-white/5">
                <canvas ref={props.canvasRef} className="max-w-full max-h-full shadow-[0_50px_100px_rgba(0,0,0,1)] bg-white cursor-crosshair" />
                <div className="absolute top-8 left-8 flex flex-col gap-4">
                    <button onClick={props.onReset} className="bg-white/10 hover:bg-white/20 p-4 rounded-2xl text-white backdrop-blur-xl border border-white/10 transition-all"><Maximize2 size={24}/></button>
                    <button onClick={props.onDownload} className="bg-vingi-600 hover:bg-vingi-500 p-4 rounded-2xl text-white shadow-2xl transition-all"><Download size={24}/></button>
                </div>
            </div>

            {/* Side Control Panel */}
            <div className="w-[380px] bg-[#0a0a0a] flex flex-col border-l border-white/5 p-8 space-y-12">
                <div className="space-y-6">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Sliders size={16}/> Ferramentas de Aplicação</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => props.setActiveTool('WAND')} className={`flex flex-col items-center justify-center p-6 rounded-2xl border transition-all ${props.activeTool === 'WAND' ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-gray-500'}`}>
                            <Wand2 size={24} className="mb-2"/> <span className="text-[10px] font-black uppercase">Varinha</span>
                        </button>
                        <button onClick={() => props.setActiveTool('HAND')} className={`flex flex-col items-center justify-center p-6 rounded-2xl border transition-all ${props.activeTool === 'HAND' ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-gray-500'}`}>
                            <Hand size={24} className="mb-2"/> <span className="text-[10px] font-black uppercase">Mover</span>
                        </button>
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Move size={16}/> Ajustes de Escala</h3>
                    <div className="space-y-4 bg-white/5 p-6 rounded-[2rem] border border-white/5">
                        <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase"><span>Zoom Estampa</span><span>{Math.round(props.activeScale * 100)}%</span></div>
                            <input type="range" min="0.1" max="3" step="0.1" value={props.activeScale} onChange={e => props.setActiveScale(parseFloat(e.target.value))} className="w-full h-1 bg-gray-800 appearance-none accent-white rounded-full"/>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase"><span>Rotação</span><span>{props.activeRotation}°</span></div>
                            <input type="range" min="0" max="360" value={props.activeRotation} onChange={e => props.setActiveRotation(parseInt(e.target.value))} className="w-full h-1 bg-gray-800 appearance-none accent-white rounded-full"/>
                        </div>
                    </div>
                </div>

                <div className="mt-auto">
                    <div className="bg-vingi-900/40 p-6 rounded-[2rem] border border-vingi-500/20 text-center">
                        <p className="text-[10px] font-bold text-vingi-400 uppercase leading-relaxed">Clique em uma área branca do molde para preencher com a estampa selecionada.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
