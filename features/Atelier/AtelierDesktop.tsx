
import React, { useState, useRef, useEffect } from 'react';
import { 
    Zap, Loader2, Sparkles, Paintbrush2, Palette, Download, 
    Copy, Search, Sun, Moon, Contrast, 
    Check, X, ImageIcon
} from 'lucide-react';
import { SmartImageViewer } from '../../components/Shared';
import { LAYOUT_STRUCTURES, ART_STYLES, TEXTURE_OVERLAYS } from './AtelierConstants';

export const AtelierDesktop: React.FC<any> = (props) => {
    const [brushActive, setBrushActive] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

    useEffect(() => {
        if (props.isInpainting && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
                ctx.lineWidth = 40;
                ctx.lineCap = 'round';
                ctxRef.current = ctx;
            }
        }
    }, [props.isInpainting]);

    const handlePaint = (e: React.MouseEvent) => {
        if (!brushActive || !ctxRef.current || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        ctxRef.current.lineTo(x, y);
        ctxRef.current.stroke();
    };

    return (
        <div className="flex-1 flex w-full h-full bg-[#050505] overflow-hidden">
            <div className="flex-1 relative flex items-center justify-center p-8 bg-black">
                <div className="absolute top-6 left-6 z-20 group">
                     <div className="bg-[#111] p-3 rounded-2xl border border-white/10 shadow-2xl transition-all group-hover:scale-110">
                        <span className="text-[9px] font-black uppercase text-gray-500 block mb-2">Referência Ativa</span>
                        <img src={props.referenceImage} className="w-24 h-24 object-cover rounded-lg border border-white/5" />
                     </div>
                </div>

                {props.isProcessing ? (
                    <div className="flex flex-col items-center gap-6">
                        <Loader2 size={64} className="text-vingi-400 animate-spin" />
                        <h3 className="text-sm font-black uppercase tracking-[0.4em] text-white animate-pulse">{props.statusMessage}</h3>
                    </div>
                ) : props.generatedPattern ? (
                    <div className="relative w-full max-w-[700px] aspect-square group">
                        <SmartImageViewer src={props.generatedPattern} className="rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)]" />
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-2">
                             <button onClick={() => props.setIsInpainting(true)} className="bg-white text-black px-8 py-3 rounded-full font-black text-[10px] uppercase flex items-center gap-2 shadow-2xl hover:bg-vingi-400 transition-colors"><Paintbrush2 size={16}/> Refinar Área</button>
                             <button className="bg-vingi-600 text-white px-8 py-3 rounded-full font-black text-[10px] uppercase flex items-center gap-2 shadow-2xl hover:bg-vingi-500 transition-colors"><Download size={16}/> Exportar 4K</button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center opacity-30">
                        <Sparkles size={64} className="mx-auto mb-6 text-gray-700" />
                        <p className="font-black uppercase tracking-[0.3em] text-xs text-gray-500">Aguardando Parâmetros Industriais</p>
                    </div>
                )}
            </div>

            <div className="w-[480px] bg-[#0a0a0a] border-l border-white/5 flex flex-col shadow-2xl z-40">
                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                    
                    <section className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Palette size={14}/> Cromatismo Técnico</h3>
                            <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                                <button onClick={() => props.changePantoneFilter('VIVID')} className={`p-2 rounded-md ${props.colorVariation === 'VIVID' ? 'bg-white text-black' : 'text-gray-500'}`}><Sun size={12}/></button>
                                <button onClick={() => props.changePantoneFilter('NATURAL')} className={`p-2 rounded-md ${props.colorVariation === 'NATURAL' ? 'bg-white text-black' : 'text-gray-500'}`}><Contrast size={12}/></button>
                                <button onClick={() => props.changePantoneFilter('DARK')} className={`p-2 rounded-md ${props.colorVariation === 'DARK' ? 'bg-white text-black' : 'text-gray-500'}`}><Moon size={12}/></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                            {props.colors.map((c: any, i: number) => (
                                <div key={i} className="group relative aspect-square rounded-xl border border-white/5 overflow-hidden cursor-pointer" style={{ backgroundColor: c.hex }}>
                                    <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                        <button onClick={() => navigator.clipboard.writeText(c.hex)} className="text-[8px] font-black text-white">HEX</button>
                                        <button className="text-[8px] font-black text-white">SEARCH</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Layout de Produção</h3>
                        <div className="grid grid-cols-4 gap-2">
                            {LAYOUT_STRUCTURES.map(l => (
                                <button key={l.id} onClick={() => props.setActiveLayout(l.id)} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${props.activeLayout === l.id ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-gray-500'}`}>
                                    <l.icon size={20} />
                                    <span className="text-[8px] font-black uppercase text-center">{l.label}</span>
                                </button>
                            ))}
                        </div>
                        <input value={props.layoutText} onChange={e => props.setLayoutText(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-[10px] font-bold text-white outline-none focus:border-vingi-500" placeholder="Ajustes de layout (ex: Espaçamento menor)..." />
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Estilo & Técnica</h3>
                        <div className="grid grid-cols-4 gap-2">
                            {ART_STYLES.map(s => (
                                <button key={s.id} onClick={() => props.setActiveStyle(s.id)} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${props.activeStyle === s.id ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-gray-500'}`}>
                                    <s.icon size={20} />
                                    <span className="text-[8px] font-black uppercase text-center">{s.label}</span>
                                </button>
                            ))}
                        </div>
                        <input value={props.styleText} onChange={e => props.setStyleText(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-[10px] font-bold text-white outline-none focus:border-vingi-500" placeholder="Ajustes de estilo (ex: Traços mais grossos)..." />
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Textura Superior</h3>
                        <div className="flex flex-wrap gap-2">
                            {TEXTURE_OVERLAYS.map(t => (
                                <button key={t.id} onClick={() => props.setActiveTexture(t.id)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${props.activeTexture === t.id ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-gray-500'}`}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="p-8 bg-black border-t border-white/5">
                    <button onClick={props.onGenerate} disabled={props.isProcessing || !props.referenceImage} className="w-full py-6 bg-white text-black rounded-[2rem] font-black text-[14px] uppercase tracking-[0.4em] flex items-center justify-center gap-4 shadow-2xl active:scale-95 disabled:opacity-50 transition-all">
                        {props.isProcessing ? <Loader2 size={24} className="animate-spin" /> : <Zap size={24} fill="black" />} Gerar Estampa
                    </button>
                </div>
            </div>

            {props.isInpainting && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-12">
                    <div className="absolute top-10 left-10 flex items-center gap-4">
                         <div className="bg-vingi-900 p-4 rounded-3xl"><Paintbrush2 size={32} className="text-white"/></div>
                         <div><h2 className="text-2xl font-black uppercase tracking-widest text-white">Refinamento Local</h2><p className="text-[10px] text-gray-500 uppercase">Pinte a área que deseja alterar</p></div>
                    </div>
                    <div className="relative bg-[#111] rounded-[4rem] p-6 border border-white/10 shadow-2xl">
                         <canvas ref={canvasRef} width={700} height={700} className="rounded-[3rem] cursor-crosshair bg-cover" style={{ backgroundImage: `url(${props.generatedPattern})` }}
                            onMouseDown={() => { if(ctxRef.current) { ctxRef.current.beginPath(); setBrushActive(true); } }}
                            onMouseMove={handlePaint}
                            onMouseUp={() => setBrushActive(false)}
                            onMouseLeave={() => setBrushActive(false)} />
                    </div>
                    <div className="mt-12 flex flex-col items-center gap-6 w-full max-w-xl">
                        <input value={props.inpaintPrompt} onChange={e => props.setInpaintPrompt(e.target.value)} className="w-full bg-white/5 border border-white/10 p-6 rounded-3xl text-white font-bold text-lg outline-none focus:border-vingi-500 shadow-2xl" placeholder="O que deseja mudar aqui? ex: 'remover esta flor'..." />
                        <div className="flex gap-4">
                             <button onClick={() => props.setIsInpainting(false)} className="px-12 py-5 bg-white/5 text-gray-500 rounded-3xl font-black uppercase tracking-widest">Cancelar</button>
                             <button onClick={() => props.executeInpaint(canvasRef.current?.toDataURL())} className="px-12 py-5 bg-vingi-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-2xl flex items-center gap-3"><Check size={20}/> Aplicar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
