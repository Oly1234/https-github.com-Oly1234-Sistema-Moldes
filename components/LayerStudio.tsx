
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layers, Move, Trash2, Eye, EyeOff, Lock, Hand, RotateCw, Minimize2, Minus, Plus, X, Brush, Focus, Loader2, RefreshCcw, PlusCircle, LayoutGrid, Sparkle, Wand, Send, Crosshair, Target, Zap, Merge, Eraser, Undo2 } from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleLandingPage } from './Shared';
import { VingiSegmenter, SegmentationResult } from '../services/segmentationEngine';

export const LayerStudio: React.FC<{ onNavigateBack?: () => void, onNavigateToMockup?: () => void }> = ({ onNavigateBack, onNavigateToMockup }) => {
    const [originalSrc, setOriginalSrc] = useState<string | null>(null);
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [history, setHistory] = useState<DesignLayer[][]>([]);
    const [canvasSize, setCanvasSize] = useState({ w: 1024, h: 1024 });
    const [showLayersPanel, setShowLayersPanel] = useState(true);
    
    // Tools UI
    const [tool, setTool] = useState<'MOVE' | 'WAND' | 'BRUSH' | 'ERASER' | 'HAND'>('WAND');
    const [wandTolerance, setWandTolerance] = useState(45);
    const [brushSize, setBrushSize] = useState(40);
    
    // UI State - Tactical Selection
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

    // Viewport
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
    const isPanning = useRef(false);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isDrawing = useRef(false);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

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
            setTool('WAND');
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setView({ x: 0, y: 0, k: Math.min(rect.width / img.width, rect.height / img.height) * 0.75 });
            }
        };
    };

    // --- MÁSCARA TÁTICA (GREEN OVERLAY) ---
    useEffect(() => {
        if (!overlayCanvasRef.current || !activeMask) {
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d')!;
                ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);
            }
            return;
        }
        const ctx = overlayCanvasRef.current.getContext('2d')!;
        ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);
        const imgData = ctx.createImageData(canvasSize.w, canvasSize.h);
        for (let i = 0; i < activeMask.length; i++) {
            if (activeMask[i] === 255) {
                const pos = i * 4;
                imgData.data[pos] = 0;     // R
                imgData.data[pos+1] = 255; // G (Verde de Seleção)
                imgData.data[pos+2] = 0;   // B
                imgData.data[pos+3] = 130; // Alpha
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }, [activeMask, canvasSize]);

    const handleMergeLayer = (layerId: string) => {
        const targetIdx = layers.findIndex(l => l.id === layerId);
        if (targetIdx <= 0) return;
        const layerToMerge = layers[targetIdx];
        const layerBelow = layers[targetIdx - 1];
        setIsProcessing(true);
        const canvas = document.createElement('canvas'); canvas.width = canvasSize.w; canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!;
        const imgBelow = new Image(); imgBelow.src = layerBelow.src;
        const imgTop = new Image(); imgTop.src = layerToMerge.src;
        let loaded = 0;
        const onImgLoad = () => {
            loaded++;
            if (loaded === 2) {
                ctx.save();
                ctx.translate(layerBelow.x, layerBelow.y);
                ctx.rotate((layerBelow.rotation * Math.PI) / 180);
                ctx.scale(layerBelow.flipX?-layerBelow.scale:layerBelow.scale, layerBelow.flipY?-layerBelow.scale:layerBelow.scale);
                ctx.drawImage(imgBelow, 0, 0);
                ctx.restore();
                ctx.save();
                ctx.translate(layerToMerge.x, layerToMerge.y);
                ctx.rotate((layerToMerge.rotation * Math.PI) / 180);
                ctx.scale(layerToMerge.flipX?-layerToMerge.scale:layerToMerge.scale, layerToMerge.flipY?-layerToMerge.scale:layerToMerge.scale);
                ctx.drawImage(imgTop, 0, 0);
                ctx.restore();
                const newLayers = layers.filter(l => l.id !== layerToMerge.id);
                newLayers[targetIdx - 1] = { ...layerBelow, src: canvas.toDataURL(), name: `${layerBelow.name} (Mesclada)` };
                saveHistory(newLayers);
                setSelectedLayerId(layerBelow.id);
                setIsProcessing(false);
            }
        };
        imgBelow.onload = onImgLoad; imgTop.onload = onImgLoad;
    };

    const executeIsolation = () => {
        if (!activeMask || !selectedLayerId) return;
        setIsProcessing(true);
        const target = layers.find(l => l.id === selectedLayerId)!;
        const canvas = document.createElement('canvas'); canvas.width = canvasSize.w; canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!;
        const img = new Image(); img.src = target.src; img.crossOrigin = "anonymous";
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pix = imgData.data;
            for (let i = 0; i < activeMask.length; i++) { if (activeMask[i] === 0) pix[i*4 + 3] = 0; }
            ctx.putImageData(imgData, 0, 0);
            const newId = 'LX-' + Date.now();
            const newLayer: DesignLayer = { 
                ...target, id: newId, name: `Objeto ${layers.length}`, src: canvas.toDataURL(), 
                zIndex: layers.length + 1, x: target.x, y: target.y, scale: target.scale 
            };
            saveHistory([...layers, newLayer]);
            setSelectedLayerId(newId);
            setActiveMask(null); setIsProcessing(false);
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
                const res = VingiSegmenter.segmentObject(tCtx, canvasSize.w, canvasSize.h, x - targetLayer.x, y - targetLayer.y, wandTolerance);
                
                if (res) {
                    if (activeMask) {
                        // SELEÇÃO CUMULATIVA: Soma a nova máscara à existente
                        setActiveMask(VingiSegmenter.mergeMasks(activeMask, res.mask));
                    } else {
                        setActiveMask(res.mask);
                    }
                }
            };
        } else if (tool !== 'HAND') { 
            isDrawing.current = true; 
        }
    };

    const getCanvasCoords = (clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const cx = rect.width / 2; const cy = rect.height / 2;
        const px = (clientX - rect.left - cx - view.x) / view.k + canvasSize.w / 2;
        const py = (clientY - rect.top - cy - view.y) / view.k + canvasSize.h / 2;
        return { x: px, y: py };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        setCursorPos({ x: e.clientX, y: e.clientY });
        if (isPanning.current && lastPointerPos.current) {
            const dx = e.clientX - lastPointerPos.current.x;
            const dy = e.clientY - lastPointerPos.current.y;
            setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
            lastPointerPos.current = { x: e.clientX, y: e.clientY }; return;
        }
        if (isDrawing.current && lastPointerPos.current && selectedLayerId) {
            if (tool === 'MOVE') {
                const dx = (e.clientX - lastPointerPos.current.x) / view.k;
                const dy = (e.clientY - lastPointerPos.current.y) / view.k;
                setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, x: l.x + dx, y: l.y + dy } : l));
            }
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden select-none font-sans relative">
            <div className="bg-[#111] h-14 border-b border-white/5 px-4 flex items-center justify-between shrink-0 z-[100]">
                <div className="flex items-center gap-2">
                    <div className="bg-vingi-900/50 p-1.5 rounded-lg border border-vingi-500/30 text-vingi-400"><Layers size={18}/></div>
                    <div><h2 className="text-xs font-bold uppercase tracking-widest leading-none">Layer Studio Pro</h2><p className="text-[9px] text-vingi-500 uppercase font-medium mt-1">SAM-X v3.2 // Continuous Selection</p></div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => originalSrc && initFromImage(originalSrc)} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-red-900/20 transition-all flex items-center gap-2"><RefreshCcw size={12}/> Reiniciar</button>
                    <button onClick={() => onNavigateToMockup && onNavigateToMockup()} className="text-[10px] bg-vingi-600 px-4 py-1.5 rounded-lg font-bold hover:bg-vingi-500 transition-all">Finalizar</button>
                </div>
            </div>

            {!layers.length ? (
                <div className="flex-1 bg-white">
                    <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>initFromImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                    <ModuleLandingPage icon={Layers} title="Lab de Imagem SAM-X" description="Isole elementos complexos com múltiplos cliques. Selecione as partes (Verde) e extraia para uma nova camada." primaryActionLabel="Iniciar Estúdio" onPrimaryAction={() => fileInputRef.current?.click()} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <div ref={containerRef} className={`flex-1 relative overflow-hidden flex items-center justify-center touch-none bg-[#050505] cursor-none`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => { if(isDrawing.current) saveHistory([...layers]); isDrawing.current = false; isPanning.current = false; }} onWheel={(e) => { if(e.ctrlKey || tool === 'HAND'){ e.preventDefault(); const s = Math.exp(-e.deltaY * 0.001); setView(v => ({ ...v, k: Math.min(Math.max(0.1, v.k * s), 10) })); } }}>
                        
                        {/* CUSTOM CURSOR PRECISION */}
                        <div className="fixed pointer-events-none z-[1000] mix-blend-difference flex items-center justify-center transition-transform duration-75" style={{ left: cursorPos.x, top: cursorPos.y, transform: 'translate(-50%, -50%)' }}>
                            {tool === 'HAND' ? <Hand size={24} className="text-white"/> : tool === 'MOVE' ? <Move size={24} className="text-white"/> : tool === 'WAND' ? <div className="relative"><Crosshair size={32} className="text-white animate-spin-slow opacity-80" strokeWidth={1}/><div className="absolute inset-0 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-vingi-400 rounded-full shadow-[0_0_10px_white]"></div></div></div> : <div className="rounded-full border-[1.5px] border-white bg-white/5" style={{ width: brushSize * view.k, height: brushSize * view.k }}><div className="absolute inset-0 flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full"></div></div></div>}
                        </div>

                        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        
                        <div className="relative shadow-2xl transition-transform duration-75 ease-out origin-center" style={{ width: canvasSize.w, height: canvasSize.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                            {layers.map(l => l.visible && (
                                <div key={l.id} className="absolute inset-0 pointer-events-none" style={{ transform: `translate(${l.x}px, ${l.y}px) rotate(${l.rotation}deg) scale(${l.flipX?-l.scale:l.scale}, ${l.flipY?-l.scale:l.scale})`, zIndex: l.zIndex, opacity: l.opacity ?? 1 }}>
                                    <img src={l.src} className={`w-full h-full object-contain ${selectedLayerId===l.id && tool!=='WAND' ? 'filter drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]' : ''}`} draggable={false} />
                                </div>
                            ))}
                            <canvas ref={overlayCanvasRef} width={canvasSize.w} height={canvasSize.h} className="absolute inset-0 pointer-events-none z-[55] opacity-80 mix-blend-screen animate-pulse" />
                        </div>

                        {/* HUD TÁTICO DE EXECUÇÃO (FLOATING DOCK - NÃO OBSTRUTIVO) */}
                        {activeMask && tool === 'WAND' && (
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
                                <div className="bg-black/90 backdrop-blur-2xl border border-white/10 px-6 py-4 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex items-center gap-6">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-black text-vingi-400 uppercase tracking-widest">SAM-X Target Locked</span>
                                        <span className="text-[10px] text-gray-400">Continue clicando para somar áreas.</span>
                                    </div>
                                    
                                    <div className="h-8 w-px bg-white/10 mx-2"></div>

                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => setActiveMask(null)}
                                            className="p-3 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-full transition-all border border-white/5 group"
                                            title="Limpar Seleção"
                                        >
                                            <X size={20} className="group-active:rotate-90 transition-transform" />
                                        </button>
                                        
                                        <button 
                                            onClick={executeIsolation}
                                            className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-[0_0_30px_rgba(220,38,38,0.4)] transition-all active:scale-95 group"
                                        >
                                            <Zap size={18} className="fill-white group-hover:animate-bounce" />
                                            Extrair Motivo
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PANEL CAMADAS */}
                        <div className={`absolute top-6 right-6 bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/5 flex flex-col transition-all duration-300 z-50 shadow-2xl rounded-[2rem] overflow-hidden ${showLayersPanel ? 'w-72 h-[calc(100%-160px)]' : 'w-14 h-14'}`}>
                            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#111]/50">
                                {showLayersPanel ? <><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Camadas</span><div className="flex gap-2"><button onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-white"><PlusCircle size={18}/></button><button onClick={() => setShowLayersPanel(false)} className="text-gray-500 hover:text-white"><Minimize2 size={18}/></button></div></> : <button onClick={() => setShowLayersPanel(true)} className="w-full h-full flex items-center justify-center text-vingi-400"><LayoutGrid size={24}/></button>}
                            </div>
                            {showLayersPanel && (
                                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
                                    {layers.slice().reverse().map((l, i) => (
                                        <div key={l.id} onClick={() => setSelectedLayerId(l.id)} className={`group p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${selectedLayerId===l.id ? 'bg-vingi-900/40 border-vingi-500/50 shadow-xl' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                                            <div className="w-14 h-14 bg-black rounded-xl overflow-hidden border border-white/10 shrink-0"><img src={l.src} className="w-full h-full object-cover" /></div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[11px] font-black truncate ${selectedLayerId===l.id ? 'text-white' : 'text-gray-500'}`}>{l.name}</p>
                                                <div className="flex items-center gap-2.5 mt-2">
                                                    <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.map(ly => ly.id === l.id ? { ...ly, visible: !ly.visible } : ly)); }}>{l.visible ? <Eye size={12}/> : <EyeOff size={12} className="text-red-500"/>}</button>
                                                    <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.map(ly => ly.id === l.id ? { ...ly, locked: !ly.locked } : ly)); }}>{l.locked ? <Lock size={12} className="text-vingi-500"/> : <Lock size={12} className="text-gray-600"/>}</button>
                                                    {i < layers.length - 1 && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleMergeLayer(l.id); }} className="text-gray-500 hover:text-vingi-400" title="Mesclar com camada abaixo"><Merge size={12}/></button>
                                                    )}
                                                    <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.filter(ly => ly.id !== l.id)); if(selectedLayerId===l.id) setSelectedLayerId(null); }} className="hover:text-red-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* DOCK INFERIOR */}
                    <div className="bg-[#0a0a0a] border-t border-white/5 shrink-0 z-[100] pb-[env(safe-area-inset-bottom)] flex flex-col shadow-2xl">
                        <div className="bg-[#111] px-10 py-5 border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="flex items-center gap-8 flex-1 w-full max-w-6xl">
                                {tool === 'WAND' ? (
                                    <>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest"><span>Precisão SAM-X (Tolerância)</span><span>{wandTolerance}%</span></div>
                                            <input type="range" min="5" max="150" value={wandTolerance} onChange={e => setWandTolerance(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-vingi-500 cursor-pointer"/>
                                        </div>
                                        <button onClick={() => { setActiveMask(null); }} className="p-3 bg-white/5 rounded-2xl text-gray-500 hover:text-red-500 transition-colors border border-white/5"><RefreshCcw size={20}/></button>
                                    </>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase tracking-widest gap-2 animate-pulse"><Focus size={14}/> {tool === 'MOVE' ? 'Posicione os elementos na tela.' : 'Use as ferramentas para refinar o design.'}</div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-8 py-3 overflow-x-auto gap-2 max-w-[1400px] mx-auto w-full">
                            <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>initFromImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                            <ToolBtn icon={Hand} label="Pan" active={tool==='HAND'} onClick={() => setTool('HAND')} />
                            <ToolBtn icon={Move} label="Mover" active={tool==='MOVE'} onClick={() => setTool('MOVE')} />
                            <div className="w-px h-10 bg-white/5 mx-2"></div>
                            <ToolBtn icon={Wand} label="SAM-X Wand" active={tool==='WAND'} onClick={() => setTool('WAND')} />
                            <ToolBtn icon={Brush} label="Pincel" active={tool==='BRUSH'} onClick={() => setTool('BRUSH')} />
                            <ToolBtn icon={Eraser} label="Borracha" active={tool==='ERASER'} onClick={() => setTool('ERASER')} />
                            <div className="w-px h-10 bg-white/5 mx-2"></div>
                            <ToolBtn icon={Undo2} label="Undo" onClick={undo} disabled={history.length === 0} />
                            <ToolBtn icon={RefreshCcw} label="Nova Base" onClick={() => fileInputRef.current?.click()} />
                        </div>
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative mb-10"><div className="absolute inset-0 bg-vingi-500 blur-[50px] opacity-20 animate-pulse rounded-full"></div><Loader2 size={64} className="text-vingi-400 animate-spin relative z-10" /></div>
                    <p className="text-lg font-black uppercase tracking-[0.4em] text-white">Segmentando Geometria...</p>
                </div>
            )}
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center justify-center min-w-[80px] h-16 rounded-2xl gap-1.5 transition-all active:scale-90 ${disabled ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/5'} ${active ? 'bg-vingi-900/60 text-white border border-vingi-500/40' : 'text-slate-500 hover:text-slate-300'}`}>
        <Icon size={24} strokeWidth={active ? 2.5 : 1.5} className={active ? 'drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]' : ''} /> 
        <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
    </button>
);
