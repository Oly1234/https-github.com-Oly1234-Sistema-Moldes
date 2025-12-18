
import React, { useState } from 'react';
import { Loader2, Palette, Zap, Frame, Sparkles, Paintbrush2, X, Brush, Layers } from 'lucide-react';
import { SmartImageViewer } from '../../components/Shared';
import { LAYOUT_STRUCTURES, ART_STYLES, TEXTURE_OVERLAYS } from './AtelierConstants';

export const AtelierMobile: React.FC<any> = (props) => {
    const [activeTab, setActiveTab] = useState<'LAYOUT' | 'COLORS' | 'STYLE' | 'TEXTURE' | null>(null);

    return (
        <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
            <div className="flex-1 relative bg-black flex items-center justify-center p-4">
                {props.isProcessing ? (
                    <div className="flex flex-col items-center">
                        <Loader2 size={32} className="text-vingi-400 animate-spin mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">{props.statusMessage}</span>
                    </div>
                ) : props.generatedPattern ? (
                    <div className="w-full h-full rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10">
                        <SmartImageViewer src={props.generatedPattern} />
                    </div>
                ) : (
                    <div className="text-center opacity-20">
                        <Sparkles size={48} className="mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Aguardando Referência</p>
                    </div>
                )}
                <div className="absolute top-6 left-6 w-16 h-16 rounded-2xl border border-white/20 overflow-hidden shadow-2xl z-20">
                    <img src={props.referenceImage} className="w-full h-full object-cover" />
                </div>
            </div>

            <div className="bg-[#0a0a0a] rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] z-50 flex flex-col shrink-0">
                <div className="p-4 flex justify-center"><div className="w-12 h-1 bg-white/10 rounded-full" /></div>
                
                <div className="overflow-x-auto no-scrollbar px-6 flex items-center gap-8 py-4">
                    <ToolItem active={activeTab==='LAYOUT'} icon={Frame} label="Layout" onClick={() => setActiveTab('LAYOUT')} />
                    <ToolItem active={activeTab==='COLORS'} icon={Palette} label="Cores" onClick={() => setActiveTab('COLORS')} />
                    <ToolItem active={activeTab==='STYLE'} icon={Brush} label="Estilo" onClick={() => setActiveTab('STYLE')} />
                    <ToolItem active={activeTab==='TEXTURE'} icon={Layers} label="Textura" onClick={() => setActiveTab('TEXTURE')} />
                    <ToolItem icon={Paintbrush2} label="Refinar" onClick={() => props.setIsInpainting(true)} />
                </div>

                {activeTab && (
                    <div className="px-6 py-6 bg-white/5 animate-slide-up border-t border-white/5 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{activeTab}</span>
                            <button onClick={() => setActiveTab(null)}><X size={14} className="text-gray-500"/></button>
                        </div>
                        
                        {activeTab === 'LAYOUT' && (
                            <div className="flex flex-col gap-4">
                                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                    {LAYOUT_STRUCTURES.map(l => (
                                        <button key={l.id} onClick={() => props.setActiveLayout(l.id)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border whitespace-nowrap ${props.activeLayout === l.id ? 'bg-white text-black' : 'bg-black text-gray-500 border-white/10'}`}>{l.label}</button>
                                    ))}
                                </div>
                                <input value={props.layoutText} onChange={e=>props.setLayoutText(e.target.value)} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-[10px] text-white" placeholder="Nota de layout..." />
                            </div>
                        )}
                        {activeTab === 'COLORS' && (
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                {props.colors.map((c: any, i: number) => (
                                    <div key={i} className="w-10 h-10 rounded-lg border border-white/10 shrink-0" style={{ backgroundColor: c.hex }} />
                                ))}
                            </div>
                        )}
                        {activeTab === 'STYLE' && (
                            <div className="flex flex-col gap-4">
                                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                    {ART_STYLES.map(s => (
                                        <button key={s.id} onClick={() => props.setActiveStyle(s.id)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border whitespace-nowrap ${props.activeStyle === s.id ? 'bg-white text-black' : 'bg-black text-gray-500 border-white/10'}`}>{s.label}</button>
                                    ))}
                                </div>
                                <input value={props.styleText} onChange={e=>props.setStyleText(e.target.value)} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-[10px] text-white" placeholder="Nota de estilo..." />
                            </div>
                        )}
                        {activeTab === 'TEXTURE' && (
                            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                {TEXTURE_OVERLAYS.map(t => (
                                    <button key={t.id} onClick={() => props.setActiveTexture(t.id)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border whitespace-nowrap ${props.activeTexture === t.id ? 'bg-white text-black' : 'bg-black text-gray-500 border-white/10'}`}>{t.label}</button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="p-6 pb-10 bg-black/50 border-t border-white/5">
                    <button onClick={props.onGenerate} disabled={props.isProcessing || !props.referenceImage} className="w-full py-5 bg-white text-black rounded-3xl font-black text-[12px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 shadow-xl active:scale-95 transition-all">
                        {props.isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} fill="black" />} Gerar Estampa
                    </button>
                </div>
            </div>
        </div>
    );
};

const ToolItem = ({ icon: Icon, label, onClick, active }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-2 shrink-0 transition-all ${active ? 'scale-110' : 'opacity-60'}`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${active ? 'bg-vingi-600 border-white shadow-lg' : 'bg-white/5 border-white/5'}`}>
            <Icon size={24} className={active ? 'text-white' : 'text-gray-400'} />
        </div>
        <span className={`text-[9px] font-black uppercase tracking-widest ${active ? 'text-white' : 'text-gray-500'}`}>{label}</span>
    </button>
);
