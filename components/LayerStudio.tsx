
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
    Layers, Trash2, Eye, EyeOff, Lock, Hand, Wand2, Brush, 
    X, Check, Loader2, LayoutGrid, Sliders, Eraser, 
    Undo2, Redo2, Plus, Minus, Zap, Info, PenTool, ChevronUp, ChevronDown, MousePointer2,
    Activity, Brain, Crosshair, Target, MoreVertical, MoreHorizontal, Copy, MoveDown, Edit2, FlipHorizontal2, FlipVertical2,
    GripVertical, FolderPlus, Link as LinkIcon, Folder, ChevronRight, FolderOpen, Combine, Ungroup, LogOut,
    PlusCircle, Maximize2, MousePointerClick, Settings, Save, ArrowLeft, SlidersHorizontal, Shirt, PlusSquare,
    SearchCode, MessageSquare, Sparkles, BrainCircuit, MinusCircle, ArrowUp, ArrowDown
} from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleLandingPage } from './Shared';
import { LayerEnginePro, MaskSnapshot } from '../services/layerEnginePro';

interface StudioLayer extends DesignLayer {
    parentId?: string;
    isGroup?: boolean;
    expanded?: boolean;
}

const compressForAI = (img: HTMLImageElement, maxSize = 1024): Promise<string> => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        if (width > maxSize || height > maxSize) {
            if (width > height) {
                height = Math.round((height * maxSize) / width);
                width = maxSize;
            } else {
                width = Math.round((width * maxSize) / height);
                height = maxSize;
            }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
    });
};

