import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Layers, Trash2, Eye, EyeOff, Lock, Hand, Wand2, Brush, 
    X, Check, Loader2, LayoutGrid, Sliders, Eraser, 
    Undo2, Redo2, Plus, Minus, Zap, Info, PenTool, ChevronUp, ChevronDown, MousePointer2,
    Activity, Brain, Crosshair, Target, MoreVertical, Copy, MoveDown, Edit2, FlipHorizontal2, FlipVertical2,
    GripVertical, FolderPlus, Link as LinkIcon
} from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleLandingPage } from './Shared';
import { LayerEnginePro, MaskSnapshot } from '../services/layerEnginePro';

export const LayerStudio: React.FC<{ onNavigateBack?: () => void, onNavigateToMockup?: () => void }> = ({ onNavigateBack, onNavigateToMockup }) => {
    // --- ESTADO CORE ---
    const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
    const [originalData, setOriginalData] = useState<Uint8ClampedArray | null>(null);
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
    
    // Ferramentas
    const [tool, setTool] = useState<'WAND' | 'LASSO' | 'BRUSH' | 'ERASER' | 'HAND'>('WAND');
    const [toolMode, setToolMode] = useState<'ADD' | 'SUB'>('ADD');
    const [wandParams, setWandParams] = useState({ tolerance: 45, contiguous: true });
    const [brushParams, setBrushParams] = useState({ size: 50, hardness: 80, opacity: 100, smart: true });
    
    // Máscara & Seleção
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [suggestedMask, setSuggestedMask] = useState<Uint8Array | null>(null);
    const [lassoPoints, setLassoPoints] = useState<{x: number, y: number}[]>([]);
    const [undoStack, setUndoStack] = useState<MaskSnapshot[]>([]);

    // Viewport & Zoom
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
    const [isMobile] = useState(window.innerWidth < 768);
    const [mobileLayersOpen, setMobileLayersOpen] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const cursorRef = useRef<HTMLCanvasElement>(null);
    const isInteracting = useRef(false);

    // --- SETUP ---
    const initStudio = (src: string) => {
        setIsProcessing(true);
        const img = new Image(); img.src = src;
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width; tempCanvas.height = img.height;
            const tCtx = tempCanvas.getContext('2d')!;
            tCtx.drawImage(img, 0, 0);
            setOriginalData(tCtx.getImageData(0, 0, img.width, img.height).data);
            setOriginalImg(img);
            setLayers([{ id: 'BG', type: 'BACKGROUND', name: 'Original', src, x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: false, zIndex: 0, opacity: 1 }]);
            setSelectedLayerId('BG');
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setView({ x: 0, y: 0, k: Math.min(rect.width/img.width, rect.height/img.height) * 0.85 });
            }
            setIsProcessing(false);
        };
    };

    const getPreciseCoords = (e: React.PointerEvent | PointerEvent) => {
        if (!containerRef.current || !originalImg) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2 - view.x) / view.k + originalImg.width / 2;
        const y = (e.clientY - rect.top - rect.height / 2 - view.y) / view.k + originalImg.height / 2;
        return { x, y };
    };

    const triggerUndo = useCallback(() => {
        if (undoStack.length === 0) return;
        const newStack = [...undoStack];
        const last = newStack.pop();
        if (last) { setActiveMask(last.data); setUndoStack(newStack); setSuggestedMask(null); }
    }, [undoStack]);

    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); triggerUndo(); }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedLayerId && selectedLayerId !== 'BG') {
                    setLayers(ls => ls.filter(l => l.id !== selectedLayerId));
                    setSelectedLayerId('BG');
                    return;
                }
            }
            const toolMap: any = { 'w': 'WAND', 'l': 'LASSO', 'b': 'BRUSH', 'e': 'ERASER', 'h': 'HAND' };
            if (toolMap[e.key]) setTool(toolMap[e.key]);
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [triggerUndo, selectedLayerId, activeMask]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!originalImg || !originalData) return;
        isInteracting.current = true;
        const { x, y } = getPreciseCoords(e);
        if (tool === 'WAND') {
            if (activeMask) setUndoStack(prev => LayerEnginePro.pushHistory(prev, activeMask));
            const canvas = document.createElement('canvas'); canvas.width = originalImg.width; canvas.height = originalImg.height;
            const ctx = canvas.getContext('2d')!; ctx.drawImage(originalImg, 0, 0);
            const { confirmed, suggested } = LayerEnginePro.magicWandPro(ctx, originalImg.width, originalImg.height, x, y, { ...wandParams, mode: toolMode, existingMask: activeMask || undefined });
            setActiveMask(confirmed); setSuggestedMask(suggested);
        } else if (tool === 'LASSO') {
            setLassoPoints([{x, y}]);
        } else if (tool === 'BRUSH' || tool === 'ERASER') {
            if (activeMask) setUndoStack(prev => LayerEnginePro.pushHistory(prev, activeMask));
            const m = tool === 'ERASER' ? 'SUB' : toolMode;
            setActiveMask(prev => LayerEnginePro.paintSmartMask(prev || new Uint8Array(originalImg.width * originalImg.height), originalData, originalImg.width, originalImg.height, x, y, { ...brushParams, mode: m, smartEnabled: brushParams.smart }));
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!originalImg || !originalData) return;
        const { x, y } = getPreciseCoords(e);
        setMousePos({ x, y });
        if (isInteracting.current) {
            if (tool === 'LASSO') {
                setLassoPoints(prev => [...prev, {x, y}]);
            } else if (tool === 'BRUSH' || tool === 'ERASER') {
                const m = tool === 'ERASER' ? 'SUB' : toolMode;
                setActiveMask(prev => LayerEnginePro.paintSmartMask(prev!, originalData, originalImg.width, originalImg.height, x, y, { ...brushParams, mode: m, smartEnabled: brushParams.smart }));
            } else if (tool === 'HAND' || e.buttons === 4) {
                setView(v => ({ ...v, x: v.x + e.movementX, y: v.y + e.movementY }));
            }
        }
    };

    const handlePointerUp = () => {
        if (!isInteracting.current || !originalImg) return;
        isInteracting.current = false;
        if (tool === 'LASSO' && lassoPoints.length > 3) {
            setIsProcessing(true);
            const lassoMask = LayerEnginePro.createPolygonMask(originalImg.width, originalImg.height, lassoPoints);
            const layerSrc = LayerEnginePro.extractLayer(originalImg, lassoMask, originalImg.width, originalImg.height);
            setLayers(ls => [...ls, { id: 'L'+Date.now(), type: 'ELEMENT', name: `Neural Cut ${ls.length}`, src: layerSrc, x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: false, zIndex: ls.length, opacity: 1 }]);
            setLassoPoints([]);
            setIsProcessing(false);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const delta = e.deltaY;
        const scaleChange = delta > 0 ? 0.9 : 1.1;
        const newK = Math.min(Math.max(0.1, view.k * scaleChange), 15);
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;
        const dx = (mouseX - view.x) * (newK / view.k - 1);
        const dy = (mouseY - view.y) * (newK / view.k - 1);
        setView(v => ({ x: v.x - dx, y: v.y - dy, k: newK }));
    };

    // --- MANIPULAÇÃO DE CAMADAS v10 ---
    const handleMergeDown = async (layerId: string) => {
        const index = layers.findIndex(l => l.id === layerId);
        if (index <= 1) return; 
        
        setIsProcessing(true);
        try {
            const topLayer = layers[index];
            const bottomLayer = layers[index - 1];

            const canvas = document.createElement('canvas');
            canvas.width = originalImg!.width; canvas.height = originalImg!.height;
            const ctx = canvas.getContext('2d')!;

            const loadImg = (src: string): Promise<HTMLImageElement> => new Promise((res, rej) => { 
                const i = new Image(); i.crossOrigin = "anonymous"; i.src = src; 
                i.onload = () => res(i); i.onerror = rej;
            });
            
            const [imgBottom, imgTop] = await Promise.all([loadImg(bottomLayer.src), loadImg(topLayer.src)]);

            ctx.drawImage(imgBottom, 0, 0);
            ctx.drawImage(imgTop, 0, 0);

            const mergedSrc = canvas.toDataURL('image/png');
            const newLayers = [...layers];
            newLayers[index - 1] = { ...bottomLayer, src: mergedSrc, name: `${bottomLayer.name} (Mesclada)` };
            newLayers.splice(index, 1);
            
            setLayers(newLayers);
            setSelectedLayerId(bottomLayer.id);
        } catch(e) {
            console.error("Merge error:", e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDuplicateLayer = (layerId: string) => {
        const layer = layers.find(l => l.id === layerId);
        if (!layer) return;
        const newLayer = { ...layer, id: 'L' + Date.now(), name: `${layer.name} (Cópia)`, zIndex: layers.length };
        setLayers(prev => [...prev, newLayer]);
    };

    const handleReorder = (draggedIdx: number, hoveredIdx: number) => {
        const newLayers = [...layers];
        const [movedItem] = newLayers.splice(draggedIdx, 1);
        newLayers.splice(hoveredIdx, 0, movedItem);
        setLayers(newLayers);
    };

    const handleRename = (id: string, newName: string) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, name: newName } : l));
        setEditingLayerId(null);
    };

    // --- RENDER MÁSCARA ---
    useEffect(() => {
        if (!overlayRef.current || !originalImg) return;
        const ctx = overlayRef.current.getContext('2d')!;
        ctx.clearRect(0, 0, originalImg.width, originalImg.height);
        if (activeMask) {
            const imgData = ctx.createImageData(originalImg.width, originalImg.height);
            for (let i = 0; i < activeMask.length; i++) {
                const pos = i * 4;
                if (activeMask[i] > 0) { imgData.data[pos] = 0; imgData.data[pos+1] = 130; imgData.data[pos+2] = 255; imgData.data[pos+3] = 230; }
                else if (suggestedMask && suggestedMask[i] > 0) { 
                    imgData.data[pos] = 255; imgData.data[pos+1] = toolMode === 'ADD' ? 40 : 120; imgData.data[pos+2] = 40; imgData.data[pos+3] = 170; 
                }
            }
            ctx.putImageData(imgData, 0, 0);
        }
    }, [activeMask, suggestedMask, originalImg, toolMode]);

    // --- RENDER CURSOR HUD ---
    useEffect(() => {
        if (!cursorRef.current || !originalImg) return;
        const ctx = cursorRef.current.getContext('2d')!;
        const { x, y } = mousePos;
        const k = view.k;
        ctx.clearRect(0, 0, originalImg.width, originalImg.height);
        if (tool === 'LASSO') {
            const isNearStart = lassoPoints.length > 5 && Math.sqrt((x - lassoPoints[0].x)**2 + (y - lassoPoints[0].y)**2) < 20 / k;
            ctx.strokeStyle = isNearStart ? '#22c55e' : '#ffffff'; ctx.lineWidth = 1.5 / k;
            ctx.beginPath(); ctx.arc(x, y, 2 / k, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.setLineDash([2/k, 4/k]); ctx.arc(x, y, 10 / k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
            if (lassoPoints.length > 0) {
                ctx.beginPath(); ctx.strokeStyle = isNearStart ? 'rgba(34,197,94,0.8)' : 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2 / k;
                ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
                lassoPoints.forEach(p => ctx.lineTo(p.x, p.y));
                if (isInteracting.current) { ctx.lineTo(x, y); ctx.setLineDash([5/k, 5/k]); ctx.lineTo(lassoPoints[0].x, lassoPoints[0].y); ctx.setLineDash([]); }
                ctx.stroke();
                if (isNearStart) { ctx.fillStyle = '#22c55e'; ctx.font = `${Math.round(12/k)}px Arial`; ctx.fillText("FECHAR CORTE", x + 15/k, y - 15/k); }
            }
        }
        if (tool === 'WAND') {
            const color = toolMode === 'ADD' ? '#3b82f6' : '#ef4444';
            ctx.strokeStyle = color; ctx.lineWidth = 1.5 / k;
            const size = 15 / k;
            ctx.beginPath(); ctx.moveTo(x - size, y); ctx.lineTo(x + size, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); ctx.stroke();
            ctx.beginPath(); ctx.arc(x, y, wandParams.tolerance / 4 / k + 10 / k, 0, Math.PI * 2); ctx.stroke();
            ctx.font = `${Math.round(10/k)}px Arial`; ctx.fillStyle = color;
            ctx.fillText(toolMode === 'ADD' ? '+' : '-', x + 15/k, y - 15/k);
        }
        if ((tool === 'BRUSH' || tool === 'ERASER') && x !== 0) {
            const color = tool === 'ERASER' ? '#ff3b3b' : '#3b82f6';
            ctx.beginPath(); ctx.arc(x, y, brushParams.size / 2, 0, Math.PI * 2);
            ctx.strokeStyle = color; ctx.lineWidth = 1.5 / k; ctx.stroke();
            if (brushParams.smart && tool === 'BRUSH') {
                ctx.beginPath(); ctx.arc(x, y, (brushParams.size / 2) * 1.1, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(59,130,246,0.3)'; ctx.lineWidth = 4 / k; ctx.stroke();
            }
            ctx.beginPath(); ctx.arc(x, y, (brushParams.size / 2) * (brushParams.hardness / 100), 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1 / k; ctx.stroke();
        }
    }, [mousePos, lassoPoints, tool, brushParams, wandParams, toolMode, view.k, originalImg, isInteracting.current]);

    const confirmExtraction = () => {
        if (!activeMask || !originalImg) return;
        setIsProcessing(true);
        const layerSrc = LayerEnginePro.extractLayer(originalImg, activeMask, originalImg.width, originalImg.height);
        setLayers([...layers, { id: 'L' + Date.now(), type: 'ELEMENT', name: `Neural Cut ${layers.length}`, src: layerSrc, x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: false, zIndex: layers.length, opacity: 1 }]);
        setActiveMask(null); setSuggestedMask(null); setIsProcessing(false);
    };

    return (
        <div className="flex flex-col h-full bg-[#010101] text-white overflow-hidden relative font-sans touch-none select-none">
            {/* HUD Top Bar */}
            <div className="h-14 bg-black/90 backdrop-blur border-b border-white/5 px-4 flex items-center justify-between z-[100] shadow-2xl shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-xl text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]"><Layers size={18}/></div>
                    <div className="hidden sm:block">
                        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-400 flex items-center gap-2">SAM Studio v10.0 <Brain size={12}/></h2>
                        <p className="text-[8px] text-gray-500 uppercase font-bold tracking-widest text-blue-300/40">Neural Engine • Fluid Composition</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={triggerUndo} disabled={undoStack.length === 0} className="p-2 bg-white/5 rounded-lg border border-white/10 disabled:opacity-20 hover:bg-white/10" title="Ctrl+Z"><Undo2 size={16}/></button>
                    <button onClick={() => onNavigateBack?.()} className="px-4 py-1.5 bg-white/5 rounded-lg text-[10px] font-black border border-white/10 uppercase tracking-widest hover:bg-white/10">Sair</button>
                    <button onClick={confirmExtraction} disabled={!activeMask} className="px-6 py-1.5 bg-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-[0_0_25px_rgba(59,130,246,0.6)] disabled:opacity-30 transition-all active:scale-95">Extrair</button>
                </div>
            </div>

            {!originalImg ? (
                <div className="flex-1 bg-white">
                    <input type="file" onChange={e => {const f=e.target.files?.[0]; if(f){const r=new FileReader(); r.onload=ev=>initStudio(ev.target?.result as string); r.readAsDataURL(f);}}} className="hidden" id="l-up" />
                    <ModuleLandingPage icon={Layers} title="Studio SAM-X" description="Segmentação Neural avançada v10. Reordene camadas, agrupe elementos e renomeie seus objetos com fluidez profissional." primaryActionLabel="Iniciar Segmentação" onPrimaryAction={() => document.getElementById('l-up')?.click()} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="bg-[#0a0a0a] border-b border-white/5 px-4 py-2 flex items-center gap-4 overflow-x-auto no-scrollbar z-50 shrink-0">
                        <div className="flex bg-black/60 rounded-xl p-1 border border-white/10 shrink-0">
                            <button onClick={() => setToolMode('ADD')} className={`px-4 py-2 rounded-lg text-[10px] font-black flex items-center gap-2 ${toolMode==='ADD' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}><Plus size={14}/> Somar</button>
                            <button onClick={() => setToolMode('SUB')} className={`px-4 py-2 rounded-lg text-[10px] font-black flex items-center gap-2 ${toolMode==='SUB' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500'}`}><Minus size={14}/> Retirar</button>
                        </div>
                        <div className="h-8 w-px bg-white/10 shrink-0"></div>
                        {(tool === 'BRUSH' || tool === 'ERASER') && (
                            <div className="flex items-center gap-6 shrink-0 animate-fade-in">
                                <button onClick={() => setBrushParams(p => ({...p, smart: !p.smart}))} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase flex items-center gap-2 transition-all ${brushParams.smart ? 'bg-blue-900/40 text-blue-400 border border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-white/5 text-gray-500 border border-transparent'}`}><Brain size={12}/> Pincel Inteligente: {brushParams.smart ? 'ON' : 'OFF'}</button>
                                <Slider label="Tamanho" value={brushParams.size} onChange={(v: number) => setBrushParams(p => ({...p, size: v}))} min={5} max={300} />
                            </div>
                        )}
                        {tool === 'WAND' && <Slider label="Tolerância Mira" value={wandParams.tolerance} onChange={(v: number) => setWandParams(p => ({...p, tolerance: v}))} min={1} max={180} />}
                    </div>
                    <div className="flex-1 flex overflow-hidden relative">
                        <div className="w-16 bg-black border-r border-white/5 flex flex-col items-center py-6 gap-5 z-50 shadow-2xl">
                            <ToolIcon icon={Hand} label="Mão" active={tool==='HAND'} onClick={() => setTool('HAND')} />
                            <div className="w-8 h-px bg-white/10"></div>
                            <ToolIcon icon={Wand2} label="Mira" active={tool==='WAND'} onClick={() => setTool('WAND')} />
                            <ToolIcon icon={PenTool} label="Laço" active={tool==='LASSO'} onClick={() => setTool('LASSO')} />
                            <ToolIcon icon={Brush} label="Pincel" active={tool==='BRUSH'} onClick={() => setTool('BRUSH')} />
                            <ToolIcon icon={Eraser} label="Borracha" active={tool==='ERASER'} onClick={() => setTool('ERASER')} />
                        </div>
                        <div ref={containerRef} className={`flex-1 relative flex items-center justify-center bg-[#050505] overflow-hidden cursor-none`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onWheel={handleWheel}>
                            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
                            <div className="relative shadow-[0_0_120px_rgba(0,0,0,1)] transition-transform duration-75 will-change-transform" style={{ width: originalImg.width, height: originalImg.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, imageRendering: 'pixelated' }}>
                                {layers.map(l => l.visible && ( <img key={l.id} src={l.src} className={`absolute inset-0 w-full h-full ${selectedLayerId===l.id ? 'filter drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] z-10' : ''}`} draggable={false} style={{ pointerEvents: 'none' }} /> ))}
                                <canvas ref={overlayRef} width={originalImg.width} height={originalImg.height} className="absolute inset-0 pointer-events-none z-[60]" />
                                <canvas ref={cursorRef} width={originalImg.width} height={originalImg.height} className="absolute inset-0 pointer-events-none z-[70] mix-blend-difference" />
                            </div>
                        </div>
                        {!isMobile && (
                            <div className="w-84 bg-[#050505] border-l border-white/5 flex-col z-50 flex shadow-2xl">
                                <LayerList 
                                    layers={layers} 
                                    selectedId={selectedLayerId} 
                                    onSelect={setSelectedLayerId} 
                                    onMergeDown={handleMergeDown}
                                    onDuplicate={handleDuplicateLayer}
                                    onReorder={handleReorder}
                                    onRename={handleRename}
                                    editingLayerId={editingLayerId}
                                    setEditingLayerId={setEditingLayerId}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
            {isProcessing && ( <div className="fixed inset-0 z-[500] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center animate-fade-in"><Brain size={60} className="text-blue-500 animate-pulse mb-4 shadow-[0_0_20px_rgba(59,130,246,0.5)]" /><p className="text-[10px] font-black uppercase tracking-[0.5em] text-white">Neural Processor v10.0 Active...</p></div> )}
        </div>
    );
};

const LayerList = ({ layers, selectedId, onSelect, onMergeDown, onDuplicate, onReorder, onRename, editingLayerId, setEditingLayerId }: any) => {
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const draggedIdx = useRef<number | null>(null);

    return (
        <div className="flex flex-col h-full relative">
            <div className="p-4 border-b border-white/5 flex items-center justify-between text-gray-500 uppercase text-[9px] font-black tracking-[0.2em] bg-black/40">
                <div className="flex items-center gap-2"><LayoutGrid size={12}/> Composição Fluida</div>
                <button className="p-1 hover:text-white transition-colors" title="Criar Grupo Virtual"><FolderPlus size={14}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {layers.slice().reverse().map((l: any, idx: number) => {
                    const realIdx = layers.length - 1 - idx;
                    const isEditing = editingLayerId === l.id;

                    return (
                        <div 
                            key={l.id} 
                            onClick={() => onSelect(l.id)} 
                            draggable={l.id !== 'BG'}
                            onDragStart={() => draggedIdx.current = realIdx}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                            onDrop={(e) => { 
                                e.preventDefault(); 
                                if (draggedIdx.current !== null && draggedIdx.current !== realIdx) {
                                    onReorder(draggedIdx.current, realIdx);
                                }
                                draggedIdx.current = null;
                            }}
                            className={`p-2.5 rounded-xl border transition-all flex items-center gap-3 cursor-pointer group relative ${selectedId===l.id ? 'bg-blue-600/15 border-blue-500/50 shadow-inner' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                        >
                            <div className="text-gray-600 group-hover:text-gray-400 transition-colors">
                                <GripVertical size={14}/>
                            </div>
                            
                            <div className="w-11 h-11 bg-black rounded-lg border border-white/10 overflow-hidden flex items-center justify-center p-0.5 relative shadow-inner shrink-0">
                                <img src={l.src} className="max-w-full max-h-full object-contain" />
                                {!l.visible && <div className="absolute inset-0 bg-red-950/50 backdrop-blur-[1px] flex items-center justify-center"><EyeOff size={14} className="text-white"/></div>}
                            </div>
                            
                            <div className="flex-1 min-w-0" onDoubleClick={() => setEditingLayerId(l.id)}>
                                {isEditing ? (
                                    <input 
                                        autoFocus
                                        className="w-full bg-blue-900/30 border border-blue-500/50 rounded px-1 text-[10px] font-bold text-white outline-none"
                                        defaultValue={l.name}
                                        /* FIX: Calling correct prop name onRename instead of handleRename */
                                        onBlur={(e) => onRename(l.id, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') onRename(l.id, e.currentTarget.value);
                                            if (e.key === 'Escape') setEditingLayerId(null);
                                        }}
                                    />
                                ) : (
                                    <>
                                        <p className={`text-[10px] font-bold truncate uppercase tracking-tight ${l.visible ? 'text-gray-200' : 'text-gray-600'}`}>{l.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <button onClick={(e) => { e.stopPropagation(); }} className={l.visible ? 'text-blue-400' : 'text-gray-600'} title="Visibilidade"><Eye size={12}/></button>
                                            {l.id === 'BG' && <Lock size={10} className="text-gray-600"/>}
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            <button 
                                onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === l.id ? null : l.id); }}
                                className="p-1 text-gray-500 hover:text-white rounded-md hover:bg-white/10"
                            >
                                <MoreVertical size={16}/>
                            </button>

                            {menuOpenId === l.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-[#151515] border border-white/10 rounded-xl shadow-2xl z-[200] overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
                                    <div className="p-1 flex flex-col">
                                        <button onClick={(e) => { e.stopPropagation(); onDuplicate(l.id); setMenuOpenId(null); }} className="flex items-center gap-3 px-3 py-2 text-[10px] font-bold text-gray-300 hover:bg-blue-600 hover:text-white rounded-lg transition-colors">
                                            <Copy size={14}/> Duplicar
                                        </button>
                                        {realIdx > 0 && (
                                            <button onClick={(e) => { e.stopPropagation(); onMergeDown(l.id); setMenuOpenId(null); }} className="flex items-center gap-3 px-3 py-2 text-[10px] font-bold text-gray-300 hover:bg-blue-600 hover:text-white rounded-lg transition-colors">
                                                <MoveDown size={14}/> Mesclar para Baixo
                                            </button>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); onRename(l.id, l.name); setMenuOpenId(null); setEditingLayerId(l.id); }} className="flex items-center gap-3 px-3 py-2 text-[10px] font-bold text-gray-300 hover:bg-blue-600 hover:text-white rounded-lg transition-colors">
                                            <Edit2 size={14}/> Renomear
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); }} className="flex items-center gap-3 px-3 py-2 text-[10px] font-bold text-gray-300 hover:bg-blue-600 hover:text-white rounded-lg transition-colors">
                                            <LinkIcon size={14}/> Agrupar Elementos
                                        </button>
                                        <div className="h-px bg-white/5 my-1"></div>
                                        <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); }} className="flex items-center gap-3 px-3 py-2 text-[10px] font-bold text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition-colors">
                                            <Trash2 size={14}/> Excluir
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {menuOpenId && <div className="fixed inset-0 z-[150]" onClick={() => setMenuOpenId(null)} />}
        </div>
    );
};

const ToolIcon = ({ icon: Icon, label, active, onClick }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all active:scale-90 relative ${active ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
        <span className={`text-[7px] mt-1 uppercase font-black tracking-tighter ${active ? 'text-white' : 'text-gray-600'}`}>{label}</span>
        {active && <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-400 rounded-full"></div>}
    </button>
);

const Slider = ({ label, value, onChange, min, max }: any) => (
    <div className="flex flex-col gap-1.5 min-w-[140px]">
        <div className="flex justify-between items-center text-[9px] font-black text-gray-500 uppercase tracking-widest">
            <span>{label}</span>
            <span className="font-mono text-blue-400">{value}</span>
        </div>
        <input type="range" min={min} max={max} value={value} onChange={e => onChange(parseInt(e.target.value))} className="w-full h-1 bg-gray-800 rounded-full appearance-none accent-blue-500 cursor-pointer shadow-inner" />
    </div>
);