
import React, { useState, useRef } from 'react';
import { 
    Zap, Loader2, Sparkles, Paintbrush2, Palette, Download, 
    Layers, Frame, Grid, Scissors, ChevronRight, Copy, Search,
    RefreshCw, Sun, Moon, Contrast, X, Check
} from 'lucide-react';
import { SmartImageViewer } from '../../components/Shared';
import { LAYOUT_STRUCTURES, ART_STYLES, TEXTURE_OVERLAYS } from './AtelierConstants';

export const AtelierDesktop: React.FC<any> = (props) => {
    const [showInpaintModal, setShowInpaintModal] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    return (
        <div className="flex-1 flex w-full h-full bg-[#050505] overflow-hidden">
            {/* 1. VISUALIZADOR CENTRAL (EDIÇÃO) */}
            <div className="flex-1 relative flex items-center justify-center p-8 bg-black">
                <div className="absolute top-6 left-6 z-20">
                     <div className="bg-[#111] p-3 rounded-2xl border border-white/10 shadow-2xl flex flex-col gap-2">
                        <span className="text-[9px] font-black uppercase text-gray-500">Referência Ativa</span>
                        <img src={props.referenceImage} className="w-24 h-24 object-cover rounded-lg border border-white/5" />
                     </div>
                </div>

                {props.isProcessing ? (
                    <div className="flex flex-col items-center gap-6">
                        <Loader2 size={48} className="text-vingi-400 animate-spin" />
                        <h3 className="text-sm font-black uppercase tracking-[0.4em] text-white animate-pulse">{props.statusMessage}</h3>
                    </div>
                ) : props.generatedPattern ? (
                    <div className="relative w-full max-w-[800px] aspect-square group">
                        <SmartImageViewer src={props.generatedPattern} className="rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)]" />
                        {/* Camada de Textura Overlay */}
                        <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden opacity-40 mix-blend-multiply" style={{ backgroundImage: `url(/textures/${props.activeTexture.toLowerCase()}.jpg)` }}></div>
                        
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                             <button onClick={() => props.setIsInpaintingMode(true)} className="bg-white text-black px-6 py-3 rounded-full font-black text-[10px] uppercase flex items-center gap-2 shadow-2xl hover:bg-vingi-400 transition-colors"><Paintbrush2 size={14}/> Pintar Refinamento</button>
                             <button className="bg-vingi-600 text-white px-6 py-3 rounded-full font-black text-[10px] uppercase flex items-center gap-2 shadow-2xl hover:bg-vingi-500 transition-colors"><Download size={14}/> Exportar 4K</button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center opacity-30">
                        <Sparkles size={64} className="mx-auto mb-4" />
                        <p className="font-black uppercase tracking-widest text-xs">Configure o sistema para gerar</p>
                    </div>
                )}
            </div>

            {/* 2. PAINEL DE FERRAMENTAS (INSHOT STYLE) */}
            <div className="w-[450px] bg-[#0a0a0a] border-l border-white/5 flex flex-col shadow-2xl z-40">
                <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
                    
                    {/* A. PALETA PANTONE */}
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Palette size={14}/> Cromatismo Pantone TCX</h3>
                            <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                                <button onClick={() => props.changePantoneFilter('VIVID')} className={`p-1.5 rounded ${props.colorVariation === 'VIVID' ? 'bg-white text-black' : 'text-gray-500'}`}><Sun size={12}/></button>
                                <button onClick={() => props.changePantoneFilter('NATURAL')} className={`p-1.5 rounded ${props.colorVariation === 'NATURAL' ? 'bg-white text-black' : 'text-gray-500'}`}><Contrast size={12}/></button>
                                <button onClick={() => props.changePantoneFilter('DARK')} className={`p-1.5 rounded ${props.colorVariation === 'DARK' ? 'bg-white text-black' : 'text-gray-500'}`}><Moon size={12}/></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                            {props.colors.map((c: any, i: number) => (
                                <div key={i} className="group relative aspect-square rounded-lg border border-white/5 overflow-hidden cursor-pointer" style={{ backgroundColor: c.hex }}>
                                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                        <button onClick={() => navigator.clipboard.writeText(c.hex)} className="p-1 hover:text-vingi-400"><Copy size={10}/></button>
                                        <button className="p-1 hover:text-vingi-400"><Search size={10}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* B. ENGENHARIA DE LAYOUT */}
                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Layout Estrutural</h3>
                        <div className="grid grid-cols-4 gap-2">
                            {LAYOUT_STRUCTURES.map(l => (
                                <button key={l.id} onClick={() => props.setActiveLayout(l.id)} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${props.activeLayout === l.id ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-gray-500'}`}>
                                    <l.icon size={20} />
                                    <span className="text-[8px] font-black uppercase">{l.label}</span>
                                </button>
                            ))}
                        </div>
                        {/* Sub-Layouts Contextuais */}
                        {LAYOUT_STRUCTURES.find(l => l.id === props.activeLayout)?.variants.length! > 0 && (
                            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                                {LAYOUT_STRUCTURES.find(l => l.id === props.activeLayout)?.variants.map(v => (
                                    <button key={v.id} onClick={() => props.setActiveVariant(v.id)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border whitespace-nowrap transition-all ${props.activeVariant === v.id ? 'bg-vingi-900 border-vingi-500 text-white' : 'bg-white/5 border-white/5 text-gray-500'}`}>
                                        {v.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* C. ESTILO ARTÍSTICO */}
                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Técnica de Desenho</h3>
                        <div className="grid grid-cols-4 gap-2">
                            {ART_STYLES.map(s => (
                                <button key={s.id} onClick={() => props.setActiveStyle(s.id)} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${props.activeStyle === s.id ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-gray-500'}`}>
                                    <s.icon size={20} />
                                    <span className="text-[8px] font-black uppercase">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* D. TEXTURIZAÇÃO INDUSTRIAL */}
                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Textura Superior</h3>
                        <div className="flex flex-wrap gap-2">
                            {TEXTURE_OVERLAYS.map(t => (
                                <button key={t.id} onClick={() => props.setActiveTexture(t.id)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${props.activeTexture === t.id ? 'bg-white text-black border-white' : 'bg-white/5 border-white/5 text-gray-500'}`}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* E. DIREÇÃO CRIATIVA (TEXTO) */}
                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14} className="text-vingi-400"/> Refinamento IA</h3>
                        <textarea value={props.customInstruction} onChange={(e) => props.setCustomInstruction(e.target.value)} className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-4 text-[11px] font-bold text-white outline-none focus:border-vingi-500 transition-all resize-none" placeholder="IA ignorou algo? Digite aqui... ex: 'quero mais flores amarelas', 'fundo azul marinho'..." />
                    </section>
                </div>

                <div className="p-6 bg-black border-t border-white/5">
                    <button onClick={props.onGenerate} disabled={props.isProcessing} className="w-full py-5 bg-white text-black rounded-2xl font-black text-[12px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 shadow-2xl active:scale-95 disabled:opacity-50 transition-all">
                        {props.isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} fill="black" />} Gerar Estampa
                    </button>
                </div>
            </div>

            {/* MODAL DE INPAINTING (NOVO) */}
            {props.isInpaintingMode && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-12">
                    <div className="absolute top-10 left-10 text-white flex items-center gap-4">
                         <div className="bg-vingi-900 p-3 rounded-2xl"><Paintbrush2 size={24}/></div>
                         <div><h2 className="text-xl font-black uppercase tracking-widest">Modo Refinamento</h2><p className="text-xs text-gray-500 uppercase">Pinte a área que deseja alterar</p></div>
                    </div>
                    <div className="relative bg-[#111] rounded-[3rem] p-4 border border-white/10 shadow-[0_0_100px_rgba(59,130,246,0.3)]">
                         <canvas ref={canvasRef} width={800} height={800} className="rounded-2xl cursor-crosshair" style={{ backgroundImage: `url(${props.generatedPattern})`, backgroundSize: 'contain' }} />
                    </div>
                    <div className="mt-12 flex flex-col items-center gap-6 w-full max-w-lg">
                        <input className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none focus:border-vingi-500" placeholder="O que quer colocar nesta área? ex: 'um bordado dourado'..." />
                        <div className="flex gap-4">
                             <button onClick={() => props.setIsInpaintingMode(false)} className="px-10 py-4 bg-white/5 text-gray-400 rounded-2xl font-black uppercase tracking-widest">Cancelar</button>
                             <button onClick={() => props.executeInpaint('MASK_B64', 'PROMPT')} className="px-10 py-4 bg-vingi-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-vingi-600/50">Refinar Somente Aqui</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
