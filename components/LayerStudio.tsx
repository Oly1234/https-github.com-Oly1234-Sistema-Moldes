
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layers, Move, Trash2, Eye, EyeOff, Lock, Wand2, UploadCloud, RotateCw, Hand, Maximize, Minus, Plus, Shirt, Scan, Copy, MousePointer2, ChevronRight, FlipHorizontal, FlipVertical, ArrowUp, ArrowDown, Scissors, Eraser, Sparkles, Undo2, Redo2, Keyboard, Zap, ZoomIn, ZoomOut, RotateCcw, X, Brush, Focus, ShieldCheck, Grid, PaintBucket, Loader2, RefreshCcw, BringToFront, SendToBack, CopyPlus, MinusCircle, PlusCircle, SlidersHorizontal, Settings2, Magnet, Crop, Download, Square, Check, Cpu, Rotate3d, Move3d, XCircle, MoreVertical, LayoutGrid, Sliders } from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleHeader, ModuleLandingPage, SmartImageViewer } from './Shared';

// --- HELPERS DE IMAGEM ---
const createLayerMask = (ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number, tolerance: number) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const visited = new Uint8Array(width * height);
    const stack = [[Math.floor(startX), Math.floor(startY)]];
    const mask = new Uint8Array(width * height);
    const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    if (startPos < 0 || startPos >= data.length) return null;
    const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];
    while (stack.length) {
        const [x, y] = stack.pop()!;
        const idx = y * width + x;
        if (visited[idx]) continue;
        visited[idx] = 1;
        const pos = idx * 4;
        const diff = Math.abs(data[pos] - r0) + Math.abs(data[pos+1] - g0) + Math.abs(data[pos+2] - b0);
        if (diff <= tolerance * 3) {
            mask[idx] = 255;
            if (x > 0) stack.push([x-1, y]); if (x < width - 1) stack.push([x+1, y]);
            if (y > 0) stack.push([x, y-1]); if (y < height - 1) stack.push([x, y+1]);
        }
    }
    return mask;
};

