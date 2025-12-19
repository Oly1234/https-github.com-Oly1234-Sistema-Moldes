
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Layers, Move, Trash2, Eye, EyeOff, Lock, Hand, Wand2, Brush, 
    X, Check, Loader2, LayoutGrid, Palette, Scissors, Sliders, 
    Download, Settings2, Eraser, Undo2, MousePointer2, ChevronUp, 
    Combine, Target, Sparkles, Box, Pipette, Zap, MoreVertical
} from 'lucide-react';
import { DesignLayer, PantoneColor } from '../types';
import { ModuleLandingPage, ModuleHeader } from './Shared';
import { LayerEngine } from '../services/layerEngine';

export const LayerStudio: React.FC<{ onNavigateBack?: () => void, onNavigateToMockup?: () => void }> = ({ onNavigateBack, onNavigateToMockup }) => {
    const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [activeColorPalette, setActiveColorPalette] = useState<any[]>([]);
    
    // Engine State
    const [tool, setTool] = useState<'WAND' | 'BRUSH' | 'ERASER' | 'HAND'>('WAND');
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [suggestedMask, setSuggestedMask] = useState<Uint8Array | null>(null);
    const [tolerance, setTolerance] = useState(45);
    const [brushSize, setBrushSize] = useState(20);
    
    // UI State
    const [isMobile] = useState(window.innerWidth < 768);
    const [showPanel, setShowPanel] = useState<'LAYERS' | 'COLORS' | 'PROMPT'>(isMobile ? 'LAYERS' : 'LAYERS');
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });

    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);

    // Carregar imagem e analisar cores iniciais
    const initStudio = (src: string) => {
        setIsProcessing(true); setStatusMsg("Analisando Composição Industrial...");
        const img = new Image(); img.src = src;
        img.onload = async () => {
            setOriginalImg(img);
            const initialLayer: DesignLayer = {
                id: 'BG', type: 'BACKGROUND', name: 'Original', src,
                x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false,
                visible: true, locked: false, zIndex: 0, opacity: 1
            };
            setLayers([initialLayer]);
            setSelectedLayerId('BG');
            
            // Analisar Cores via API
            try {
                const res = await fetch('/api/layer-studio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'COLOR_SEPARATION', imageBase64: src.split(',')[1] })
                });
                const data = await res.json();
                if (data.groups) setActiveColorPalette(data.groups);
            } catch (e) {}

            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setView({ x: 0, y: 0, k: Math.min(rect.width/img.width, rect.height/img.height) * 0.8 });
            }
            setIsProcessing(false);
        };
    };

    // Renderizador tático (Verde/Vermelho)
    useEffect(() => {
        if (!overlayRef.current || !originalImg || (!activeMask && !suggestedMask)) return;
        const ctx = overlayRef.current.getContext('2d')!;
        ctx.clearRect(0, 0, originalImg.width, originalImg.height);
        const imgData = ctx.createImageData(originalImg.width, originalImg.height);
        
        for (let i = 0; i < (originalImg.width * originalImg.height); i++) {
            const pos = i * 4;
            if (activeMask && activeMask[i] === 255) {
                imgData.data[pos] = 0; imgData.data[pos+1] = 255; imgData.data[pos+2] = 0; imgData.data[pos+3] = 170; // Verde
            } else if (suggestedMask && suggestedMask[i] === 255) {
                imgData.data[pos] = 255; imgData.data[pos+1] = 0; imgData.data[pos+2] = 0; imgData.data[pos+3] = 90; // Vermelho
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }, [activeMask, suggestedMask, originalImg]);

    const handleInteraction = (e: React.PointerEvent) => {
        if (!containerRef.current || !originalImg || tool === 'HAND') return;
        const rect = containerRef.current.getBoundingClientRect();
        const px = (e.clientX - rect.left - rect.width/2 - view.x) / view.k + originalImg.width/2;
        const py = (e.clientY - rect.top - rect.height/2 - view.y) / view.k + originalImg.height/2;

        if (tool === 'WAND') {
            const tempC = document.createElement('canvas'); tempC.width = originalImg.width; tempC.height = originalImg.height;
            const tCtx = tempC.getContext('2d')!; tCtx.drawImage(originalImg, 0, 0);
            const { confirmed, suggested } = LayerEngine.analyzeSelection(tCtx, originalImg.width, originalImg.height, px, py, tolerance, activeMask || undefined);
            setActiveMask(confirmed);
            setSuggestedMask(suggested);
        }
    };

    const confirmExtraction = () => {
        if (!activeMask || !originalImg) return;
        setIsProcessing(true);
        const layerSrc = LayerEngine.extractLayer(originalImg, activeMask, originalImg.width, originalImg.height);
        const newLayer: DesignLayer = {
            id: 'L' + Date.now(), type: 'ELEMENT', name: `Motivo ${layers.length}`, src: layerSrc,
            x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: false, zIndex: layers.length, opacity: 1
        };
        setLayers([...layers, newLayer]);
        setSelectedLayerId(newLayer.id);
        setActiveMask(null); setSuggestedMask(null);
        setIsProcessing(false);
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden relative font-sans select-none">
            {/* TOP BAR */}
            <div className="h-14 bg-[#0a0a0a] border-b border-white/5 flex items-center justify-between px-4 z-50 shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-vingi-900/30 rounded-xl border border-vingi-500/30 text-vingi-400"><Layers size={18}/></div>
                    <div className="hidden md:block">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-vingi-400">Lab de Imagem</h2>
                        <p className="text-[9px] text-gray-500 uppercase font-bold">Separador Tático SAM-X</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => onNavigateBack?.()} className="px-4 py-1.5 bg-white/5 rounded-lg text-[10px] font-black uppercase border border-white/10">Voltar</button>
                    <button className="px-4 py-1.5 bg-vingi-600 rounded-lg text-[10px] font-black uppercase shadow-lg shadow-vingi-900/40">Exportar Produção</button>
                </div>
            </div>

            {!originalImg ? (
                <div className="flex-1 bg-white">
                    <input type="file" onChange={e => {const f=e.target.files?.[0]; if(f){const r=new FileReader(); r.onload=ev=>initStudio(ev.target?.result as string); r.readAsDataURL(f);}}} className="hidden" id="l-up" />
                    <ModuleLandingPage 
                        icon={Layers} title="Separador de Camadas" 
                        description="Decomponha artes complexas em motivos individuais preservando textura e traço para produção têxtil industrial."
                        primaryActionLabel="Carregar Estampa" onPrimaryAction={() => document.getElementById('l-up')?.click()}
                    />
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                    {/* TOOLS LATERAL (DESKTOP) */}
                    <div className="hidden md:flex w-16 bg-[#0a0a0a] border-r border-white/5 flex-col items-center py-6 gap-6 shrink-0">
                        <ToolIcon icon={Hand} active={tool==='HAND'} onClick={() => setTool('HAND')} />
                        <ToolIcon icon={Wand2} active={tool==='WAND'} onClick={() => setTool('WAND')} />
                        <ToolIcon icon={Brush} active={tool==='BRUSH'} onClick={() => setTool('BRUSH')} />
                        <div className="w-8 h-px bg-white/10 my-2"></div>
                        <ToolIcon icon={Eraser} active={tool==='ERASER'} onClick={() => setTool('ERASER')} />
                    </div>

                    {/* CANVAS AREA */}
                    <div ref={containerRef} className="flex-1 relative flex items-center justify-center bg-[#050505] cursor-crosshair overflow-hidden" onPointerDown={handleInteraction}>
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        
                        <div className="relative shadow-2xl transition-transform duration-75 ease-out" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: originalImg.width, height: originalImg.height }}>
                            {layers.map(l => l.visible && (
                                <img key={l.id} src={l.src} className="absolute inset-0 w-full h-full object-contain pointer-events-none" style={{ zIndex: l.zIndex, opacity: l.opacity }} />
                            ))}
                            <canvas ref={overlayRef} width={originalImg.width} height={originalImg.height} className="absolute inset-0 pointer-events-none z-[60] mix-blend-screen opacity-90" />
                        </div>

                        {/* HUD DE SELEÇÃO */}
                        {activeMask && (
                            <div className="absolute bottom-32 md:bottom-10 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
                                <div className="bg-[#111]/95 backdrop-blur-2xl border border-white/10 px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-8">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Área Confirmada</span>
                                        </div>
                                        <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">Extraindo DNA do motivo...</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => {setActiveMask(null); setSuggestedMask(null);}} className="p-3 bg-white/5 rounded-full text-gray-400 hover:text-white"><X size={20}/></button>
                                        <button onClick={confirmExtraction} className="bg-vingi-600 px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest shadow-xl shadow-vingi-900/50 flex items-center gap-2">Adicionar Camada <Check size={18}/></button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PAINEL DE CONTROLE (LAYERS / COLORS) */}
                    <div className={`absolute md:relative right-0 top-0 bottom-0 bg-[#0a0a0a]/95 backdrop-blur-3xl border-l border-white/5 shadow-2xl transition-all duration-300 z-[150] flex flex-col ${showPanel ? 'w-80 translate-x-0' : 'w-0 translate-x-full md:w-80 md:translate-x-0'}`}>
                        <div className="flex items-center bg-[#111] border-b border-white/5 p-1 shrink-0">
                            <PanelTab label="Camadas" active={showPanel==='LAYERS'} onClick={() => setShowPanel('LAYERS')} icon={Layers} />
                            <PanelTab label="Cores" active={showPanel==='COLORS'} onClick={() => setShowPanel('COLORS')} icon={Palette} />
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {showPanel === 'LAYERS' ? (
                                layers.slice().reverse().map(l => (
                                    <div key={l.id} onClick={() => setSelectedLayerId(l.id)} className={`p-3 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer group ${selectedLayerId===l.id ? 'bg-vingi-900/30 border-vingi-500/40' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                                        <div className="w-14 h-14 bg-black rounded-xl border border-white/10 overflow-hidden shrink-0"><img src={l.src} className="w-full h-full object-cover" /></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-bold truncate text-gray-300">{l.name}</p>
                                            <div className="flex items-center gap-3 mt-2 text-gray-500">
                                                <button onClick={(e) => {e.stopPropagation(); setLayers(ls => ls.map(ly => ly.id===l.id ? {...ly, visible:!ly.visible} : ly))}}>{l.visible ? <Eye size={12}/> : <EyeOff size={12} className="text-red-500"/>}</button>
                                                <button><Lock size={12}/></button>
                                                <button className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"><Trash2 size={12}/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="space-y-6">
                                    {activeColorPalette.map((group, gi) => (
                                        <div key={gi} className="space-y-3">
                                            <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">{group.type}</h4>
                                            <div className="grid grid-cols-2 gap-2">
                                                {group.colors.map((c: any, ci: number) => (
                                                    <div key={ci} className="bg-white/5 p-2 rounded-xl flex items-center gap-3 border border-white/5 hover:border-white/10 transition-all cursor-copy">
                                                        <div className="w-8 h-8 rounded-lg shadow-inner" style={{ backgroundColor: c.hex }}></div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[9px] font-black text-gray-200 truncate">{c.name}</p>
                                                            <p className="text-[8px] text-gray-500 font-mono">{c.pantone}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* DOCK INFERIOR (MOBILE) */}
                    <div className="bg-[#0a0a0a] border-t border-white/5 shrink-0 z-[100] pb-[env(safe-area-inset-bottom)] md:hidden">
                        <div className="px-6 py-4 flex flex-col gap-4 border-b border-white/5">
                            <div className="flex justify-between items-center text-[9px] font-black text-gray-500 uppercase">
                                <span>Tolerância Visual</span>
                                <span className="text-vingi-400">{tolerance}%</span>
                            </div>
                            <input type="range" min="5" max="150" value={tolerance} onChange={e => setTolerance(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-vingi-500"/>
                        </div>
                        <div className="flex items-center justify-between px-6 py-2">
                            <ToolIcon icon={Hand} label="Pan" active={tool==='HAND'} onClick={() => setTool('HAND')} />
                            <ToolIcon icon={Wand2} label="Varinha" active={tool==='WAND'} onClick={() => setTool('WAND')} />
                            <ToolIcon icon={Brush} label="Pincel" active={tool==='BRUSH'} onClick={() => setTool('BRUSH')} />
                            <ToolIcon icon={LayoutGrid} label="Painel" onClick={() => setShowPanel('LAYERS')} />
                        </div>
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-vingi-500 blur-[80px] opacity-20 animate-pulse rounded-full"></div>
                        <Loader2 size={64} className="text-vingi-400 animate-spin relative z-10" />
                    </div>
                    <p className="text-xl font-black uppercase tracking-[0.4em] text-white animate-pulse">{statusMsg}</p>
                </div>
            )}
        </div>
    );
};

const ToolIcon = ({ icon: Icon, label, active, onClick }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center min-w-[64px] h-14 rounded-2xl gap-1.5 transition-all active:scale-90 ${active ? 'bg-vingi-900/60 text-white border border-vingi-500/30 shadow-xl' : 'text-gray-500 hover:text-white'}`}>
        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
        {label && <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>}
    </button>
);

const PanelTab = ({ label, active, onClick, icon: Icon }: any) => (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'text-white bg-white/5' : 'text-gray-600 hover:text-gray-400'}`}>
        <Icon size={14}/> {label}
    </button>
);
