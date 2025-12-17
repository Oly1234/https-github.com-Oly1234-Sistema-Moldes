
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layers, Move, Trash2, Eye, EyeOff, Lock, Wand2, UploadCloud, RotateCw, Hand, Maximize, Minus, Plus, Shirt, Scan, Copy, MousePointer2, ChevronRight, FlipHorizontal, FlipVertical, ArrowUp, ArrowDown, Scissors, Eraser, Sparkles, Undo2, Redo2, Keyboard, Zap, ZoomIn, ZoomOut, RotateCcw, X, Brush, Focus, ShieldCheck, Grid, PaintBucket, Loader2, RefreshCcw, BringToFront, SendToBack, CopyPlus, MinusCircle, PlusCircle, SlidersHorizontal, Settings2, Magnet, Crop, Download, Square, Check, Cpu, Rotate3d, Move3d } from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleHeader, ModuleLandingPage } from './Shared';

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

export const LayerStudio: React.FC<{ onNavigateBack?: () => void }> = ({ onNavigateBack }) => {
    const [originalSrc, setOriginalSrc] = useState<string | null>(null);
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [history, setHistory] = useState<DesignLayer[][]>([]);
    const [canvasSize, setCanvasSize] = useState({ w: 1024, h: 1024 });
    
    // Tools
    const [tool, setTool] = useState<'MOVE' | 'WAND' | 'BRUSH' | 'ERASER' | 'HAND' | 'OFFSET'>('HAND');
    const [wandTolerance, setWandTolerance] = useState(30);
    const [brushSize, setBrushSize] = useState(50);
    const [pixelLock, setPixelLock] = useState(true);
    const [edgeFeather, setEdgeFeather] = useState(1);
    
    // Mask State
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [showSelectionOverlay, setShowSelectionOverlay] = useState(false);

    // Viewport
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
    const isPanning = useRef(false);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isDrawing = useRef(false);

    // --- ATALHOS DE TECLADO ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
            if (e.key === 'v') setTool('MOVE');
            if (e.key === 'w') setTool('WAND');
            if (e.key === 'h') setTool('HAND');
            if (e.key === 'b') setTool('BRUSH');
            if (e.key === 'o') setTool('OFFSET');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history]);

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

    const resetToZero = () => {
        if (!originalSrc) return;
        if (confirm("Deseja reiniciar o projeto? Todas as camadas e edições serão perdidas.")) {
            initFromImage(originalSrc);
        }
    };

    const initFromImage = (src: string) => {
        const img = new Image(); img.src = src;
        img.onload = () => {
            const layer: DesignLayer = {
                id: 'base-' + Date.now(), type: 'BACKGROUND', name: 'Original', src,
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
                setView({ x: 0, y: 0, k: Math.min(rect.width / img.width, rect.height / img.height) * 0.8 });
            }
        };
    };

    // --- SELECTION ACTIONS (APLICAR) ---
    const applySelectionAction = (action: 'EXTRACT' | 'DELETE' | 'HIDE') => {
        if (!activeMask || !selectedLayerId) return;
        const target = layers.find(l => l.id === selectedLayerId);
        if (!target) return;

        const canvas = document.createElement('canvas');
        canvas.width = canvasSize.w; canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!;
        const img = new Image(); img.src = target.src; img.crossOrigin = "anonymous";
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pix = imgData.data;

            if (action === 'EXTRACT') {
                // Manter apenas o que está na máscara
                for (let i = 0; i < activeMask.length; i++) { if (activeMask[i] === 0) pix[i*4 + 3] = 0; }
                ctx.putImageData(imgData, 0, 0);
                const newLayer: DesignLayer = {
                    ...target, id: 'ext-' + Date.now(), name: 'Recorte ' + (layers.length),
                    src: canvas.toDataURL(), zIndex: layers.length
                };
                saveHistory([...layers, newLayer]);
                setSelectedLayerId(newLayer.id);
            } else if (action === 'DELETE') {
                // Apagar o que está na máscara
                for (let i = 0; i < activeMask.length; i++) { if (activeMask[i] === 255) pix[i*4 + 3] = 0; }
                ctx.putImageData(imgData, 0, 0);
                const updated = layers.map(l => l.id === selectedLayerId ? { ...l, src: canvas.toDataURL() } : l);
                saveHistory(updated);
            }
            setActiveMask(null);
            setShowSelectionOverlay(false);
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
            const tempC = document.createElement('canvas');
            tempC.width = canvasSize.w; tempC.height = canvasSize.h;
            const tCtx = tempC.getContext('2d')!;
            const img = new Image(); img.src = target.src; img.crossOrigin = "anonymous";
            img.onload = () => {
                tCtx.drawImage(img, 0, 0, canvasSize.w, canvasSize.h);
                const mask = createLayerMask(tCtx, canvasSize.w, canvasSize.h, x, y, wandTolerance);
                setActiveMask(mask);
                setShowSelectionOverlay(true);
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

    const handlePointerUp = () => {
        if (isDrawing.current && (tool === 'MOVE' || tool === 'OFFSET')) saveHistory(layers);
        isPanning.current = false; isDrawing.current = false; lastPointerPos.current = null;
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
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden select-none">
            <ModuleHeader icon={Layers} title="Layer Studio" subtitle="Editor Industrial" 
                onAction={resetToZero} actionLabel="Reiniciar" referenceImage={originalSrc} />

            {!layers.length ? (
                <div className="flex-1 bg-white overflow-y-auto">
                    <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>initFromImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                    <ModuleLandingPage icon={Layers} title="Layer Lab Pro" description="Isole elementos, remova fundos e posicione estampas com inteligência artificial industrial." primaryActionLabel="Abrir Imagem" onPrimaryAction={() => fileInputRef.current?.click()} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                    
                    {/* CANVAS AREA */}
                    <div ref={containerRef} className={`flex-1 relative overflow-hidden flex items-center justify-center touch-none bg-[#0a0a0a] ${tool==='HAND'?'cursor-grab':tool==='MOVE'?'cursor-move':'cursor-crosshair'}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onWheel={handleWheel}>
                        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                        
                        <div className="relative shadow-2xl transition-transform duration-75 ease-out origin-center" style={{ width: canvasSize.w, height: canvasSize.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                            {layers.map(l => l.visible && (
                                <div key={l.id} className="absolute inset-0 pointer-events-none" style={{ transform: `translate(${l.x}px, ${l.y}px) rotate(${l.rotation}deg) scale(${l.flipX?-l.scale:l.scale}, ${l.flipY?-l.scale:l.scale})`, zIndex: l.zIndex, opacity: l.opacity ?? 1 }}>
                                    <img src={l.src} className={`w-full h-full object-contain ${selectedLayerId===l.id ? 'ring-2 ring-vingi-500 shadow-2xl' : ''}`} draggable={false} />
                                </div>
                            ))}
                            {/* Mask Overlay Visualizer */}
                            {showSelectionOverlay && activeMask && (
                                <div className="absolute inset-0 pointer-events-none z-50 mix-blend-screen opacity-60">
                                    <svg width="100%" height="100%" viewBox={`0 0 ${canvasSize.w} ${canvasSize.h}`}>
                                        <rect width="100%" height="100%" fill="rgba(0,255,255,0.1)" stroke="#00ffff" strokeWidth="2" strokeDasharray="5,5" className="animate-pulse" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* PROPERTIES PANEL */}
                    <div className="w-full md:w-80 bg-[#111] border-t md:border-t-0 md:border-l border-gray-800 flex flex-col shadow-2xl z-40 h-[40vh] md:h-full shrink-0">
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                            
                            {selectedLayer ? (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                                        <h3 className="text-[10px] font-bold text-vingi-400 uppercase tracking-widest flex items-center gap-2"><Settings2 size={12}/> {selectedLayer.name}</h3>
                                        <button onClick={() => setSelectedLayerId(null)} className="text-gray-500 hover:text-white"><X size={14}/></button>
                                    </div>

                                    {/* TRANSFORMATIONS */}
                                    <div className="space-y-4 bg-gray-900/50 p-3 rounded-xl border border-gray-800">
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase"><span>Opacidade</span><span>{Math.round((selectedLayer.opacity || 1)*100)}%</span></div>
                                            <input type="range" min="0" max="1" step="0.1" value={selectedLayer.opacity || 1} onChange={e => setLayers(ls => ls.map(l => l.id === selectedLayerId ? { ...l, opacity: parseFloat(e.target.value) } : l))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-white"/>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase"><span>Escala</span><span>{Math.round(selectedLayer.scale*100)}%</span></div>
                                            <input type="range" min="0.1" max="4" step="0.1" value={selectedLayer.scale} onChange={e => setLayers(ls => ls.map(l => l.id === selectedLayerId ? { ...l, scale: parseFloat(e.target.value) } : l))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-white"/>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            <button onClick={() => setLayers(ls => ls.map(l => l.id === selectedLayerId ? { ...l, flipX: !l.flipX } : l))} className="p-2 bg-gray-800 hover:bg-gray-700 rounded flex justify-center"><FlipHorizontal size={14}/></button>
                                            <button onClick={() => setLayers(ls => ls.map(l => l.id === selectedLayerId ? { ...l, flipY: !l.flipY } : l))} className="p-2 bg-gray-800 hover:bg-gray-700 rounded flex justify-center"><FlipVertical size={14}/></button>
                                            <button onClick={() => setLayers(ls => ls.map(l => l.id === selectedLayerId ? { ...l, zIndex: l.zIndex + 1 } : l))} className="p-2 bg-gray-800 hover:bg-gray-700 rounded flex justify-center"><BringToFront size={14}/></button>
                                            <button onClick={() => setLayers(ls => ls.filter(l => l.id !== selectedLayerId))} className="p-2 bg-red-900/20 text-red-500 hover:bg-red-900/40 rounded flex justify-center"><Trash2 size={14}/></button>
                                        </div>
                                    </div>

                                    {/* EDGE REFINEMENT */}
                                    <div className="space-y-3 bg-gray-900/30 p-3 rounded-xl border border-white/5">
                                        <h4 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1"><Scissors size={10}/> Refinamento de Borda</h4>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[8px] font-bold text-gray-400 uppercase"><span>Suavização (Feather)</span><span>{edgeFeather}px</span></div>
                                            <input type="range" min="0" max="10" step="0.5" value={edgeFeather} onChange={e => setEdgeFeather(parseFloat(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-vingi-400"/>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Camadas</h3>
                                    <div className="space-y-2">
                                        {layers.slice().reverse().map(l => (
                                            <div key={l.id} onClick={() => setSelectedLayerId(l.id)} className={`p-2 rounded-xl flex items-center gap-3 cursor-pointer border transition-all ${selectedLayerId===l.id ? 'bg-vingi-900/30 border-vingi-500/50 shadow-lg' : 'bg-[#1a1a1a] border-gray-800 hover:border-gray-600'}`}>
                                                <div className="w-10 h-10 bg-black rounded-lg overflow-hidden border border-gray-800 shrink-0"><img src={l.src} className="w-full h-full object-cover" /></div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs font-bold truncate ${selectedLayerId===l.id ? 'text-white' : 'text-gray-400'}`}>{l.name}</p>
                                                    <span className="text-[9px] text-gray-600 uppercase font-mono">{l.type}</span>
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.map(lay => lay.id === l.id ? { ...lay, visible: !lay.visible } : lay)); }} className="text-gray-600 hover:text-white p-1">
                                                    {l.visible ? <Eye size={14}/> : <EyeOff size={14}/>}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CONTEXTUAL "APPLY" BAR (WAND ACTIVE) */}
                    {showSelectionOverlay && (
                        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-slide-up flex flex-col gap-3 items-center">
                            <div className="bg-black/95 backdrop-blur-xl border border-vingi-500/50 p-4 rounded-2xl shadow-[0_0_40px_rgba(59,130,246,0.4)] flex items-center gap-4">
                                <div className="text-center pr-4 border-r border-white/10">
                                    <p className="text-[9px] font-bold text-vingi-400 uppercase tracking-widest">Seleção Ativa</p>
                                    <p className="text-xs text-white font-medium">O que deseja fazer?</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => applySelectionAction('EXTRACT')} className="px-4 py-2 bg-vingi-600 hover:bg-vingi-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-2 transition-all"><Check size={14}/> EXTRAIR CAMADA</button>
                                    <button onClick={() => applySelectionAction('DELETE')} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-2 transition-all"><Trash2 size={14}/> APAGAR ÁREA</button>
                                    <button onClick={() => { setActiveMask(null); setShowSelectionOverlay(false); }} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg"><X size={16}/></button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TOOL SLIDERS */}
                    {!showSelectionOverlay && (
                        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-4 pointer-events-none">
                            <div className="bg-black/95 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl pointer-events-auto animate-slide-up flex flex-col gap-3">
                                {tool === 'WAND' && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase"><span>Tolerância Visual</span><span>{wandTolerance}%</span></div>
                                        <input type="range" min="1" max="100" value={wandTolerance} onChange={e => setWandTolerance(parseInt(e.target.value))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-white"/>
                                    </div>
                                )}
                                {(tool === 'BRUSH' || tool === 'ERASER') && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase flex-1"><span>Tamanho</span><span>{brushSize}px</span></div>
                                            <button onClick={() => setPixelLock(!pixelLock)} className={`ml-4 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase border transition-all flex items-center gap-2 ${pixelLock ? 'bg-vingi-900 border-vingi-500 text-vingi-300' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                                                <Magnet size={10}/> {pixelLock ? 'Travar Pixels' : 'Livre'}
                                            </button>
                                        </div>
                                        <input type="range" min="5" max="300" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-white"/>
                                    </div>
                                )}
                                {tool === 'HAND' && (
                                    <div className="text-center py-1"><p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Navegação: Arraste com 2 dedos ou botão do meio</p></div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* BOTTOM DOCK */}
                    <div className="bg-[#111] border-t border-gray-800 shrink-0 z-50 pb-[env(safe-area-inset-bottom)]">
                        <div className="flex items-center justify-between px-2 py-2 overflow-x-auto no-scrollbar gap-1 max-w-4xl mx-auto">
                            <ToolBtn icon={Hand} label="Mover Tela" active={tool==='HAND'} onClick={() => setTool('HAND')} />
                            <ToolBtn icon={Move} label="Mover Elemento" active={tool==='MOVE'} onClick={() => setTool('MOVE')} />
                            <ToolBtn icon={Move3d} label="Posicionar" active={tool==='OFFSET'} onClick={() => setTool('OFFSET')} />
                            <div className="w-px h-8 bg-gray-800 mx-1"></div>
                            <ToolBtn icon={Wand2} label="Varinha" active={tool==='WAND'} onClick={() => setTool('WAND')} />
                            <ToolBtn icon={Brush} label="Pincel" active={tool==='BRUSH'} onClick={() => setTool('BRUSH')} />
                            <ToolBtn icon={Eraser} label="Apagar" active={tool==='ERASER'} onClick={() => setTool('ERASER')} />
                            <div className="w-px h-8 bg-gray-800 mx-1"></div>
                            <ToolBtn icon={Undo2} label="Desfazer" onClick={undo} disabled={history.length === 0} />
                            <ToolBtn icon={RefreshCcw} label="Nova Arte" onClick={() => fileInputRef.current?.click()} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center justify-center min-w-[64px] h-14 rounded-xl gap-1 transition-all active:scale-90 ${disabled ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/5'} ${active ? 'bg-vingi-900/50 text-white border border-vingi-500/30 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>
        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className={active ? 'drop-shadow-lg' : ''} /> 
        <span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
    </button>
);
