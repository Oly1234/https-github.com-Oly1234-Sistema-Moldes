
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layers, Move, Trash2, Eye, EyeOff, Lock, Wand2, UploadCloud, RotateCw, Hand, Maximize, Minimize2, Minus, Plus, Shirt, Scan, Copy, MousePointer2, ChevronRight, FlipHorizontal, FlipVertical, ArrowUp, ArrowDown, Scissors, Eraser, Sparkles, Undo2, Redo2, Keyboard, Zap, ZoomIn, ZoomOut, RotateCcw, X, Brush, Focus, ShieldCheck, Grid, PaintBucket, Loader2, RefreshCcw, BringToFront, SendToBack, CopyPlus, MinusCircle, PlusCircle, SlidersHorizontal, Settings2, Magnet, Crop, Download, Square, Check, Cpu, Rotate3d, Move3d, XCircle, MoreVertical, LayoutGrid, Sliders, BoxSelect, Sparkle, Wand, Send } from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleHeader, ModuleLandingPage } from './Shared';
import { VingiSegmenter, SegmentationResult } from '../services/segmentationEngine';

export const LayerStudio: React.FC<{ onNavigateBack?: () => void, onNavigateToMockup?: () => void }> = ({ onNavigateBack, onNavigateToMockup }) => {
    const [originalSrc, setOriginalSrc] = useState<string | null>(null);
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [history, setHistory] = useState<DesignLayer[][]>([]);
    const [canvasSize, setCanvasSize] = useState({ w: 1024, h: 1024 });
    
    // Tools UI
    const [tool, setTool] = useState<'MOVE' | 'WAND' | 'BRUSH' | 'ERASER' | 'HAND'>('HAND');
    const [wandTolerance, setWandTolerance] = useState(32);
    const [wandMode, setWandMode] = useState<'ADD' | 'SUB'>('ADD');
    const [brushSize, setBrushSize] = useState(40);
    
    // UI State
    const [showLayersPanel, setShowLayersPanel] = useState(true);
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [maskBounds, setMaskBounds] = useState<{x: number, y: number, w: number, h: number} | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showActionPanel, setShowActionPanel] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

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
                id: 'L0', type: 'BACKGROUND', name: 'Base Têxtil', src,
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

            if (action === 'EXTRACT' && maskBounds) {
                for (let i = 0; i < activeMask.length; i++) { if (activeMask[i] === 0) pix[i*4 + 3] = 0; }
                ctx.putImageData(imgData, 0, 0);
                
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = maskBounds.w; cropCanvas.height = maskBounds.h;
                const cCtx = cropCanvas.getContext('2d')!;
                cCtx.drawImage(canvas, maskBounds.x, maskBounds.y, maskBounds.w, maskBounds.h, 0, 0, maskBounds.w, maskBounds.h);
                
                const newId = 'LX-' + Date.now();
                const newLayer: DesignLayer = { 
                    ...target, id: newId, name: `Recorte ${layers.length}`, 
                    src: cropCanvas.toDataURL(), zIndex: layers.length + 1,
                    x: target.x + maskBounds.x, y: target.y + maskBounds.y,
                    scale: 1 
                };
                saveHistory([...layers, newLayer]);
                setSelectedLayerId(newId);
            } else {
                for (let i = 0; i < activeMask.length; i++) { if (activeMask[i] === 255) pix[i*4 + 3] = 0; }
                ctx.putImageData(imgData, 0, 0);
                saveHistory(layers.map(l => l.id === selectedLayerId ? { ...l, src: canvas.toDataURL() } : l));
            }
            setActiveMask(null);
            setMaskBounds(null);
            setShowActionPanel(false);
            setIsProcessing(false);
        };
    };

    const handleAISwap = async () => {
        if (!selectedLayerId || !aiPrompt || !activeMask) return;
        setIsProcessing(true);
        try {
            const target = layers.find(l => l.id === selectedLayerId)!;
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'TRANSFORM_ELEMENT', userPrompt: aiPrompt, cropBase64: target.src.split(',')[1] })
            });
            const data = await res.json();
            if (data.success && data.image) {
                const newId = 'LAI-' + Date.now();
                const newLayer: DesignLayer = { ...target, id: newId, name: `IA: ${aiPrompt}`, src: data.image, zIndex: layers.length + 1 };
                saveHistory([...layers, newLayer]);
                setSelectedLayerId(newId);
                setAiPrompt('');
                setActiveMask(null);
                setMaskBounds(null);
                setShowActionPanel(false);
            }
        } catch (e) { console.error(e); }
        finally { setIsProcessing(false); }
    };

    // --- INTERACTION ---
    const getCanvasCoords = (clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const px = (clientX - rect.left - cx - view.x) / view.k + canvasSize.w / 2;
        const py = (clientY - rect.top - cy - view.y) / view.k + canvasSize.h / 2;
        return { x: px, y: py };
    };

    const paint = (x: number, y: number) => {
        if (!selectedLayerId) return;
        const target = layers.find(l => l.id === selectedLayerId);
        if (!target || target.locked) return;

        const canvas = document.createElement('canvas');
        canvas.width = canvasSize.w; canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!;
        const img = new Image(); img.src = target.src;
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            ctx.globalCompositeOperation = tool === 'ERASER' ? 'destination-out' : 'source-over';
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.fill();
            setLayers(ls => ls.map(l => l.id === selectedLayerId ? { ...l, src: canvas.toDataURL() } : l));
        };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        const { x, y } = getCanvasCoords(e.clientX, e.clientY);
        lastPointerPos.current = { x: e.clientX, y: e.clientY };

        if (tool === 'HAND' || e.button === 1) { isPanning.current = true; return; }

        const targetLayer = layers.find(l => l.id === selectedLayerId);
        if (!targetLayer || targetLayer.locked) return;

        if (tool === 'WAND') {
            const tempC = document.createElement('canvas'); tempC.width = canvasSize.w; tempC.height = canvasSize.h;
            const tCtx = tempC.getContext('2d')!;
            const img = new Image(); img.src = targetLayer.src; img.crossOrigin = "anonymous";
            img.onload = () => {
                tCtx.drawImage(img, 0, 0, canvasSize.w, canvasSize.h);
                const res = VingiSegmenter.segmentObject(tCtx, canvasSize.w, canvasSize.h, x, y, wandTolerance);
                if (res) {
                    if (wandMode === 'ADD' && activeMask) {
                        const merged = VingiSegmenter.mergeMasks(activeMask, res.mask);
                        setActiveMask(merged);
                        if (maskBounds) {
                            const minX = Math.min(maskBounds.x, res.bounds.x);
                            const minY = Math.min(maskBounds.y, res.bounds.y);
                            const maxX = Math.max(maskBounds.x + maskBounds.w, res.bounds.x + res.bounds.w);
                            const maxY = Math.max(maskBounds.y + maskBounds.h, res.bounds.y + res.bounds.h);
                            setMaskBounds({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
                        }
                    } else if (wandMode === 'SUB' && activeMask) {
                        setActiveMask(VingiSegmenter.subtractMasks(activeMask, res.mask));
                    } else {
                        setActiveMask(res.mask);
                        setMaskBounds(res.bounds);
                    }
                }
            };
        } else if (tool === 'BRUSH' || tool === 'ERASER') {
            isDrawing.current = true;
            paint(x, y);
        } else if (tool === 'MOVE') {
            isDrawing.current = true;
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        setCursorPos({ x: e.clientX, y: e.clientY });

        if (isPanning.current && lastPointerPos.current) {
            const dx = e.clientX - lastPointerPos.current.x;
            const dy = e.clientY - lastPointerPos.current.y;
            setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (isDrawing.current && lastPointerPos.current && selectedLayerId) {
            const { x, y } = getCanvasCoords(e.clientX, e.clientY);
            if (tool === 'BRUSH' || tool === 'ERASER') {
                paint(x, y);
            } else if (tool === 'MOVE') {
                const dx = (e.clientX - lastPointerPos.current.x) / view.k;
                const dy = (e.clientY - lastPointerPos.current.y) / view.k;
                setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, x: l.x + dx, y: l.y + dy } : l));
            }
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
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden select-none font-sans relative">
            {/* 1. HEADER */}
            <div className="bg-[#111] h-14 border-b border-white/5 px-4 flex items-center justify-between shrink-0 z-[100]">
                <div className="flex items-center gap-2">
                    <div className="bg-vingi-900/50 p-1.5 rounded-lg border border-vingi-500/30"><Layers size={18} className="text-vingi-400"/></div>
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-widest leading-none">Layer Studio Pro</h2>
                        <p className="text-[9px] text-gray-500 uppercase font-medium mt-1">SAM-Modular Engine v2</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => originalSrc && initFromImage(originalSrc)} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-red-900/20 hover:border-red-500/50 transition-all flex items-center gap-2">
                        <RefreshCcw size={12}/> Reiniciar
                    </button>
                    <button onClick={() => onNavigateToMockup && onNavigateToMockup()} className="text-[10px] bg-vingi-600 px-4 py-1.5 rounded-lg font-bold hover:bg-vingi-500 transition-all shadow-lg shadow-vingi-900/50">Finalizar</button>
                </div>
            </div>

            {!layers.length ? (
                <div className="flex-1 bg-white">
                    <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>initFromImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                    <ModuleLandingPage icon={Layers} title="Lab de Segmentação" description="Tecnologia neuro-visual para isolamento de elementos com inteligência de borda." primaryActionLabel="Iniciar Decomposição" onPrimaryAction={() => fileInputRef.current?.click()} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    
                    {/* 2. VIEWPORT CENTRAL */}
                    <div ref={containerRef} className={`flex-1 relative overflow-hidden flex items-center justify-center touch-none bg-[#050505] ${tool==='HAND'?'cursor-grab':tool==='MOVE'?'cursor-move':'cursor-none'}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => { if(isDrawing.current) saveHistory([...layers]); isDrawing.current = false; isPanning.current = false; }} onWheel={handleWheel}>
                        
                        {/* CURSOR VISUAL DE PRECISÃO */}
                        {(tool === 'BRUSH' || tool === 'ERASER') && (
                            <div className="fixed pointer-events-none z-[1000] rounded-full border border-white/60 bg-white/5 mix-blend-difference shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
                                 style={{ width: brushSize * view.k, height: brushSize * view.k, left: cursorPos.x - (brushSize * view.k)/2, top: cursorPos.y - (brushSize * view.k)/2 }}>
                                <div className="absolute inset-0 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full"></div></div>
                            </div>
                        )}

                        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        
                        <div className="relative shadow-2xl transition-transform duration-75 ease-out origin-center" style={{ width: canvasSize.w, height: canvasSize.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                            {layers.map(l => l.visible && (
                                <div key={l.id} className="absolute inset-0 pointer-events-none" style={{ transform: `translate(${l.x}px, ${l.y}px) rotate(${l.rotation}deg) scale(${l.flipX?-l.scale:l.scale}, ${l.flipY?-l.scale:l.scale})`, zIndex: l.zIndex, opacity: l.opacity ?? 1 }}>
                                    <img src={l.src} className={`w-full h-full object-contain ${selectedLayerId===l.id ? 'filter drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]' : ''}`} draggable={false} />
                                </div>
                            ))}
                            
                            {/* BOUNDING BOX ATIVO (SÓ NO OBJETO) */}
                            {activeMask && maskBounds && (
                                <div className="absolute border-[3px] border-vingi-400 border-dashed animate-pulse pointer-events-none z-[60] shadow-[0_0_30px_rgba(59,130,246,0.4)]" 
                                     style={{ left: maskBounds.x, top: maskBounds.y, width: maskBounds.w, height: maskBounds.h }}>
                                    <div className="absolute -top-7 left-0 bg-vingi-500 text-black text-[9px] font-black px-2 py-1 rounded-md flex items-center gap-1.5 uppercase tracking-widest shadow-xl"><Focus size={12}/> Objeto Detectado</div>
                                </div>
                            )}
                        </div>

                        {/* PAINEL DE AÇÃO INTELIGENTE */}
                        {showActionPanel && activeMask && (
                            <div className="absolute bottom-44 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
                                <div className="bg-[#111]/98 backdrop-blur-2xl border border-vingi-500/30 p-4 rounded-[2rem] shadow-[0_0_80px_rgba(0,0,0,0.95)] flex flex-col gap-4 min-w-[440px]">
                                    <div className="flex items-center justify-between px-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 bg-vingi-500 rounded-xl shadow-lg shadow-vingi-900/50"><Sparkles size={16} className="text-black"/></div>
                                            <h4 className="text-xs font-black text-white uppercase tracking-widest">Processar Seleção</h4>
                                        </div>
                                        <button onClick={() => setShowActionPanel(false)} className="p-1.5 hover:bg-white/10 rounded-full text-gray-500 transition-colors"><X size={20}/></button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => applySelectionAction('EXTRACT')} className="px-5 py-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2.5 border border-white/5 transition-all"><Plus size={18}/> Isolar Elemento</button>
                                        <button onClick={() => applySelectionAction('DELETE')} className="px-5 py-3.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2.5 transition-all border border-red-900/30"><Trash2 size={18}/> Excluir Área</button>
                                    </div>

                                    <div className="h-px bg-white/5 mx-2"></div>
                                    
                                    <div className="px-2 space-y-2.5">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">Neuro-Substituição (IA)</p>
                                        <div className="flex gap-2">
                                            <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Ex: Substituir por botão de madrepérola..." className="flex-1 bg-black/60 border border-white/10 rounded-2xl px-5 py-3 text-xs outline-none focus:border-vingi-500 transition-all" />
                                            <button onClick={handleAISwap} disabled={!aiPrompt} className="bg-vingi-600 hover:bg-vingi-500 disabled:opacity-30 px-4 rounded-2xl transition-all shadow-xl shadow-vingi-900/50"><Send size={20}/></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* LISTA DE CAMADAS */}
                        <div className={`absolute top-6 right-6 bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/5 flex flex-col transition-all duration-300 z-50 shadow-2xl rounded-3xl overflow-hidden ${showLayersPanel ? 'w-64 h-[calc(100%-140px)]' : 'w-14 h-14'}`}>
                            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#111]/50">
                                {showLayersPanel ? (
                                    <>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Camadas</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-white transition-colors"><PlusCircle size={16}/></button>
                                            <button onClick={() => setShowLayersPanel(false)} className="text-gray-500 hover:text-white transition-colors"><Minimize2 size={16}/></button>
                                        </div>
                                    </>
                                ) : (
                                    <button onClick={() => setShowLayersPanel(true)} className="w-full h-full flex items-center justify-center text-vingi-400 hover:scale-110 transition-transform"><LayoutGrid size={24}/></button>
                                )}
                            </div>
                            {showLayersPanel && (
                                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
                                    {layers.slice().reverse().map(l => (
                                        <div key={l.id} onClick={() => setSelectedLayerId(l.id)} className={`group p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${selectedLayerId===l.id ? 'bg-vingi-900/30 border-vingi-500/50 shadow-xl' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                                            <div className="w-12 h-12 bg-black rounded-xl overflow-hidden border border-white/10 shrink-0 shadow-inner"><img src={l.src} className="w-full h-full object-cover" /></div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[11px] font-bold truncate ${selectedLayerId===l.id ? 'text-white' : 'text-gray-500'}`}>{l.name}</p>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.map(ly => ly.id === l.id ? { ...ly, visible: !ly.visible } : ly)); }}>{l.visible ? <Eye size={12} className="text-gray-400"/> : <EyeOff size={12} className="text-red-500"/>}</button>
                                                    <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.map(ly => ly.id === l.id ? { ...ly, locked: !ly.locked } : ly)); }}>{l.locked ? <Lock size={12} className="text-vingi-500"/> : <Lock size={12} className="text-gray-600"/>}</button>
                                                    <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.filter(ly => ly.id !== l.id)); if(selectedLayerId===l.id) setSelectedLayerId(null); }} className="hover:text-red-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. DOCK INFERIOR */}
                    <div className="bg-[#0a0a0a] border-t border-white/5 shrink-0 z-[100] pb-[env(safe-area-inset-bottom)] flex flex-col shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                        
                        {/* CONTEXTUAL SLIDERS */}
                        <div className="bg-[#111] px-8 py-4 flex flex-col md:flex-row items-center justify-between border-b border-white/5 gap-6">
                            <div className="flex items-center gap-6 flex-1 w-full max-w-5xl">
                                {tool === 'WAND' ? (
                                    <>
                                        <div className="flex bg-black/50 rounded-xl p-1.5 border border-white/5 shrink-0 shadow-inner">
                                            <button onClick={() => setWandMode('ADD')} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase transition-all ${wandMode==='ADD'?'bg-vingi-600 text-white shadow-xl':'text-gray-600 hover:text-gray-400'}`}><Plus size={14}/> Somar</button>
                                            <button onClick={() => setWandMode('SUB')} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase transition-all ${wandMode==='SUB'?'bg-red-600 text-white shadow-xl':'text-gray-600 hover:text-gray-400'}`}><Minus size={14}/> Subtrair</button>
                                        </div>
                                        <div className="flex-1 space-y-1.5">
                                            <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em]"><span>Inteligência de Borda</span><span>{wandTolerance}</span></div>
                                            <input type="range" min="1" max="150" value={wandTolerance} onChange={e => setWandTolerance(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-white cursor-pointer"/>
                                        </div>
                                        <div className="flex gap-2">
                                            {activeMask && (
                                                <button onClick={() => setShowActionPanel(true)} className="px-6 py-2.5 bg-vingi-500 text-black rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-[0_0_25px_rgba(59,130,246,0.5)] transition-all hover:scale-105 active:scale-95"><Sparkle size={16}/> Ações</button>
                                            )}
                                            <button onClick={() => { setActiveMask(null); setMaskBounds(null); }} disabled={!activeMask} className="p-2.5 bg-white/5 rounded-xl text-gray-500 hover:text-red-500 disabled:opacity-20 transition-colors"><XCircle size={20}/></button>
                                        </div>
                                    </>
                                ) : (tool === 'BRUSH' || tool === 'ERASER') ? (
                                    <>
                                        <div className="flex-1 space-y-1.5">
                                            <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em]"><span>Tamanho da Ferramenta</span><span>{brushSize}px</span></div>
                                            <input type="range" min="2" max="250" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-white cursor-pointer"/>
                                        </div>
                                        {selectedLayer?.locked && (
                                            <div className="flex items-center gap-2.5 bg-red-900/20 border border-red-500/30 px-4 py-2 rounded-xl">
                                                <ShieldCheck size={16} className="text-red-400"/>
                                                <span className="text-[10px] font-black text-red-400 uppercase">Camada Travada</span>
                                            </div>
                                        )}
                                    </>
                                ) : selectedLayer && (
                                    <div className="flex-1 grid grid-cols-2 gap-10">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase"><span>Opacidade</span><span>{Math.round((selectedLayer.opacity||1)*100)}%</span></div>
                                            <input type="range" min="0" max="1" step="0.1" value={selectedLayer.opacity||1} onChange={e => setLayers(ls => ls.map(ly => ly.id === selectedLayerId ? { ...ly, opacity: parseFloat(e.target.value) } : ly))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-white"/>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase"><span>Escala da Camada</span><span>{Math.round(selectedLayer.scale*100)}%</span></div>
                                            <input type="range" min="0.1" max="4" step="0.1" value={selectedLayer.scale} onChange={e => setLayers(ls => ls.map(ly => ly.id === selectedLayerId ? { ...ly, scale: parseFloat(e.target.value) } : ly))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-white"/>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* BARRA DE FERRAMENTAS PRINCIPAL */}
                        <div className="flex items-center justify-between px-6 py-2.5 overflow-x-auto no-scrollbar gap-2 max-w-[1200px] mx-auto w-full">
                            <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>initFromImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                            
                            <ToolBtn icon={Hand} label="Navegar" active={tool==='HAND'} onClick={() => setTool('HAND')} />
                            <ToolBtn icon={Move} label="Mover" active={tool==='MOVE'} onClick={() => setTool('MOVE')} />
                            
                            <div className="w-px h-8 bg-white/5 mx-1"></div>
                            
                            <ToolBtn icon={Wand} label="Vingi SAM" active={tool==='WAND'} onClick={() => setTool('WAND')} />
                            <ToolBtn icon={Brush} label="Pincel" active={tool==='BRUSH'} onClick={() => setTool('BRUSH')} />
                            <ToolBtn icon={Eraser} label="Borracha" active={tool==='ERASER'} onClick={() => setTool('ERASER')} />
                            
                            <div className="w-px h-8 bg-white/5 mx-1"></div>

                            <div className="hidden md:flex gap-1.5">
                                <button onClick={() => setLayers(ls => ls.map(ly => ly.id === selectedLayerId ? { ...ly, flipX: !ly.flipX } : ly))} className="p-3 bg-white/5 rounded-2xl text-gray-500 hover:text-white transition-all shadow-sm" title="Espelhar"><FlipHorizontal size={20}/></button>
                                <button onClick={() => setLayers(ls => ls.map(ly => ly.id === selectedLayerId ? { ...ly, rotation: (ly.rotation + 90) % 360 } : ly))} className="p-3 bg-white/5 rounded-2xl text-gray-500 hover:text-white transition-all shadow-sm" title="Girar 90°"><RotateCw size={20}/></button>
                            </div>

                            <div className="w-px h-8 bg-white/5 mx-1"></div>
                            
                            <ToolBtn icon={Undo2} label="Desfazer" onClick={undo} disabled={history.length === 0} />
                            <ToolBtn icon={RefreshCcw} label="Nova Arte" onClick={() => fileInputRef.current?.click()} />
                        </div>
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-xl flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-vingi-500 blur-2xl opacity-20 animate-pulse"></div>
                        <Loader2 size={56} className="text-vingi-400 animate-spin relative z-10" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-white">Segmentando Neuro-Camadas...</p>
                    <p className="text-[10px] text-gray-500 mt-2 font-mono">VINGI_SAM_ENGINE_ACTIVE // V2.0</p>
                </div>
            )}
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center justify-center min-w-[76px] h-16 rounded-[1.25rem] gap-1.5 transition-all active:scale-90 ${disabled ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/5'} ${active ? 'bg-vingi-900/50 text-white border border-vingi-500/30 shadow-2xl shadow-vingi-900/50' : 'text-gray-500 hover:text-gray-300'}`}>
        <Icon size={22} strokeWidth={active ? 2.5 : 1.5} className={active ? 'drop-shadow-[0_0_12px_rgba(59,130,246,0.6)]' : ''} /> 
        <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
    </button>
);