export const LayerStudio: React.FC<{ onNavigateBack?: () => void, onNavigateToMockup?: () => void }> = ({ onNavigateBack, onNavigateToMockup }) => {
    const [originalSrc, setOriginalSrc] = useState<string | null>(null);
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [history, setHistory] = useState<DesignLayer[][]>([]);
    const [canvasSize, setCanvasSize] = useState({ w: 1024, h: 1024 });
    
    // Tools UI
    const [tool, setTool] = useState<'MOVE' | 'WAND' | 'BRUSH' | 'ERASER' | 'HAND' | 'OFFSET'>('HAND');
    const [wandTolerance, setWandTolerance] = useState(30);
    const [brushSize, setBrushSize] = useState(50);
    
    // UI State
    const [showLayersPanel, setShowLayersPanel] = useState(true);
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Viewport
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
    const isPanning = useRef(false);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isDrawing = useRef(false);

    const saveHistory = (newLayers: DesignLayer[]) => {
        setHistory(prev => [...prev.slice(-20), layers]);
        setLayers(newLayers);
    };

    const undo = () => {
        if (history.length > 0) {
            const prev = history[history.length - 1];
            setLayers(prev);
            setHistory(h => h.slice(0, -1));
        }
    };

    const initFromImage = (src: string) => {
        const img = new Image(); img.src = src;
        img.onload = () => {
            const layer: DesignLayer = {
                id: 'L0', type: 'BACKGROUND', name: 'ORIGINAL', src,
                x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false,
                visible: true, locked: false, zIndex: 0, opacity: 1
            };
            setOriginalSrc(src);
            setCanvasSize({ w: img.width, h: img.height });
            setLayers([layer]);
            setSelectedLayerId(layer.id);
            setHistory([]);
            setTool('MOVE');
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setView({ x: 0, y: 0, k: Math.min(rect.width / img.width, rect.height / img.height) * 0.75 });
            }
        };
    };

    const applySelectionAction = (action: 'EXTRACT' | 'DELETE') => {
        if (!activeMask || !selectedLayerId) return;
        setIsProcessing(true);
        const target = layers.find(l => l.id === selectedLayerId)!;
        
        const canvas = document.createElement('canvas');
        canvas.width = canvasSize.w; canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!;
        const img = new Image(); img.src = target.src; img.crossOrigin = "anonymous";
        
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pix = imgData.data;

            if (action === 'EXTRACT') {
                for (let i = 0; i < activeMask.length; i++) { if (activeMask[i] === 0) pix[i*4 + 3] = 0; }
                ctx.putImageData(imgData, 0, 0);
                const newId = 'LX-' + Date.now();
                const newLayer: DesignLayer = { ...target, id: newId, name: `RECORTE ${layers.length}`, src: canvas.toDataURL(), zIndex: layers.length };
                saveHistory([...layers, newLayer]);
                setSelectedLayerId(newId);
            } else {
                for (let i = 0; i < activeMask.length; i++) { if (activeMask[i] === 255) pix[i*4 + 3] = 0; }
                ctx.putImageData(imgData, 0, 0);
                saveHistory(layers.map(l => l.id === selectedLayerId ? { ...l, src: canvas.toDataURL() } : l));
            }
            setActiveMask(null);
            setIsProcessing(false);
        };
    };

    // --- INTERACTION ---
    const getCanvasCoords = (clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const cx = rect.width / 2; const cy = rect.height / 2;
        const px = (clientX - rect.left - cx - view.x) / view.k + canvasSize.w / 2;
        const py = (clientY - rect.top - cy - view.y) / view.k + canvasSize.h / 2;
        return { x: px, y: py };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        const { x, y } = getCanvasCoords(e.clientX, e.clientY);
        lastPointerPos.current = { x: e.clientX, y: e.clientY };

        if (tool === 'HAND' || e.button === 1) { isPanning.current = true; return; }

        if (tool === 'WAND' && selectedLayerId) {
            const target = layers.find(l => l.id === selectedLayerId);
            if (!target) return;
            const tempC = document.createElement('canvas'); tempC.width = canvasSize.w; tempC.height = canvasSize.h;
            const tCtx = tempC.getContext('2d')!;
            const img = new Image(); img.src = target.src; img.crossOrigin = "anonymous";
            img.onload = () => {
                tCtx.drawImage(img, 0, 0, canvasSize.w, canvasSize.h);
                const mask = createLayerMask(tCtx, canvasSize.w, canvasSize.h, x, y, wandTolerance);
                setActiveMask(mask);
            };
        } else if (tool === 'MOVE' || tool === 'OFFSET') {
            isDrawing.current = true;
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isPanning.current && lastPointerPos.current) {
            const dx = e.clientX - lastPointerPos.current.x;
            const dy = e.clientY - lastPointerPos.current.y;
            setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
            return;
        }
        if (isDrawing.current && lastPointerPos.current && selectedLayerId) {
            const dx = (e.clientX - lastPointerPos.current.x) / view.k;
            const dy = (e.clientY - lastPointerPos.current.y) / view.k;
            setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, x: l.x + dx, y: l.y + dy } : l));
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || tool === 'HAND') {
            e.preventDefault();
            const s = Math.exp(-e.deltaY * 0.001);
            setView(v => ({ ...v, k: Math.min(Math.max(0.1, v.k * s), 10) }));
        }
    };

    const selectedLayer = layers.find(l => l.id === selectedLayerId);

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden select-none font-sans">
            {/* 1. TOP BAR (MOCKUP STYLE) */}
            <div className="bg-[#111] h-14 border-b border-white/5 px-4 flex items-center justify-between shrink-0 z-[100]">
                <div className="flex items-center gap-2">
                    <div className="bg-vingi-900/50 p-1.5 rounded-lg border border-vingi-500/30"><Layers size={18} className="text-vingi-400"/></div>
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-widest leading-none">Layer Studio</h2>
                        <p className="text-[9px] text-gray-500 uppercase font-medium mt-1">Editor Profissional</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => originalSrc && initFromImage(originalSrc)} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-red-900/20 hover:border-red-500/50 transition-all flex items-center gap-2">
                        <RefreshCcw size={12}/> Reiniciar
                    </button>
                    <button onClick={() => onNavigateToMockup && onNavigateToMockup()} className="text-[10px] bg-vingi-600 px-4 py-1.5 rounded-lg font-bold hover:bg-vingi-500 transition-all shadow-lg shadow-vingi-900/50">Salvar Projeto</button>
                </div>
            </div>

            {!layers.length ? (
                <div className="flex-1 bg-white">
                    <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>initFromImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                    <ModuleLandingPage icon={Layers} title="Editor de Camadas" description="A ferramenta definitiva para isolar peças, remover fundos e preparar suas estampas para produção industrial." primaryActionLabel="Selecionar Imagem" onPrimaryAction={() => fileInputRef.current?.click()} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                    
                    {/* 2. FIXED PHOTOSHOP-STYLE LAYER PANEL (LATERAL DIREITA) */}
                    <div className={`fixed right-0 top-14 bottom-20 md:static bg-[#0a0a0a] border-l border-white/5 flex flex-col transition-all duration-300 z-50 shadow-2xl ${showLayersPanel ? 'w-64' : 'w-0 overflow-hidden'}`}>
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#111]">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Camadas</span>
                            <button onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-white"><PlusCircle size={14}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                            {layers.slice().reverse().map(l => (
                                <div key={l.id} onClick={() => setSelectedLayerId(l.id)} className={`group relative p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${selectedLayerId===l.id ? 'bg-vingi-900/30 border-vingi-500/50 shadow-lg' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                                    <div className="w-12 h-12 bg-black rounded-lg overflow-hidden border border-white/10 shrink-0 shadow-inner">
                                        <img src={l.src} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[10px] font-bold truncate ${selectedLayerId===l.id ? 'text-white' : 'text-gray-500'}`}>{l.name}</p>
                                        <div className="flex items-center gap-3 mt-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.map(ly => ly.id === l.id ? { ...ly, visible: !ly.visible } : ly)); }}>{l.visible ? <Eye size={12}/> : <EyeOff size={12}/>}</button>
                                            <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.filter(ly => ly.id !== l.id)); if(selectedLayerId===l.id) setSelectedLayerId(null); }} className="hover:text-red-500"><Trash2 size={12}/></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {/* Selected Layer Properties (Inside Panel) */}
                        {selectedLayer && (
                            <div className="p-4 bg-[#111] border-t border-white/5 space-y-4 animate-fade-in">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase"><span>Opacidade</span><span>{Math.round((selectedLayer.opacity||1)*100)}%</span></div>
                                    <input type="range" min="0" max="1" step="0.1" value={selectedLayer.opacity||1} onChange={e => setLayers(ls => ls.map(ly => ly.id === selectedLayerId ? { ...ly, opacity: parseFloat(e.target.value) } : ly))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-white"/>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase"><span>Escala</span><span>{Math.round(selectedLayer.scale*100)}%</span></div>
                                    <input type="range" min="0.1" max="4" step="0.1" value={selectedLayer.scale} onChange={e => setLayers(ls => ls.map(ly => ly.id === selectedLayerId ? { ...ly, scale: parseFloat(e.target.value) } : ly))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-white"/>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    <button onClick={() => setLayers(ls => ls.map(ly => ly.id === selectedLayerId ? { ...ly, flipX: !ly.flipX } : ly))} className="p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 flex justify-center"><FlipHorizontal size={14}/></button>
                                    <button onClick={() => setLayers(ls => ls.map(ly => ly.id === selectedLayerId ? { ...ly, flipY: !ly.flipY } : ly))} className="p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 flex justify-center"><FlipVertical size={14}/></button>
                                    <button onClick={() => setLayers(ls => ls.map(ly => ly.id === selectedLayerId ? { ...ly, zIndex: ly.zIndex + 1 } : ly))} className="p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 flex justify-center"><BringToFront size={14}/></button>
                                    <button onClick={() => setLayers(ls => ls.map(ly => ly.id === selectedLayerId ? { ...ly, rotation: (ly.rotation + 90) % 360 } : ly))} className="p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 flex justify-center"><RotateCw size={14}/></button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. VIEWPORT CENTRAL */}
                    <div ref={containerRef} className={`flex-1 relative overflow-hidden flex items-center justify-center touch-none bg-[#050505] ${tool==='HAND'?'cursor-grab':tool==='MOVE'?'cursor-move':'cursor-crosshair'}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => { isDrawing.current = false; isPanning.current = false; }} onWheel={handleWheel}>
                        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        
                        <div className="relative shadow-2xl transition-transform duration-75 ease-out origin-center" style={{ width: canvasSize.w, height: canvasSize.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                            {layers.map(l => l.visible && (
                                <div key={l.id} className="absolute inset-0 pointer-events-none" style={{ transform: `translate(${l.x}px, ${l.y}px) rotate(${l.rotation}deg) scale(${l.flipX?-l.scale:l.scale}, ${l.flipY?-l.scale:l.scale})`, zIndex: l.zIndex, opacity: l.opacity ?? 1 }}>
                                    <img src={l.src} className={`w-full h-full object-contain ${selectedLayerId===l.id ? 'ring-2 ring-vingi-500/50 shadow-2xl' : ''}`} draggable={false} />
                                </div>
                            ))}
                            {/* Blue Selection Indicator */}
                            {activeMask && <div className="absolute inset-0 border-2 border-dashed border-vingi-400 animate-pulse pointer-events-none z-[60]" />}
                        </div>

                        {/* MODAL APLICAR (AÇÃO INTELIGENTE CENTRALIZADA) */}
                        {activeMask && (
                            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
                                <div className="bg-[#111]/95 backdrop-blur-xl border border-vingi-500/30 p-2 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex items-center gap-2 min-w-[340px]">
                                    <div className="px-4 py-2 border-r border-white/5">
                                        <h4 className="text-[10px] font-black text-vingi-400 uppercase tracking-widest leading-none">Área Selecionada</h4>
                                        <p className="text-[11px] text-white font-bold mt-1">Deseja processar?</p>
                                    </div>
                                    <div className="flex gap-1 px-1">
                                        <button onClick={() => applySelectionAction('EXTRACT')} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all border border-white/5"><Plus size={14}/> Extrair</button>
                                        <button onClick={() => applySelectionAction('DELETE')} className="px-4 py-2.5 bg-red-600/90 hover:bg-red-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all shadow-lg shadow-red-900/20"><Trash2 size={14}/> Apagar</button>
                                    </div>
                                    <button onClick={() => setActiveMask(null)} className="p-2.5 hover:bg-white/10 rounded-xl text-gray-500"><X size={18}/></button>
                                </div>
                            </div>
                        )}

                        {/* TOOL SHELF (INSHOT STYLE) */}
                        {!activeMask && (
                            <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-full max-w-[280px] pointer-events-none z-50">
                                <div className="bg-black/80 backdrop-blur-md border border-white/5 p-3 rounded-2xl pointer-events-auto shadow-2xl animate-fade-in">
                                    {tool === 'WAND' ? (
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase tracking-widest"><span>Tolerância Visual</span><span>{wandTolerance}%</span></div>
                                            <input type="range" min="1" max="100" value={wandTolerance} onChange={e => setWandTolerance(parseInt(e.target.value))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-white"/>
                                        </div>
                                    ) : (tool === 'BRUSH' || tool === 'ERASER') ? (
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase tracking-widest"><span>Tamanho do Pincel</span><span>{brushSize}px</span></div>
                                            <input type="range" min="5" max="300" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-white"/>
                                        </div>
                                    ) : (
                                        <div className="text-center py-1 opacity-40"><p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Selecione uma ferramenta</p></div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* TOGGLE LAYERS BUTTON (MOBILE ONLY) */}
                        <button onClick={() => setShowLayersPanel(!showLayersPanel)} className="md:hidden absolute top-4 right-4 z-[60] bg-black/80 backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-lg text-white active:scale-95 transition-all">
                            {showLayersPanel ? <X size={20}/> : <LayoutGrid size={20}/>}
                        </button>
                    </div>

                    {/* 4. BARRA DE FERRAMENTAS (DOCK INSHOT) */}
                    <div className="bg-[#111] border-t border-white/5 shrink-0 z-[100] pb-[env(safe-area-inset-bottom)]">
                        <div className="flex items-center justify-between px-2 py-2 overflow-x-auto no-scrollbar gap-1 max-w-[1200px] mx-auto">
                            <ToolBtn icon={Hand} label="Mover Tela" active={tool==='HAND'} onClick={() => setTool('HAND')} />
                            <ToolBtn icon={Move} label="Elemento" active={tool==='MOVE'} onClick={() => setTool('MOVE')} />
                            <ToolBtn icon={Move3d} label="Posicionar" active={tool==='OFFSET'} onClick={() => setTool('OFFSET')} />
                            <div className="w-px h-8 bg-white/5 mx-1"></div>
                            <ToolBtn icon={Wand2} label="Varinha" active={tool==='WAND'} onClick={() => setTool('WAND')} />
                            <ToolBtn icon={Brush} label="Pincel" active={tool==='BRUSH'} onClick={() => setTool('BRUSH')} />
                            <ToolBtn icon={Eraser} label="Apagar" active={tool==='ERASER'} onClick={() => setTool('ERASER')} />
                            <div className="w-px h-8 bg-white/5 mx-1"></div>
                            <ToolBtn icon={Undo2} label="Desfazer" onClick={undo} disabled={history.length === 0} />
                            <ToolBtn icon={RefreshCcw} label="Novo Arquivo" onClick={() => fileInputRef.current?.click()} />
                        </div>
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
                    <Loader2 size={40} className="text-vingi-400 animate-spin mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest text-white">Refinando Pixels...</p>
                </div>
            )}
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center justify-center min-w-[68px] h-14 rounded-xl gap-1 transition-all active:scale-90 ${disabled ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/5'} ${active ? 'bg-vingi-900/40 text-white border border-vingi-500/30 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>
        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className={active ? 'drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]' : ''} /> 
        <span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
    </button>
);