export const LayerStudio: React.FC<{ onNavigateBack?: () => void, onNavigateToMockup?: () => void }> = ({ onNavigateBack, onNavigateToMockup }) => {
    const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
    const [originalData, setOriginalData] = useState<Uint8ClampedArray | null>(null);
    const [layers, setLayers] = useState<StudioLayer[]>([]);
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
    const [mobileMenuLayerId, setMobileMenuLayerId] = useState<string | null>(null);
    
    const [tool, setTool] = useState<'WAND' | 'LASSO' | 'BRUSH' | 'ERASER' | 'HAND'>('BRUSH');
    const [toolMode, setToolMode] = useState<'ADD' | 'SUB'>('ADD');
    const [wandParams, setWandParams] = useState({ tolerance: 45, contiguous: true });
    const [brushParams, setBrushParams] = useState({ size: 50, eraserSize: 50, hardness: 80, opacity: 100, smart: true });
    
    const [isSemanticLoading, setIsSemanticLoading] = useState(false);
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [suggestedMask, setSuggestedMask] = useState<Uint8Array | null>(null);
    const [lassoPoints, setLassoPoints] = useState<{x: number, y: number}[]>([]);
    const [undoStack, setUndoStack] = useState<MaskSnapshot[]>([]);

    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const cursorRef = useRef<HTMLCanvasElement>(null);
    const isInteracting = useRef(false);
    const lastPointerPos = useRef({ x: 0, y: 0 });

    const fitImageToContainer = useCallback(() => {
        if (!containerRef.current || !originalImg) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const padding = isMobile ? 30 : 80;
        const k = Math.min((rect.width - padding) / originalImg.naturalWidth, (rect.height - padding) / originalImg.naturalHeight);
        setView({ x: 0, y: 0, k: k || 0.8 });
    }, [originalImg, isMobile]);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(() => {
            setIsMobile(window.innerWidth < 768);
            requestAnimationFrame(fitImageToContainer);
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [fitImageToContainer]);

    const initStudio = (src: string) => {
        setIsProcessing(true);
        const img = new Image();
        img.src = src;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth; 
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            setOriginalData(ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data);
            setOriginalImg(img);
            setLayers([{ id: 'BG', type: 'BACKGROUND', name: 'Base', src, x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: true, zIndex: 0, opacity: 1 }]);
            setSelectedLayerIds(['BG']);
            setIsProcessing(false);
        };
    };

    const getPreciseCoords = (e: React.PointerEvent | PointerEvent) => {
        if (!containerRef.current || !originalImg) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const x = (e.clientX - centerX - view.x) / view.k + originalImg.naturalWidth / 2;
        const y = (e.clientY - centerY - view.y) / view.k + originalImg.naturalHeight / 2;
        return { x, y };
    };

    const handleSemanticIdentification = async () => {
        if (!originalImg || !activeMask) return;
        setIsSemanticLoading(true);
        try {
            let minX = originalImg.naturalWidth, maxX = 0, minY = originalImg.naturalHeight, maxY = 0;
            let hasPixels = false;
            for (let i = 0; i < activeMask.length; i++) {
                if (activeMask[i] > 0) {
                    const x = i % originalImg.naturalWidth;
                    const y = (i / originalImg.naturalWidth) | 0;
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                    hasPixels = true;
                }
            }
            if (!hasPixels) { setIsSemanticLoading(false); return; }
            const compressedDataUrl = await compressForAI(originalImg);
            const contextData = { bbox: { xmin: (minX / originalImg.naturalWidth) * 1000, xmax: (maxX / originalImg.naturalWidth) * 1000, ymin: (minY / originalImg.naturalHeight) * 1000, ymax: (maxY / originalImg.naturalHeight) * 1000 } };
            const res = await fetch('/api/layer-studio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'SEMANTIC_SEGMENTATION', imageBase64: compressedDataUrl.split(',')[1], contextData }) });
            const data = await res.json();
            if (data.bbox) {
                const { ymin, xmin, ymax, xmax } = data.bbox;
                const canvas = document.createElement('canvas');
                canvas.width = originalImg.naturalWidth; canvas.height = originalImg.naturalHeight;
                const ctx = canvas.getContext('2d')!; ctx.drawImage(originalImg, 0, 0);
                const focalX = (xmin + xmax) / 2 * originalImg.naturalWidth / 1000;
                const focalY = (ymin + ymax) / 2 * originalImg.naturalHeight / 1000;
                const { suggested } = LayerEnginePro.magicWandPro(ctx, originalImg.naturalWidth, originalImg.naturalHeight, focalX, focalY, { tolerance: 75, contiguous: false, mode: 'ADD' });
                const w = originalImg.naturalWidth;
                for(let i=0; i < suggested.length; i++) {
                    if (suggested[i] === 0) continue;
                    const ix = i % w, iy = (i / w) | 0;
                    const nx = (ix / w) * 1000, ny = (iy / originalImg.naturalHeight) * 1000;
                    if (nx < xmin || nx > xmax || ny < ymin || ny > ymax) suggested[i] = 0;
                }
                setActiveMask(LayerEnginePro.mergeMasks(activeMask, suggested));
            }
        } catch (e) { console.error(e); } finally { setIsSemanticLoading(false); }
    };

    const confirmExtraction = () => {
        if (!activeMask || !originalImg) return;
        setIsProcessing(true);
        const finalMask = suggestedMask ? LayerEnginePro.mergeMasks(activeMask, suggestedMask) : activeMask;
        const layerSrc = LayerEnginePro.extractLayer(originalImg, finalMask, originalImg.naturalWidth, originalImg.naturalHeight);
        const newId = 'L' + Date.now();
        setLayers(ls => [...ls, { id: newId, type: 'ELEMENT', name: `Recorte ${ls.length}`, src: layerSrc, x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: false, zIndex: ls.length, opacity: 1 }]);
        setActiveMask(null); setSuggestedMask(null); setIsProcessing(false); setSelectedLayerIds([newId]);
    };

    const reorderLayer = (id: string, direction: 'UP' | 'DOWN') => {
        setLayers(ls => {
            const index = ls.findIndex(l => l.id === id);
            if (index === -1) return ls;
            const newIndex = direction === 'UP' ? index + 1 : index - 1;
            if (newIndex < 0 || newIndex >= ls.length) return ls;
            if (ls[index].id === 'BG' || (newIndex === 0 && ls[index].id !== 'BG')) return ls;
            const newLayers = [...ls];
            const [moved] = newLayers.splice(index, 1);
            newLayers.splice(newIndex, 0, moved);
            return newLayers;
        });
    };

    const toggleVisibility = (id: string) => {
        setLayers(ls => ls.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!originalImg || !originalData) return;
        isInteracting.current = true;
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
        const { x, y } = getPreciseCoords(e);
        
        if (tool === 'WAND') {
            if (activeMask) setUndoStack(prev => LayerEnginePro.pushHistory(prev, activeMask));
            const canvas = document.createElement('canvas'); 
            canvas.width = originalImg.naturalWidth; canvas.height = originalImg.naturalHeight;
            const ctx = canvas.getContext('2d')!; ctx.drawImage(originalImg, 0, 0);
            const { confirmed, suggested } = LayerEnginePro.magicWandPro(ctx, originalImg.naturalWidth, originalImg.naturalHeight, x, y, { ...wandParams, mode: toolMode, existingMask: activeMask || undefined });
            setActiveMask(confirmed); setSuggestedMask(suggested);
        } else if (tool === 'LASSO') {
            setLassoPoints([{x, y}]);
        } else if (tool === 'BRUSH' || tool === 'ERASER') {
            if (activeMask) setUndoStack(prev => LayerEnginePro.pushHistory(prev, activeMask));
            const m = tool === 'ERASER' ? 'SUB' : toolMode;
            const currentSize = tool === 'ERASER' ? brushParams.eraserSize : brushParams.size;
            setActiveMask(prev => LayerEnginePro.paintSmartMask(prev || new Uint8Array(originalImg.naturalWidth * originalImg.naturalHeight), originalData, originalImg.naturalWidth, originalImg.naturalHeight, x, y, { ...brushParams, size: currentSize, mode: m, smartEnabled: brushParams.smart }));
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!originalImg || !originalData) return;
        const { x, y } = getPreciseCoords(e);
        setMousePos({ x, y });
        if (isInteracting.current) {
            if (tool === 'LASSO') setLassoPoints(prev => [...prev, {x, y}]);
            else if (tool === 'BRUSH' || tool === 'ERASER') {
                const m = tool === 'ERASER' ? 'SUB' : toolMode;
                const currentSize = tool === 'ERASER' ? brushParams.eraserSize : brushParams.size;
                setActiveMask(prev => LayerEnginePro.paintSmartMask(prev!, originalData, originalImg.naturalWidth, originalImg.naturalHeight, x, y, { ...brushParams, size: currentSize, mode: m, smartEnabled: brushParams.smart }));
            } else if (tool === 'HAND' || (e.buttons === 4)) {
                const dx = e.clientX - lastPointerPos.current.x, dy = e.clientY - lastPointerPos.current.y;
                setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
            }
        }
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = () => {
        if (!isInteracting.current || !originalImg) return;
        isInteracting.current = false;
        if (tool === 'LASSO' && lassoPoints.length > 3) {
            const currentMask = activeMask || new Uint8Array(originalImg.naturalWidth * originalImg.naturalHeight);
            if (activeMask) setUndoStack(prev => LayerEnginePro.pushHistory(prev, activeMask));
            
            // INTELIGÊNCIA DE INTENÇÃO: Decide automaticamente se adiciona ou remove
            const intent = LayerEnginePro.detectLassoIntent(currentMask, originalImg.naturalWidth, originalImg.naturalHeight, lassoPoints);
            const nextMask = LayerEnginePro.createPolygonMask(originalImg.naturalWidth, originalImg.naturalHeight, lassoPoints, intent, currentMask);
            
            setActiveMask(nextMask);
            setLassoPoints([]);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const scaleChange = e.deltaY > 0 ? 0.9 : 1.1;
        const newK = Math.min(Math.max(0.05, view.k * scaleChange), 20);
        const mouseX = e.clientX - rect.left - rect.width / 2, mouseY = e.clientY - rect.top - rect.height / 2;
        const dx = (mouseX - view.x) * (newK / view.k - 1), dy = (mouseY - view.y) * (newK / view.k - 1);
        setView(v => ({ x: v.x - dx, y: v.y - dy, k: newK }));
    };

    useEffect(() => {
        if (!overlayRef.current || !originalImg) return;
        const ctx = overlayRef.current.getContext('2d')!;
        ctx.clearRect(0, 0, originalImg.naturalWidth, originalImg.naturalHeight);
        if (activeMask || suggestedMask) {
            const imgData = ctx.createImageData(originalImg.naturalWidth, originalImg.naturalHeight);
            for (let i = 0; i < (originalImg.naturalWidth * originalImg.naturalHeight); i++) {
                const pos = i * 4;
                if (activeMask && activeMask[i] > 0) { imgData.data[pos] = 0; imgData.data[pos+1] = 130; imgData.data[pos+2] = 255; imgData.data[pos+3] = 200; } 
                else if (suggestedMask && suggestedMask[i] > 0) { imgData.data[pos] = 255; imgData.data[pos+1] = 40; imgData.data[pos+2] = 40; imgData.data[pos+3] = 180; }
            }
            ctx.putImageData(imgData, 0, 0);
        }
    }, [activeMask, suggestedMask, originalImg]);

    useEffect(() => {
        if (!cursorRef.current || !originalImg) return;
        const ctx = cursorRef.current.getContext('2d')!;
        const { x, y } = mousePos, k = view.k;
        ctx.clearRect(0, 0, originalImg.naturalWidth, originalImg.naturalHeight);
        
        // MIRA DE PRECISÃO TELESCÓPICA PARA O LAÇO
        if (tool === 'LASSO') {
            // Rastro do Laço (Marching Ants Neon)
            if (lassoPoints.length > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3/k;
                ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
                lassoPoints.forEach(p => ctx.lineTo(p.x, p.y));
                if (isInteracting.current) ctx.lineTo(x, y);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.setLineDash([5/k, 5/k]);
                ctx.lineDashOffset = -Date.now() / 50; // Animação
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2.5/k;
                ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
                lassoPoints.forEach(p => ctx.lineTo(p.x, p.y));
                if (isInteracting.current) ctx.lineTo(x, y);
                ctx.stroke();
                ctx.restore();
            }

            // Cursor Mira Telescópica (Alta Visibilidade)
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1.5/k;
            ctx.arc(x, y, 10/k, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2/k;
            ctx.moveTo(x - 15/k, y); ctx.lineTo(x - 5/k, y);
            ctx.moveTo(x + 15/k, y); ctx.lineTo(x + 5/k, y);
            ctx.moveTo(x, y - 15/k); ctx.lineTo(x, y - 5/k);
            ctx.moveTo(x, y + 15/k); ctx.lineTo(x, y + 5/k);
            ctx.stroke();
            
            // Ponto central de foco
            ctx.beginPath();
            ctx.fillStyle = '#fff';
            ctx.arc(x, y, 2/k, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        if (tool === 'WAND') {
            ctx.strokeStyle = toolMode === 'ADD' ? '#3b82f6' : '#ef4444'; ctx.lineWidth = 2 / k;
            const s = 15 / k; ctx.beginPath(); ctx.moveTo(x-s, y); ctx.lineTo(x+s, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y-s); ctx.lineTo(x, y+s); ctx.stroke();
        }
        if (tool === 'BRUSH' || tool === 'ERASER') {
            const currentSize = tool === 'ERASER' ? brushParams.eraserSize : brushParams.size;
            ctx.beginPath(); ctx.arc(x, y, currentSize/2, 0, Math.PI * 2); ctx.strokeStyle = tool === 'ERASER' ? '#ef4444' : '#3b82f6'; ctx.lineWidth = 2/k; ctx.stroke();
        }
    }, [mousePos, lassoPoints, tool, brushParams, toolMode, view.k, originalImg, isInteracting.current]);

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden relative font-sans touch-none select-none">
            <div className="h-14 bg-black border-b border-white/5 px-4 flex items-center justify-between z-[100] shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => onNavigateBack?.()} className="p-2 -ml-2 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 leading-none">VINGI STUDIO</span>
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">Nexus Pro v10.9</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { if(undoStack.length>0) { const last=undoStack[undoStack.length-1]; setActiveMask(last.data); setUndoStack(undoStack.slice(0,-1)); }}} disabled={undoStack.length===0} className="p-2 text-gray-500 disabled:opacity-20"><Undo2 size={18}/></button>
                    <button onClick={confirmExtraction} disabled={!activeMask} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${activeMask ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-white/5 text-gray-700'}`}>Extrair</button>
                </div>
            </div>

            {!originalImg ? (
                <div className="flex-1 bg-white">
                    <input type="file" onChange={e => {const f=e.target.files?.[0]; if(f){const r=new FileReader(); r.onload=ev=>initStudio(ev.target?.result as string); r.readAsDataURL(f);}}} className="hidden" id="l-up" />
                    <ModuleLandingPage icon={Layers} title="Layer Studio" description="Motor neural SAM-X v10.9. Gestão profissional de camadas com controle de empilhamento." primaryActionLabel="Selecionar Foto" onPrimaryAction={() => document.getElementById('l-up')?.click()} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <div ref={containerRef} className="flex-1 relative bg-[#050505] overflow-hidden cursor-none touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onWheel={handleWheel}>
                        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        <div 
                            className="absolute shadow-[0_0_80px_rgba(0,0,0,1)] transition-transform duration-75 will-change-transform" 
                            style={{ 
                                width: originalImg.naturalWidth, height: originalImg.naturalHeight, left: '50%', top: '50%',
                                marginLeft: -originalImg.naturalWidth / 2, marginTop: -originalImg.naturalHeight / 2,
                                transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: 'center center'
                            }}
                        >
                            {layers.map(l => ( <img key={l.id} src={l.src} className={`absolute inset-0 w-full h-full pointer-events-none ${selectedLayerIds.includes(l.id) ? 'filter drop-shadow-[0_0_10px_rgba(59,130,246,0.4)] z-10' : ''}`} draggable={false} style={{ objectFit: 'contain', display: l.visible ? 'block' : 'none', opacity: l.opacity ?? 1 }} /> ))}
                            <canvas ref={overlayRef} width={originalImg.naturalWidth} height={originalImg.naturalHeight} className="absolute inset-0 pointer-events-none z-[60]" />
                            <canvas ref={cursorRef} width={originalImg.naturalWidth} height={originalImg.naturalHeight} className="absolute inset-0 pointer-events-none z-[70] mix-blend-difference" />
                        </div>
                        
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-[200] pointer-events-none">
                            {tool === 'BRUSH' && activeMask && !isSemanticLoading && (
                                <button onClick={handleSemanticIdentification} className="pointer-events-auto bg-blue-600 text-white px-6 py-3 rounded-full font-black text-[10px] shadow-[0_0_30px_rgba(59,130,246,0.8)] animate-bounce-subtle flex items-center gap-2 border-2 border-white/20 active:scale-95 transition-transform uppercase tracking-widest">
                                    <BrainCircuit size={16}/> Localizar Elemento
                                </button>
                            )}
                            {isSemanticLoading && (
                                <div className="bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full font-black text-[10px] border border-blue-500/50 flex items-center gap-3 uppercase tracking-widest">
                                    <Loader2 size={16} className="animate-spin text-blue-400"/> Identificando...
                                </div>
                            )}
                        </div>
                    </div>

                    {isMobile ? (
                        <div className="bg-[#0a0a0a] border-t border-white/10 z-[150] shadow-2xl safe-area-bottom flex flex-col shrink-0">
                            <div className="h-20 px-4 py-2 flex items-center gap-4 overflow-x-auto no-scrollbar border-b border-white/5 bg-black">
                                <button onClick={() => document.getElementById('l-up')?.click()} className="min-w-[48px] h-[48px] rounded-xl bg-white/5 border border-dashed border-white/20 flex flex-col items-center justify-center text-gray-500 shrink-0"><PlusSquare size={18}/><span className="text-[7px] mt-1 uppercase font-bold">Novo</span></button>
                                {[...layers].reverse().map(l => (
                                    <div 
                                        key={l.id} 
                                        onClick={() => setSelectedLayerIds([l.id])}
                                        onContextMenu={(e) => { e.preventDefault(); setMobileMenuLayerId(l.id); }}
                                        className={`min-w-[48px] h-[48px] rounded-xl border-2 transition-all relative bg-black shrink-0 flex flex-col items-center ${selectedLayerIds.includes(l.id) ? 'border-blue-500 scale-105 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'border-white/10 opacity-60'}`}
                                    >
                                        <div className="w-full h-full rounded-lg overflow-hidden relative">
                                            <img src={l.src} className="w-full h-full object-contain" />
                                            {!l.visible && <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center backdrop-blur-[1px]"><EyeOff size={12}/></div>}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); toggleVisibility(l.id); }} 
                                                className={`absolute top-0 right-0 p-0.5 rounded-bl-lg backdrop-blur-md ${l.visible ? 'bg-blue-500/80' : 'bg-red-500/80'}`}
                                            >
                                                {l.visible ? <Eye size={10}/> : <EyeOff size={10}/>}
                                            </button>
                                        </div>
                                        <span className="absolute -bottom-5 text-[8px] font-black uppercase text-gray-400 truncate w-full text-center tracking-tighter">{l.name}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="h-14 px-4 flex items-center justify-between gap-4 border-b border-white/5 bg-[#0a0a0a]">
                                {(tool === 'BRUSH' || tool === 'ERASER') && (
                                    <div className="flex items-center gap-4 w-full">
                                        <div className="flex-1"><MobileSlider icon={tool==='ERASER'?Eraser:Brush} value={tool==='ERASER'?brushParams.eraserSize:brushParams.size} onChange={v => setBrushParams(p=>({...p, [tool==='ERASER'?'eraserSize':'size']:v}))} min={5} max={400} /></div>
                                        <button onClick={() => setBrushParams(p=>({...p, smart:!p.smart}))} className={`h-8 px-2.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 border transition-all ${brushParams.smart ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-transparent text-gray-500'}`}><Brain size={12}/> Neural</button>
                                    </div>
                                )}
                                {tool === 'WAND' && (
                                    <div className="w-full flex items-center gap-4">
                                        <div className="flex-1"><MobileSlider icon={Target} value={wandParams.tolerance} onChange={v => setWandParams(p=>({...p, tolerance:v}))} min={1} max={180} /></div>
                                        <button onClick={() => setWandParams(p=>({...p, contiguous:!p.contiguous}))} className={`h-8 px-2.5 rounded-lg text-[9px] font-black uppercase border transition-all ${wandParams.contiguous ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-transparent text-gray-500'}`}>Contínuo</button>
                                    </div>
                                )}
                                {tool === 'HAND' && (
                                    <div className="w-full flex justify-center"><button onClick={fitImageToContainer} className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-black text-gray-300 flex items-center gap-2 uppercase tracking-widest border border-white/5"><Maximize2 size={12}/> Centralizar Imagem</button></div>
                                )}
                                {tool === 'LASSO' && (
                                    <div className="w-full text-center"><span className="text-[10px] font-black uppercase tracking-widest text-blue-400 animate-pulse">Laço Inteligente: Envolva a área</span></div>
                                )}
                            </div>

                            <div className="h-20 flex items-center justify-around px-2 bg-black">
                                <ToolBtn icon={Hand} label="Pan" active={tool==='HAND'} onClick={() => setTool('HAND')} />
                                <ToolBtn icon={Wand2} label="Mira" active={tool==='WAND'} onClick={() => setTool('WAND')} />
                                <ToolBtn icon={Brush} label="Pincel" active={tool==='BRUSH'} onClick={() => setTool('BRUSH')} />
                                <ToolBtn icon={Eraser} label="Apagar" active={tool==='ERASER'} onClick={() => setTool('ERASER')} />
                                <ToolBtn icon={PenTool} label="Laço" active={tool==='LASSO'} onClick={() => setTool('LASSO')} />
                                <div className="w-px h-8 bg-white/10 mx-1"></div>
                                <div className="flex bg-white/5 rounded-xl p-0.5 border border-white/10 shrink-0">
                                    <button onClick={() => setToolMode('ADD')} className={`p-2.5 rounded-lg transition-all ${toolMode==='ADD' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600'}`}><Plus size={16}/></button>
                                    <button onClick={() => setToolMode('SUB')} className={`p-2.5 rounded-lg transition-all ${toolMode==='SUB' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-600'}`}><Minus size={16}/></button>
                                </div>
                                <button onClick={() => setMobileMenuLayerId(selectedLayerIds[0])} disabled={selectedLayerIds.length === 0} className="flex flex-col items-center justify-center min-w-[50px] h-12 rounded-xl text-vingi-400 bg-vingi-500/10 ml-1">
                                    <Settings size={18}/>
                                    <span className="text-[7px] font-black mt-0.5 uppercase">Ação</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="absolute top-0 left-0 bottom-0 w-16 bg-black border-r border-white/5 flex flex-col items-center py-6 gap-5 z-50 shadow-2xl">
                                <ToolBtn icon={Hand} label="Pan" active={tool==='HAND'} onClick={() => setTool('HAND')} />
                                <div className="w-8 h-px bg-white/10"></div>
                                <ToolBtn icon={Wand2} label="Mira" active={tool==='WAND'} onClick={() => setTool('WAND')} />
                                <ToolBtn icon={Brush} label="Pincel" active={tool==='BRUSH'} onClick={() => setTool('BRUSH')} />
                                <ToolBtn icon={Eraser} label="Apagar" active={tool==='ERASER'} onClick={() => setTool('ERASER')} />
                                <ToolBtn icon={PenTool} label="Laço" active={tool==='LASSO'} onClick={() => setTool('LASSO')} />
                                <div className="mt-auto flex flex-col gap-4 mb-4">
                                    <button onClick={() => setToolMode(toolMode==='ADD'?'SUB':'ADD')} className={`p-2 rounded-xl transition-all ${toolMode==='ADD' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                                        {toolMode==='ADD' ? <Plus size={20}/> : <Minus size={20}/>}
                                    </button>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 bottom-0 w-80 bg-[#080808] border-l border-white/5 flex flex-col z-[100] shadow-2xl">
                                <LayerList layers={layers} selectedIds={selectedLayerIds} onSelect={(id:string, m:boolean)=>setSelectedLayerIds(m?([...selectedLayerIds, id]):[id])} onRename={(id:string,n:string)=>setLayers(ls=>ls.map(l=>l.id===id?{...l,name:n}:l))} onDelete={(id:string)=>setLayers(ls=>ls.filter(l=>l.id!==id))} onVisibility={toggleVisibility} onReorder={reorderLayer} editingLayerId={editingLayerId} setEditingLayerId={setEditingLayerId} />
                            </div>
                        </>
                    )}

                    {mobileMenuLayerId && (
                        <div className="fixed inset-0 z-[300] flex flex-col justify-end">
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileMenuLayerId(null)} />
                            <div className="relative bg-[#111] rounded-t-[32px] p-6 border-t border-white/10 animate-in slide-in-from-bottom pb-12">
                                <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
                                <div className="grid grid-cols-2 gap-4">
                                    <MenuAction icon={Edit2} label="Renomear" onClick={() => { setEditingLayerId(mobileMenuLayerId); setMobileMenuLayerId(null); }} />
                                    <MenuAction icon={Copy} label="Duplicar" onClick={() => { const l = layers.find(x=>x.id===mobileMenuLayerId); if(l) setLayers([...layers, {...l, id: 'L'+Date.now(), name: l.name+' (Cópia)'}]); setMobileMenuLayerId(null); }} />
                                    <MenuAction icon={ArrowUp} label="Trazer Frente" onClick={() => { reorderLayer(mobileMenuLayerId, 'UP'); setMobileMenuLayerId(null); }} />
                                    <MenuAction icon={ArrowDown} label="Enviar Trás" onClick={() => { reorderLayer(mobileMenuLayerId, 'DOWN'); setMobileMenuLayerId(null); }} />
                                    <MenuAction icon={Eye} label="Visível" onClick={() => { toggleVisibility(mobileMenuLayerId); setMobileMenuLayerId(null); }} />
                                    <MenuAction icon={Trash2} label="Excluir Camada" danger onClick={() => { setLayers(ls=>ls.filter(l=>l.id!==mobileMenuLayerId)); setMobileMenuLayerId(null); }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {isProcessing && ( <div className="fixed inset-0 z-[500] bg-black/95 flex flex-col items-center justify-center animate-fade-in"><Brain size={48} className="text-blue-500 animate-pulse mb-4" /><p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-200">Neural Sync...</p></div> )}
        </div>
    );
};

const MenuAction = ({ icon: Icon, label, onClick, danger }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-white/5 active:scale-95 transition-all ${danger ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-gray-300'}`}>
        <Icon size={24}/><span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
);

const ToolBtn = ({ icon: Icon, label, active, onClick }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center h-full flex-1 transition-all ${active ? 'text-blue-500' : 'text-gray-600'}`}>
        <div className={`p-2 rounded-xl mb-1 ${active ? 'bg-blue-500/10' : ''}`}><Icon size={22} strokeWidth={active ? 2.5 : 1.5} /></div>
        <span className={`text-[8px] uppercase font-black tracking-tight ${active ? 'text-white' : 'text-gray-700'}`}>{label}</span>
    </button>
);

const MobileSlider = ({ label, icon: Icon, value, onChange, min, max }: any) => (
    <div className="flex items-center gap-3 w-full">
        {Icon && <Icon size={14} className="text-gray-500 shrink-0"/>}
        <div className="flex-1 relative flex items-center">
            <input type="range" min={min} max={max} value={value} onChange={e => onChange(parseInt(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-blue-500 outline-none" />
        </div>
        <span className="text-[10px] font-mono text-blue-500 min-w-[30px] text-right">{value}</span>
    </div>
);

const LayerList = ({ layers, selectedIds, onSelect, onRename, onDelete, onVisibility, onReorder, editingLayerId, setEditingLayerId }: any) => {
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#0a0a0a]">
            <div className="p-5 flex items-center justify-between border-b border-white/5">
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2"><LayoutGrid size={14}/> Camadas Nexus</span>
                <span className="text-[9px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">{layers.length} ITENS</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar pb-32">
                {[...layers].reverse().map((l: any, idx: number) => {
                    const isSelected = selectedIds.includes(l.id);
                    return (
                        <div key={l.id} onClick={(e) => onSelect(l.id, e.ctrlKey || e.metaKey)} className={`p-3 rounded-2xl border transition-all flex items-center gap-4 relative cursor-pointer ${isSelected ? 'bg-blue-600/10 border-blue-500/50 shadow-lg scale-[1.02]' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                            <div className="w-12 h-12 bg-black rounded-xl border border-white/10 flex items-center justify-center p-0.5 overflow-hidden shrink-0 shadow-inner relative">
                                {l.isGroup ? <Folder className="text-blue-500" size={24}/> : <img src={l.src} className="max-w-full max-h-full object-contain" />}
                                {!l.visible && <div className="absolute inset-0 bg-red-900/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none"><EyeOff size={14} className="text-white"/></div>}
                                <div className="absolute bottom-0 right-0 bg-black/80 text-[7px] font-black px-1 rounded-tl-md border-t border-l border-white/10 text-gray-400">#{layers.length - idx}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                                {editingLayerId === l.id ? (
                                    <input autoFocus className="w-full bg-blue-900/30 border border-blue-500/50 rounded px-2 py-1 text-[11px] font-bold text-white outline-none" defaultValue={l.name} onBlur={(e) => { onRename(l.id, e.target.value); setEditingLayerId(null); }} onKeyDown={(e) => e.key==='Enter' && onRename(l.id, e.currentTarget.value)} />
                                ) : (
                                    <div className="flex flex-col"><p className={`text-[11px] font-black truncate uppercase tracking-tight ${isSelected ? 'text-blue-400' : l.visible ? 'text-gray-200' : 'text-gray-600'}`}>{l.name}</p><span className="text-[8px] text-gray-600 font-mono tracking-tighter">REF_{l.id.substring(0, 8)}</span></div>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="flex flex-col gap-0.5 mr-1">
                                    <button onClick={(e) => { e.stopPropagation(); onReorder(l.id, 'UP'); }} className="p-1 hover:text-blue-400 text-gray-600"><ArrowUp size={12}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); onReorder(l.id, 'DOWN'); }} className="p-1 hover:text-blue-400 text-gray-600"><ArrowDown size={12}/></button>
                                </div>
                                <button type="button" onClick={(e) => { e.stopPropagation(); onVisibility(l.id); }} className={`p-2 rounded-lg transition-colors cursor-pointer ${l.visible ? 'text-blue-400 bg-blue-400/5 hover:bg-blue-400/10' : 'text-gray-700 bg-black/20 hover:bg-black/30'}`}>{l.visible ? <Eye size={16}/> : <EyeOff size={16}/>}</button>
                                <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === l.id ? null : l.id); }} className="p-2 text-gray-500 hover:text-white"><MoreHorizontal size={18}/></button>
                            </div>
                            {menuOpenId === l.id && (
                                <div className="absolute right-2 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-[300] p-1 animate-in fade-in slide-in-from-top-2">
                                    <button onClick={(e)=>{e.stopPropagation(); setEditingLayerId(l.id); setMenuOpenId(null);}} className="w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold text-gray-300 hover:bg-blue-600 hover:text-white rounded-xl transition-all"><Edit2 size={14}/> Renomear</button>
                                    <button onClick={(e)=>{e.stopPropagation(); triggerTransfer('MOCKUP', l.src); setMenuOpenId(null);}} className="w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold text-gray-300 hover:bg-blue-600 hover:text-white rounded-xl transition-all"><Shirt size={14}/> Aplicar em Molde</button>
                                    <div className="h-px bg-white/5 my-1"></div>
                                    <button onClick={(e)=>{e.stopPropagation(); onDelete(l.id); setMenuOpenId(null);}} className="w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all"><Trash2 size={14}/> Excluir Permanente</button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {menuOpenId && <div className="fixed inset-0 z-[250]" onClick={() => setMenuOpenId(null)} />}
        </div>
    );
};

const triggerTransfer = (targetModule: string, imageData: string) => {
    if (targetModule === 'MOCKUP') localStorage.setItem('vingi_mockup_pattern', imageData);
    window.dispatchEvent(new CustomEvent('vingi_transfer', { detail: { module: targetModule } }));
};
