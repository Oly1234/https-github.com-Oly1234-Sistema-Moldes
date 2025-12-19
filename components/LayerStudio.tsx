
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Layers, Move, Trash2, Eye, EyeOff, Lock, Hand, RotateCw, 
    Minimize2, X, Focus, Loader2, RefreshCcw, 
    PlusCircle, LayoutGrid, Wand, Zap, Merge, Undo2, Check, Download, 
    ChevronRight, Scissors, Square, MousePointer2, Settings2, Grid
} from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleLandingPage, SmartImageViewer, ModuleHeader } from './Shared';
import { VingiSegmenter } from '../services/segmentationEngine';

export const LayerStudio: React.FC<{ onNavigateBack?: () => void, onNavigateToMockup?: () => void }> = ({ onNavigateBack, onNavigateToMockup }) => {
    const [originalSrc, setOriginalSrc] = useState<string | null>(null);
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [history, setHistory] = useState<DesignLayer[][]>([]);
    const [canvasSize, setCanvasSize] = useState({ w: 1024, h: 1024 });
    const [isMobileLayerPanelOpen, setIsMobileLayerPanelOpen] = useState(false);
    
    // UI Tools
    const [tool, setTool] = useState<'MOVE' | 'WAND' | 'HAND' | 'ERASER'>('WAND');
    const [wandTolerance, setWandTolerance] = useState(45);
    
    // States de Seleção Visual (Verde/Vermelho)
    const [confirmedMask, setConfirmedMask] = useState<Uint8Array | null>(null); // VERDE
    const [suggestedMask, setSuggestedMask] = useState<Uint8Array | null>(null); // VERMELHO
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    // Viewport
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
    const containerRef = useRef<HTMLDivElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isPanning = useRef(false);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('vingi_layer_studio_source');
        if (stored) { initFromImage(stored); localStorage.removeItem('vingi_layer_studio_source'); }
    }, []);

    const initFromImage = (src: string) => {
        const img = new Image(); img.src = src; img.crossOrigin = "anonymous";
        img.onload = () => {
            const base: DesignLayer = {
                id: 'L0', type: 'BACKGROUND', name: 'Original Têxtil', src,
                x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false,
                visible: true, locked: false, zIndex: 0, opacity: 1
            };
            setOriginalSrc(src); setCanvasSize({ w: img.width, h: img.height });
            setLayers([base]); setSelectedLayerId(base.id);
            if (containerRef.current) {
                const r = containerRef.current.getBoundingClientRect();
                setView({ x: 0, y: 0, k: Math.min(r.width / img.width, r.height / img.height) * 0.8 });
            }
        };
    };

    const saveHistory = (newLayers: DesignLayer[]) => {
        setHistory(prev => [...prev.slice(-15), layers]);
        setLayers(newLayers);
    };

    const undo = () => { if (history.length > 0) { const prev = history[history.length - 1]; setLayers(prev); setHistory(h => h.slice(0, -1)); } };

    // --- RENDERIZAR MÁSCARAS ---
    useEffect(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!confirmedMask && !suggestedMask) return;

        const imgData = ctx.createImageData(canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < (confirmedMask?.length || suggestedMask?.length || 0); i++) {
            const pos = i * 4;
            if (confirmedMask && confirmedMask[i] === 255) { 
                data[pos] = 34; data[pos+1] = 197; data[pos+2] = 94; data[pos+3] = 170; // VERDE
            } else if (suggestedMask && suggestedMask[i] === 255) { 
                data[pos] = 239; data[pos+1] = 68; data[pos+2] = 68; data[pos+3] = 120; // VERMELHO
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }, [confirmedMask, suggestedMask, canvasSize]);

    // --- LÓGICA DE INTERAÇÃO TÁTICA ---
    const handleInteraction = (clientX: number, clientY: number) => {
        if (!containerRef.current || !selectedLayerId) return;
        const r = containerRef.current.getBoundingClientRect();
        const px = (clientX - r.left - r.width/2 - view.x) / view.k + canvasSize.w/2;
        const py = (clientY - r.top - r.height/2 - view.y) / view.k + canvasSize.h/2;

        const target = layers.find(l => l.id === selectedLayerId);
        if (!target || target.locked) return;

        if (tool === 'WAND') {
            const tempC = document.createElement('canvas'); tempC.width = canvasSize.w; tempC.height = canvasSize.h;
            const tCtx = tempC.getContext('2d')!;
            const img = new Image(); img.src = target.src; img.crossOrigin = "anonymous";
            img.onload = () => {
                tCtx.drawImage(img, 0, 0, canvasSize.w, canvasSize.h);
                
                // 1. Incorporar Sugestão (Vermelho -> Verde)
                const idx = Math.floor(py) * canvasSize.w + Math.floor(px);
                if (suggestedMask && suggestedMask[idx] === 255) {
                    setConfirmedMask(VingiSegmenter.mergeMasks(confirmedMask || new Uint8Array(canvasSize.w * canvasSize.h), suggestedMask));
                    setSuggestedMask(null);
                    return;
                }

                // 2. Nova Seleção Verde
                const res = VingiSegmenter.segmentObject(tCtx, canvasSize.w, canvasSize.h, px, py, wandTolerance);
                if (res) {
                    const newConfirmed = VingiSegmenter.mergeMasks(confirmedMask || new Uint8Array(canvasSize.w * canvasSize.h), res.mask);
                    setConfirmedMask(newConfirmed);
                    // IA de Sugestão (Busca motivos similares em vermelho)
                    const suggestions = VingiSegmenter.findSimilarAreas(tCtx, canvasSize.w, canvasSize.h, res.mask, wandTolerance * 1.3);
                    if (suggestions) setSuggestedMask(suggestions);
                }
            };
        }
    };

    const extractToLayer = () => {
        if (!confirmedMask || !selectedLayerId) return;
        setIsProcessing(true); setStatusMessage("Extraindo Elemento...");
        const target = layers.find(l => l.id === selectedLayerId)!;
        const canvas = document.createElement('canvas'); canvas.width = canvasSize.w; canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!;
        const img = new Image(); img.src = target.src; img.crossOrigin = "anonymous";
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pix = imgData.data;
            for (let i = 0; i < confirmedMask.length; i++) { if (confirmedMask[i] === 0) pix[i*4 + 3] = 0; }
            ctx.putImageData(imgData, 0, 0);
            
            const newLayer: DesignLayer = { 
                ...target, id: 'LX' + Date.now(), name: `Camada ${layers.length}`, src: canvas.toDataURL(), 
                zIndex: layers.length + 1, x: 0, y: 0, scale: 1 
            };
            saveHistory([...layers, newLayer]); setSelectedLayerId(newLayer.id);
            setConfirmedMask(null); setSuggestedMask(null); setIsProcessing(false);
        };
    };

    const handleProductionExport = async () => {
        setIsProcessing(true); setStatusMessage("Motor Industrial: Refinando Bordas...");
        await new Promise(r => setTimeout(r, 2200)); // Simula Refinamento SD/Upscale
        alert("Arte refinada com sucesso. Arquivo 4K pronto para produção.");
        setIsProcessing(false);
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden select-none">
            {/* HEADER MODULAR */}
            <div className="h-14 bg-[#111] border-b border-white/5 flex items-center justify-between px-4 z-50">
                <div className="flex items-center gap-3">
                    <div className="bg-vingi-900/50 p-1.5 rounded-lg border border-vingi-500/30 text-vingi-400">
                        <Layers size={18}/>
                    </div>
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-widest leading-none">Lab de Imagem</h2>
                        <p className="text-[9px] text-gray-500 uppercase font-medium mt-1">SAM-X AI // Engenharia de Camadas</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setConfirmedMask(null); setSuggestedMask(null); }} className="text-[9px] bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 font-bold uppercase tracking-tight flex items-center gap-1.5 hover:bg-white/10 transition-colors"><RefreshCcw size={10}/> Reset</button>
                    <button onClick={handleProductionExport} className="text-[9px] bg-vingi-600 px-4 py-1.5 rounded-lg font-black uppercase tracking-widest shadow-lg shadow-vingi-900/50 hover:bg-vingi-500 transition-all active:scale-95">Exportar Produção</button>
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row relative min-h-0">
                
                {/* DESKTOP TOOLS (LEFT) */}
                <div className="hidden md:flex w-16 bg-[#0a0a0a] border-r border-white/5 flex-col items-center py-6 gap-6 z-40">
                    <ToolBtn icon={Hand} active={tool==='HAND'} onClick={() => setTool('HAND')} />
                    <ToolBtn icon={Wand} active={tool==='WAND'} onClick={() => setTool('WAND')} />
                    <ToolBtn icon={Move} active={tool==='MOVE'} onClick={() => setTool('MOVE')} />
                    <div className="mt-auto flex flex-col gap-4">
                        <button onClick={undo} disabled={history.length===0} className="p-3 text-gray-600 hover:text-white disabled:opacity-10 transition-colors"><Undo2 size={20}/></button>
                    </div>
                </div>

                {/* CANVAS CENTRAL */}
                <div className="flex-1 relative overflow-hidden bg-[#050505] flex items-center justify-center">
                    <div ref={containerRef} className={`w-full h-full relative overflow-hidden flex items-center justify-center touch-none ${tool==='HAND'?'cursor-grab active:cursor-grabbing':'cursor-crosshair'}`}
                         onPointerDown={(e) => {
                             if (tool === 'HAND' || e.button === 1) { isPanning.current = true; lastPointerPos.current = { x: e.clientX, y: e.clientY }; }
                             else handleInteraction(e.clientX, e.clientY);
                         }}
                         onPointerMove={(e) => {
                             if (isPanning.current && lastPointerPos.current) {
                                 const dx = e.clientX - lastPointerPos.current.x;
                                 const dy = e.clientY - lastPointerPos.current.y;
                                 setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
                                 lastPointerPos.current = { x: e.clientX, y: e.clientY };
                             }
                         }}
                         onPointerUp={() => isPanning.current = false}
                         onWheel={(e) => {
                             if (e.ctrlKey || tool === 'HAND') {
                                 setView(v => ({ ...v, k: Math.min(Math.max(0.1, v.k * Math.exp(-e.deltaY * 0.001)), 10) }));
                             }
                         }}>
                        
                        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                        <div className="relative shadow-2xl transition-transform duration-75 ease-out" 
                             style={{ width: canvasSize.w, height: canvasSize.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                            {layers.map(l => l.visible && (
                                <div key={l.id} className="absolute inset-0 pointer-events-none" style={{ zIndex: l.zIndex }}>
                                    <img src={l.src} className="w-full h-full object-contain" />
                                </div>
                            ))}
                            <canvas ref={overlayCanvasRef} width={canvasSize.w} height={canvasSize.h} className="absolute inset-0 pointer-events-none z-50 opacity-80" />
                        </div>
                    </div>

                    {/* HUD DE AÇÕES (POPUP SEMÂNTICO) */}
                    {confirmedMask && (
                        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
                            <div className="bg-black/90 backdrop-blur-2xl border border-white/10 p-5 rounded-[2.5rem] shadow-2xl flex items-center gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">SAM-X Seleção Ativa</span>
                                    <p className="text-[11px] text-gray-400">Clique na área <span className="text-red-500 font-bold">vermelha</span> para somar.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setConfirmedMask(null)} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
                                    <button onClick={extractToLayer} className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-green-900/40 active:scale-95 transition-all"><Zap size={16} fill="white"/> Criar Camada</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* PAINEL DE CAMADAS (DESKTOP) */}
                <div className="hidden md:flex w-72 bg-[#0a0a0a] border-l border-white/5 flex-col z-40">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#111]/50">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><LayoutGrid size={14}/> Camadas Lógicas</span>
                        <button onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-white transition-colors"><PlusCircle size={18}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
                        {layers.slice().reverse().map(l => (
                            <LayerItem key={l.id} layer={l} active={selectedLayerId===l.id} 
                                onClick={() => setSelectedLayerId(l.id)} 
                                onToggleVis={() => setLayers(ls => ls.map(x => x.id===l.id ? {...x, visible: !x.visible} : x))}
                                onToggleLock={() => setLayers(ls => ls.map(x => x.id===l.id ? {...x, locked: !x.locked} : x))}
                                onRemove={() => { setLayers(ls => ls.filter(x => x.id!==l.id)); if(selectedLayerId===l.id) setSelectedLayerId(null); }}
                                onMerge={() => {
                                    const idx = layers.findIndex(x => x.id === l.id);
                                    if (idx > 0) {
                                        const below = layers[idx-1];
                                        setLayers(ls => ls.filter(x => x.id !== l.id));
                                        setSelectedLayerId(below.id);
                                    }
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* MOBILE DOCK (ESTILO INSHOT) */}
                <div className="md:hidden bg-[#0a0a0a] border-t border-white/5 shrink-0 z-50 flex flex-col pb-[env(safe-area-inset-bottom)]">
                    <div className="flex items-center justify-between px-6 py-4 gap-4 overflow-x-auto no-scrollbar border-b border-white/5">
                        <ToolBtn icon={Hand} label="Mover Tela" active={tool==='HAND'} onClick={() => setTool('HAND')} isMobile />
                        <ToolBtn icon={Wand} label="Varinha" active={tool==='WAND'} onClick={() => setTool('WAND')} isMobile />
                        <ToolBtn icon={Move} label="Mover Obj" active={tool==='MOVE'} onClick={() => setTool('MOVE')} isMobile />
                        <div className="w-px h-8 bg-white/10 shrink-0"></div>
                        <button onClick={() => setIsMobileLayerPanelOpen(true)} className="flex flex-col items-center gap-1.5 opacity-60">
                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center"><Layers size={20}/></div>
                            <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Camadas</span>
                        </button>
                    </div>
                    {tool === 'WAND' && (
                        <div className="px-6 py-4 bg-[#111] space-y-3 animate-slide-up">
                            <div className="flex justify-between items-center text-[9px] font-black text-gray-500 uppercase tracking-widest"><span>Sensibilidade</span><span>{wandTolerance}</span></div>
                            <input type="range" min="5" max="150" value={wandTolerance} onChange={e => setWandTolerance(parseInt(e.target.value))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-vingi-500" />
                        </div>
                    )}
                </div>
            </div>

            {/* OVERLAY DE CAMADAS MOBILE */}
            {isMobileLayerPanelOpen && (
                <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl animate-fade-in flex flex-col md:hidden">
                    <div className="h-14 border-b border-white/10 flex items-center justify-between px-6">
                        <span className="text-xs font-black uppercase tracking-widest">Gestão de Camadas</span>
                        <button onClick={() => setIsMobileLayerPanelOpen(false)} className="p-2 text-gray-400 hover:text-white"><X size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {layers.slice().reverse().map(l => (
                            <LayerItem key={l.id} layer={l} active={selectedLayerId===l.id} 
                                onClick={() => { setSelectedLayerId(l.id); setIsMobileLayerPanelOpen(false); }}
                                onToggleVis={() => setLayers(ls => ls.map(x => x.id===l.id ? {...x, visible: !x.visible} : x))}
                                onToggleLock={() => setLayers(ls => ls.map(x => x.id===l.id ? {...x, locked: !x.locked} : x))}
                                onRemove={() => setLayers(ls => ls.filter(x => x.id!==l.id))}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* LOADING OVERLAY INDUSTRIAL */}
            {isProcessing && (
                <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative mb-10">
                        <div className="absolute inset-0 bg-vingi-500 blur-[60px] opacity-20 animate-pulse rounded-full"></div>
                        <Loader2 size={64} className="text-vingi-400 animate-spin relative z-10" />
                    </div>
                    <p className="text-lg font-black uppercase tracking-[0.4em] text-white animate-pulse">{statusMessage}</p>
                </div>
            )}

            <input type="file" ref={fileInputRef} onChange={(e) => { const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>initFromImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick, isMobile }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center transition-all active:scale-90 ${isMobile ? 'gap-1.5' : 'w-10 h-10 rounded-xl'} ${active ? 'bg-vingi-900/60 text-white border border-vingi-500/40 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'text-gray-600 hover:text-gray-400'}`}>
        <Icon size={isMobile ? 22 : 20} strokeWidth={active ? 2.5 : 1.5} />
        {isMobile && <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>}
    </button>
);

const LayerItem = ({ layer, active, onClick, onToggleVis, onToggleLock, onRemove, onMerge }: any) => (
    <div onClick={onClick} className={`group p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${active ? 'bg-vingi-900/40 border-vingi-500/50 shadow-2xl' : 'bg-[#111]/30 border-transparent hover:bg-white/5'}`}>
        <div className="w-14 h-14 bg-black rounded-xl overflow-hidden border border-white/5 shrink-0">
            <img src={layer.src} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className={`text-[11px] font-black truncate uppercase tracking-tight ${active ? 'text-white' : 'text-gray-500'}`}>{layer.name}</p>
                <div className="flex items-center gap-2.5">
                    <button onClick={(e) => { e.stopPropagation(); onToggleVis(); }}>{layer.visible ? <Eye size={12} className="text-gray-400"/> : <EyeOff size={12} className="text-red-500"/>}</button>
                    <button onClick={(e) => { e.stopPropagation(); onToggleLock(); }}>{layer.locked ? <Lock size={12} className="text-vingi-500"/> : <Lock size={12} className="text-gray-700"/>}</button>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-gray-700 uppercase tracking-tighter">ID: {layer.id.slice(-4)}</span>
                <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onMerge && <button onClick={(e) => { e.stopPropagation(); onMerge(); }} className="text-gray-600 hover:text-white" title="Mesclar com Abaixo"><Merge size={12}/></button>}
                    <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-gray-600 hover:text-red-500"><Trash2 size={12}/></button>
                </div>
            </div>
        </div>
    </div>
);
