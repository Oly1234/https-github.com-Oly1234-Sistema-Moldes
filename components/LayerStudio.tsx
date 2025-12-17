
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layers, Move, Trash2, Eye, EyeOff, Lock, UploadCloud, RotateCw, Hand, Maximize, Minimize2, Minus, Plus, MousePointer2, ChevronRight, FlipHorizontal, FlipVertical, Eraser, Sparkles, Undo2, X, Brush, Focus, ShieldCheck, Grid, Loader2, RefreshCcw, PlusCircle, SlidersHorizontal, Settings2, XCircle, LayoutGrid, BoxSelect, Sparkle, Wand, Send, Crosshair, Target } from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleLandingPage } from './Shared';
import { VingiSegmenter, SegmentationResult } from '../services/segmentationEngine';

export const LayerStudio: React.FC<{ onNavigateBack?: () => void, onNavigateToMockup?: () => void }> = ({ onNavigateBack, onNavigateToMockup }) => {
    const [originalSrc, setOriginalSrc] = useState<string | null>(null);
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [history, setHistory] = useState<DesignLayer[][]>([]);
    const [canvasSize, setCanvasSize] = useState({ w: 1024, h: 1024 });
    
    // Tools UI
    const [tool, setTool] = useState<'MOVE' | 'WAND' | 'BRUSH' | 'ERASER' | 'HAND'>('WAND');
    const [wandTolerance, setWandTolerance] = useState(35);
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
                id: 'L0', type: 'BACKGROUND', name: 'Base Original', src,
                x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false,
                visible: true, locked: false, zIndex: 0, opacity: 1
            };
            setOriginalSrc(src);
            setCanvasSize({ w: img.width, h: img.height });
            setLayers([layer]);
            setSelectedLayerId(layer.id);
            setHistory([]);
            setTool('WAND');
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
                // Criar máscara Alpha com suavização de borda (Anti-Aliasing básico)
                for (let i = 0; i < activeMask.length; i++) { 
                    if (activeMask[i] === 0) pix[i*4 + 3] = 0; 
                }
                ctx.putImageData(imgData, 0, 0);
                
                // EXTRAÇÃO PIXEL-PERFECT: Manter coordenadas absolutas
                const newId = 'LX-' + Date.now();
                const newLayer: DesignLayer = { 
                    ...target, 
                    id: newId, 
                    name: `Motivo ${layers.length}`, 
                    src: canvas.toDataURL(), 
                    zIndex: layers.length + 1,
                    // Mantém na mesma posição exata
                    x: target.x, y: target.y,
                    scale: target.scale 
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
            ctx.shadowBlur = 2; ctx.shadowColor = tool === 'ERASER' ? 'transparent' : 'white';
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
                    setShowActionPanel(true);
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
                        <p className="text-[9px] text-gray-500 uppercase font-medium mt-1">Motor SAM v2.5 Ativo</p>
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
                    <ModuleLandingPage icon={Layers} title="Decomposição Inteligente" description="Isole elementos de estampas com precisão SAM. Clique para selecionar objetos e transforme-os em camadas independentes." primaryActionLabel="Iniciar Estúdio" onPrimaryAction={() => fileInputRef.current?.click()} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    
                    {/* 2. VIEWPORT CENTRAL */}
                    <div ref={containerRef} className={`flex-1 relative overflow-hidden flex items-center justify-center touch-none bg-[#050505] cursor-none`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => { if(isDrawing.current) saveHistory([...layers]); isDrawing.current = false; isPanning.current = false; }} onWheel={handleWheel}>
                        
                        {/* CURSOR VISUAL DINÂMICO (CUSTOM MOUSE) */}
                        <div className="fixed pointer-events-none z-[1000] mix-blend-difference flex items-center justify-center transition-transform duration-75" 
                             style={{ left: cursorPos.x, top: cursorPos.y, transform: 'translate(-50%, -50%)' }}>
                            {tool === 'HAND' ? <Hand size={24} className="text-white"/> : 
                             tool === 'MOVE' ? <Move size={24} className="text-white"/> :
                             tool === 'WAND' ? (
                                <div className="relative">
                                    <Target size={32} className="text-white/80 animate-spin-slow" strokeWidth={1}/>
                                    <div className="absolute inset-0 flex items-center justify-center"><div className="w-1 h-1 bg-vingi-400 rounded-full shadow-[0_0_10px_#3b82f6]"></div></div>
                                </div>
                             ) : (
                                <div className="rounded-full border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)] bg-white/5" 
                                     style={{ width: brushSize * view.k, height: brushSize * view.k }}>
                                    <div className="absolute inset-0 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full"></div></div>
                                </div>
                             )}
                        </div>

                        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        
                        <div className="relative shadow-2xl transition-transform duration-75 ease-out origin-center" style={{ width: canvasSize.w, height: canvasSize.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                            {layers.map(l => l.visible && (
                                <div key={l.id} className="absolute inset-0 pointer-events-none" style={{ transform: `translate(${l.x}px, ${l.y}px) rotate(${l.rotation}deg) scale(${l.flipX?-l.scale:l.scale}, ${l.flipY?-l.scale:l.scale})`, zIndex: l.zIndex, opacity: l.opacity ?? 1 }}>
                                    <img src={l.src} className={`w-full h-full object-contain ${selectedLayerId===l.id ? 'filter drop-shadow-[0_0_25px_rgba(59,130,246,0.6)]' : ''}`} draggable={false} />
                                </div>
                            ))}
                            
                            {/* BOUNDING BOX REAL (LOCALIZADO NO OBJETO) */}
                            {activeMask && maskBounds && (
                                <div className="absolute border-[3px] border-vingi-400 border-dashed animate-pulse pointer-events-none z-[60] shadow-[0_0_40px_rgba(59,130,246,0.4)]" 
                                     style={{ left: maskBounds.x, top: maskBounds.y, width: maskBounds.w, height: maskBounds.h }}>
                                    <div className="absolute -top-7 left-0 bg-vingi-500 text-black text-[9px] font-black px-2 py-1 rounded-md flex items-center gap-1.5 uppercase tracking-widest shadow-xl"><Focus size={12}/> Objeto Detectado</div>
                                    {/* Corner handles visual feedback */}
                                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-white rounded-full"></div>
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full"></div>
                                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white rounded-full"></div>
                                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white rounded-full"></div>
                                </div>
                            )}
                        </div>

                        {/* MODAL DE AÇÃO INTELIGENTE (POSIÇÃO DINÂMICA) */}
                        {showActionPanel && activeMask && (
                            <div className="absolute bottom-44 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
                                <div className="bg-[#111]/98 backdrop-blur-2xl border border-vingi-500/30 p-4 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.95)] flex flex-col gap-4 min-w-[460px]">
                                    <div className="flex items-center justify-between px-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-vingi-500 rounded-2xl shadow-lg shadow-vingi-900/50"><Sparkles size={18} className="text-black"/></div>
                                            <h4 className="text-xs font-black text-white uppercase tracking-widest">Motor de Motivos</h4>
                                        </div>
                                        <button onClick={() => { setActiveMask(null); setShowActionPanel(false); }} className="p-2 hover:bg-white/10 rounded-full text-gray-500 transition-colors"><X size={24}/></button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => applySelectionAction('EXTRACT')} className="px-6 py-4 bg-white/5 hover:bg-white/10 rounded-3xl text-[11px] font-black uppercase flex items-center justify-center gap-3 border border-white/5 transition-all active:scale-95 group"><Plus size={20} className="group-hover:rotate-90 transition-transform"/> Isolar em Camada</button>
                                        <button onClick={() => applySelectionAction('DELETE')} className="px-6 py-4 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-3xl text-[11px] font-black uppercase flex items-center justify-center gap-3 transition-all border border-red-900/30 active:scale-95"><Trash2 size={20}/> Remover da Base</button>
                                    </div>

                                    <div className="h-px bg-white/5 mx-3"></div>
                                    
                                    <div className="px-3 space-y-2.5">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">Troca Inteligente (IA)</p>
                                        <div className="flex gap-2">
                                            <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Ex: Substituir por botão de cristal..." className="flex-1 bg-black/60 border border-white/10 rounded-3xl px-6 py-3.5 text-xs outline-none focus:border-vingi-500 transition-all font-medium" />
                                            <button onClick={handleAISwap} disabled={!aiPrompt} className="bg-vingi-600 hover:bg-vingi-500 disabled:opacity-30 px-5 rounded-3xl transition-all shadow-xl shadow-vingi-900/50 flex items-center justify-center"><Send size={22}/></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* LISTA DE CAMADAS */}
                        <div className={`absolute top-6 right-6 bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/5 flex flex-col transition-all duration-300 z-50 shadow-2xl rounded-[2rem] overflow-hidden ${showLayersPanel ? 'w-72 h-[calc(100%-160px)]' : 'w-14 h-14'}`}>
                            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#111]/50">
                                {showLayersPanel ? (
                                    <>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Camadas</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-white transition-colors"><PlusCircle size={18}/></button>
                                            <button onClick={() => setShowLayersPanel(false)} className="text-gray-500 hover:text-white transition-colors"><Minimize2 size={18}/></button>
                                        </div>
                                    </>
                                ) : (
                                    <button onClick={() => setShowLayersPanel(true)} className="w-full h-full flex items-center justify-center text-vingi-400 hover:scale-110 transition-transform"><LayoutGrid size={24}/></button>
                                )}
                            </div>
                            {showLayersPanel && (
                                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
                                    {layers.slice().reverse().map(l => (
                                        <div key={l.id} onClick={() => setSelectedLayerId(l.id)} className={`group p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${selectedLayerId===l.id ? 'bg-vingi-900/40 border-vingi-500/50 shadow-xl' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                                            <div className="w-14 h-14 bg-black rounded-xl overflow-hidden border border-white/10 shrink-0 shadow-inner"><img src={l.src} className="w-full h-full object-cover" /></div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[11px] font-black truncate ${selectedLayerId===l.id ? 'text-white' : 'text-gray-500'}`}>{l.name}</p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.map(ly => ly.id === l.id ? { ...ly, visible: !ly.visible } : ly)); }}>{l.visible ? <Eye size={14} className="text-gray-400"/> : <EyeOff size={14} className="text-red-500"/>}</button>
                                                    <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.map(ly => ly.id === l.id ? { ...ly, locked: !ly.locked } : ly)); }}>{l.locked ? <Lock size={14} className="text-vingi-500"/> : <Lock size={14} className="text-gray-600"/>}</button>
                                                    <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.filter(ly => ly.id !== l.id)); if(selectedLayerId===l.id) setSelectedLayerId(null); }} className="hover:text-red-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. DOCK INFERIOR (CONTROLES) */}
                    <div className="bg-[#0a0a0a] border-t border-white/5 shrink-0 z-[100] pb-[env(safe-area-inset-bottom)] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.7)]">
                        
                        {/* SLIDERS DINÂMICOS */}
                        <div className="bg-[#111] px-10 py-5 flex flex-col md:flex-row items-center justify-between border-b border-white/5 gap-8">
                            <div className="flex items-center gap-8 flex-1 w-full max-w-6xl">
                                {tool === 'WAND' ? (
                                    <>
                                        <div className="flex bg-black/60 rounded-2xl p-1.5 border border-white/5 shrink-0 shadow-inner">
                                            <button onClick={() => setWandMode('ADD')} className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase transition-all ${wandMode==='ADD'?'bg-vingi-600 text-white shadow-xl':'text-gray-600 hover:text-gray-400'}`}><Plus size={16}/> Combinar</button>
                                            <button onClick={() => setWandMode('SUB')} className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase transition-all ${wandMode==='SUB'?'bg-red-600 text-white shadow-xl':'text-gray-600 hover:text-gray-400'}`}><Minus size={16}/> Subtrair</button>
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest"><span>Precisão SAM (Tolerância)</span><span>{wandTolerance}%</span></div>
                                            <input type="range" min="5" max="150" value={wandTolerance} onChange={e => setWandTolerance(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-vingi-500 cursor-pointer"/>
                                        </div>
                                        <div className="flex gap-3">
                                            {activeMask && <button onClick={() => setShowActionPanel(true)} className="px-6 py-3 bg-vingi-500 text-black rounded-2xl text-xs font-black uppercase flex items-center gap-2.5 shadow-[0_0_30px_rgba(59,130,246,0.6)] transition-all hover:scale-105 active:scale-95 animate-pulse"><Sparkle size={18}/> AÇÕES</button>}
                                            <button onClick={() => { setActiveMask(null); setMaskBounds(null); }} disabled={!activeMask} className="p-3 bg-white/5 rounded-2xl text-gray-500 hover:text-red-500 disabled:opacity-20 transition-colors border border-white/5"><XCircle size={24}/></button>
                                        </div>
                                    </>
                                ) : (tool === 'BRUSH' || tool === 'ERASER') ? (
                                    <>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest"><span>Diâmetro da Ponta ({tool==='BRUSH'?'Pincel':'Borracha'})</span><span>{brushSize}px</span></div>
                                            <input type="range" min="4" max="300" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-white cursor-pointer"/>
                                        </div>
                                        {selectedLayer?.locked && <div className="flex items-center gap-2.5 bg-red-900/30 border border-red-500/30 px-5 py-2.5 rounded-2xl animate-pulse"><ShieldCheck size={18} className="text-red-400"/><span className="text-[10px] font-black text-red-400 uppercase">Camada Protegida</span></div>}
                                    </>
                                ) : selectedLayer && (
                                    <div className="flex-1 grid grid-cols-2 gap-12">
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest"><span>Opacidade Camada</span><span>{Math.round((selectedLayer.opacity||1)*100)}%</span></div>
                                            <input type="range" min="0" max="1" step="0.05" value={selectedLayer.opacity||1} onChange={e => setLayers(ls => ls.map(ly => ly.id === selectedLayerId ? { ...ly, opacity: parseFloat(e.target.value) } : ly))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-white"/>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest"><span>Escala Absoluta</span><span>{Math.round(selectedLayer.scale*100)}%</span></div>
                                            <input type="range" min="0.05" max="5" step="0.05" value={selectedLayer.scale} onChange={e => setLayers(ls => ls.map(ly => ly.id === selectedLayerId ? { ...ly, scale: parseFloat(e.target.value) } : ly))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-white"/>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* TOOL DOCK PRINCIPAL */}
                        <div className="flex items-center justify-between px-8 py-3 overflow-x-auto no-scrollbar gap-2 max-w-[1400px] mx-auto w-full">
                            <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>initFromImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                            
                            <ToolBtn icon={Hand} label="Pan" active={tool==='HAND'} onClick={() => setTool('HAND')} />
                            <ToolBtn icon={Move} label="Mover" active={tool==='MOVE'} onClick={() => setTool('MOVE')} />
                            
                            <div className="w-px h-10 bg-white/5 mx-2"></div>
                            
                            <ToolBtn icon={Wand} label="SAM Wand" active={tool==='WAND'} onClick={() => setTool('WAND')} />
                            <ToolBtn icon={Brush} label="Pincel" active={tool==='BRUSH'} onClick={() => setTool('BRUSH')} />
                            <ToolBtn icon={Eraser} label="Borracha" active={tool==='ERASER'} onClick={() => setTool('ERASER')} />
                            
                            <div className="w-px h-10 bg-white/5 mx-2"></div>

                            <div className="hidden md:flex gap-2">
                                <button onClick={() => setLayers(ls => ls.map(ly => ly.id === selectedLayerId ? { ...ly, flipX: !ly.flipX } : ly))} className="p-3.5 bg-white/5 rounded-2xl text-gray-400 hover:text-white transition-all shadow-sm active:scale-90" title="Espelhar Horizontal"><FlipHorizontal size={22}/></button>
                                <button onClick={() => setLayers(ls => ls.map(ly => ly.id === selectedLayerId ? { ...ly, rotation: (ly.rotation + 90) % 360 } : ly))} className="p-3.5 bg-white/5 rounded-2xl text-gray-400 hover:text-white transition-all shadow-sm active:scale-90" title="Girar 90°"><RotateCw size={22}/></button>
                            </div>

                            <div className="w-px h-10 bg-white/5 mx-2"></div>
                            
                            <ToolBtn icon={Undo2} label="Undo" onClick={undo} disabled={history.length === 0} />
                            <ToolBtn icon={RefreshCcw} label="Nova Base" onClick={() => fileInputRef.current?.click()} />
                        </div>
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative mb-10">
                        <div className="absolute inset-0 bg-vingi-500 blur-[50px] opacity-20 animate-pulse rounded-full"></div>
                        <Loader2 size={64} className="text-vingi-400 animate-spin relative z-10" />
                    </div>
                    <p className="text-lg font-black uppercase tracking-[0.4em] text-white">Segmentando Geometria...</p>
                    <p className="text-[11px] text-gray-500 mt-3 font-mono">VINGI_NEURAL_RECOGNITION_PROCESSOR // V2.5</p>
                </div>
            )}
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center justify-center min-w-[80px] h-16 rounded-2xl gap-1.5 transition-all active:scale-90 ${disabled ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/5'} ${active ? 'bg-vingi-900/60 text-white border border-vingi-500/40 shadow-2xl shadow-vingi-900/50' : 'text-gray-500 hover:text-gray-300'}`}>
        <Icon size={24} strokeWidth={active ? 2.5 : 1.5} className={active ? 'drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]' : ''} /> 
        <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
    </button>
);
