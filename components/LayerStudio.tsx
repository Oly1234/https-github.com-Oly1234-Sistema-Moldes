

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layers, Move, Trash2, Eye, EyeOff, Lock, Wand2, UploadCloud, RotateCw, Hand, Maximize, Minus, Plus, Shirt, Scan, Copy, MousePointer2, ChevronRight, FlipHorizontal, FlipVertical, ArrowUp, ArrowDown, Scissors, Eraser, Sparkles, Undo2, Redo2, Keyboard, Zap, ZoomIn, ZoomOut, RotateCcw, X, Brush, Focus, ShieldCheck, Grid, PaintBucket, Loader2, RefreshCcw, BringToFront, SendToBack, CopyPlus, MinusCircle, PlusCircle, SlidersHorizontal } from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleHeader, ModuleLandingPage } from './Shared';

// --- HELPERS DE IMAGEM & MATEMÁTICA ---

const rgbToLab = (r: number, g: number, b: number) => {
    let r1 = r / 255, g1 = g / 255, b1 = b / 255;
    r1 = (r1 > 0.04045) ? Math.pow((r1 + 0.055) / 1.055, 2.4) : r1 / 12.92;
    g1 = (g1 > 0.04045) ? Math.pow((g1 + 0.055) / 1.055, 2.4) : g1 / 12.92;
    b1 = (b1 > 0.04045) ? Math.pow((b1 + 0.055) / 1.055, 2.4) : b1 / 12.92;
    let x = (r1 * 0.4124 + g1 * 0.3576 + b1 * 0.1805) / 0.95047;
    let y = (r1 * 0.2126 + g1 * 0.7152 + b1 * 0.0722) / 1.00000;
    let z = (r1 * 0.0193 + g1 * 0.1192 + b1 * 0.9505) / 1.08883;
    x = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
    y = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
    z = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;
    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
};

// Algoritmo de Seleção Inteligente (Wand)
const getSmartObjectMask = (ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number, tolerance: number, mode: 'SINGLE' | 'GLOBAL') => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const mask = new Uint8Array(width * height);
    
    const p = (startY * width + startX) * 4;
    if (p < 0 || p >= data.length) return { mask, hasPixels: false }; 
    
    const [l0, a0, b0] = rgbToLab(data[p], data[p+1], data[p+2]);
    const labTolerance = tolerance * 2.5; 

    if (mode === 'GLOBAL') {
        let count = 0;
        for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            if (data[idx+3] === 0) continue;
            const [l, a, b] = rgbToLab(data[idx], data[idx+1], data[idx+2]);
            const dist = Math.sqrt((l-l0)**2 + (a-a0)**2 + (b-b0)**2);
            if (dist < labTolerance) { mask[i] = 255; count++; }
        }
        return { mask, hasPixels: count > 0 };
    } else {
        const stack = [[startX, startY]];
        const visited = new Uint8Array(width * height);
        let count = 0;
        while (stack.length) {
            const [x, y] = stack.pop()!;
            const idx = y * width + x;
            if (visited[idx]) continue;
            visited[idx] = 1;
            const pos = idx * 4;
            if (data[pos+3] === 0) continue;
            const [l, a, b] = rgbToLab(data[pos], data[pos+1], data[pos+2]);
            const dist = Math.sqrt((l-l0)**2 + (a-a0)**2 + (b-b0)**2);
            if (dist < labTolerance) {
                mask[idx] = 255; count++;
                if (x > 0) stack.push([x-1, y]); if (x < width - 1) stack.push([x+1, y]);
                if (y > 0) stack.push([x, y-1]); if (y < height - 1) stack.push([x, y+1]);
            }
        }
        return { mask, hasPixels: count > 0 };
    }
};

const healBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, mask: Uint8Array) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const tempBuffer = new Uint8ClampedArray(data);
    const iterations = 20; 

    for (let it = 0; it < iterations; it++) {
        let changed = false;
        const readBuffer = new Uint8ClampedArray(tempBuffer);
        for (let i = 0; i < width * height; i++) {
            if (mask[i] === 255) { 
                let rSum=0, gSum=0, bSum=0, count=0;
                const x = i % width; const y = Math.floor(i / width);
                const neighbors = [{dx: -1, dy: 0}, {dx: 1, dy: 0}, {dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: -1}, {dx: 1, dy: -1}, {dx: -1, dy: 1}, {dx: 1, dy: 1}];
                for (const n of neighbors) {
                    const nx = x + n.dx; const ny = y + n.dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const ni = ny * width + nx;
                        if (mask[ni] === 0) {
                            const nIdx = ni * 4;
                            if (readBuffer[nIdx+3] > 0) { rSum += readBuffer[nIdx]; gSum += readBuffer[nIdx+1]; bSum += readBuffer[nIdx+2]; count++; }
                        }
                    }
                }
                if (count > 0) {
                    const idx = i * 4;
                    tempBuffer[idx] = rSum / count; tempBuffer[idx+1] = gSum / count; tempBuffer[idx+2] = bSum / count; tempBuffer[idx+3] = 255;
                    mask[i] = 0; changed = true;
                }
            }
        }
        if (!changed) break;
    }
    data.set(tempBuffer);
    ctx.putImageData(imgData, 0, 0);
};

const createTextureLayerImage = async (url: string, width: number, height: number, opacity: number): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image(); img.crossOrigin = "anonymous"; img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d')!; const pat = ctx.createPattern(img, 'repeat');
            if (pat) { ctx.fillStyle = pat; ctx.globalAlpha = opacity; ctx.fillRect(0, 0, width, height); }
            resolve(canvas.toDataURL());
        };
        img.onerror = () => resolve(''); 
    });
};

interface LayerStudioProps {
    onNavigateBack?: () => void;
    onNavigateToMockup?: () => void;
}

export const LayerStudio: React.FC<LayerStudioProps> = ({ onNavigateBack, onNavigateToMockup }) => {
    const [history, setHistory] = useState<DesignLayer[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 1000, h: 1000 });
    
    // TOOLS
    const [tool, setTool] = useState<'MOVE' | 'WAND' | 'BRUSH' | 'ERASER' | 'HAND'>('MOVE');
    const [wandMode, setWandMode] = useState<'SINGLE' | 'GLOBAL'>('SINGLE');
    const [wandAction, setWandAction] = useState<'NEW' | 'ADD' | 'SUB'>('NEW'); // Nova feature: + / -
    const [brushSize, setBrushSize] = useState(30);
    const [wandTolerance, setWandTolerance] = useState(40);
    const [smartEdge, setSmartEdge] = useState(true);
    const [feather, setFeather] = useState(2);

    // AI EDIT
    const [magicPrompt, setMagicPrompt] = useState('');
    const [isMagicLoading, setIsMagicLoading] = useState(false);

    // VIEWPORT
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
    const isPanning = useRef(false);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);
    const lastDistRef = useRef<number>(0);

    // MASKING
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [maskPreviewSrc, setMaskPreviewSrc] = useState<string | null>(null);
    const [maskHistory, setMaskHistory] = useState<Uint8Array[]>([]);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState('');
    const [incomingPayload, setIncomingPayload] = useState<any | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isTransforming, setIsTransforming] = useState<'NONE' | 'DRAG' | 'RESIZE' | 'ROTATE'>('NONE');
    const isDrawingRef = useRef(false);
    const lastDrawPos = useRef<{x: number, y: number} | null>(null);

    // --- TRANSFER LISTENER ---
    useEffect(() => {
        const checkStorage = () => {
            const stored = localStorage.getItem('vingi_layer_studio_data');
            const legacy = localStorage.getItem('vingi_layer_studio_source');
            if (stored) {
                setIncomingPayload(JSON.parse(stored));
                localStorage.removeItem('vingi_layer_studio_data');
            } else if (legacy) {
                setIncomingPayload({ mainImage: legacy, texture: null });
                localStorage.removeItem('vingi_layer_studio_source');
            }
        };
        checkStorage();
        window.addEventListener('vingi_transfer', (e: any) => { if (e.detail?.module === 'LAYER') checkStorage(); });
    }, []);

    // --- HISTORY MANAGER ---
    const addToLayerHistory = useCallback((newLayers: DesignLayer[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newLayers);
        if (newHistory.length > 20) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setLayers(newLayers);
    }, [history, historyIndex]);

    const undoMask = () => {
        if (maskHistory.length > 1) {
            const prev = maskHistory[maskHistory.length - 2];
            setMaskHistory(curr => curr.slice(0, -1));
            setActiveMask(new Uint8Array(prev));
            updateMaskPreview(prev);
        } else if (maskHistory.length === 1) {
            setMaskHistory([]); setActiveMask(null); setMaskPreviewSrc(null);
        }
    };

    const updateMaskPreview = (mask: Uint8Array) => {
        const canvas = document.createElement('canvas'); canvas.width = canvasSize.w; canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!; const imgData = ctx.createImageData(canvas.width, canvas.height); const data = imgData.data;
        for(let i=0; i<mask.length; i++) {
            if(mask[i] === 255) {
                const idx = i * 4;
                // Neon Selection Style based on mode
                if (wandAction === 'SUB') {
                    data[idx] = 255; data[idx+1] = 0; data[idx+2] = 50; data[idx+3] = 180; // Red
                } else {
                    data[idx] = 0; data[idx+1] = 255; data[idx+2] = 255; data[idx+3] = 150; // Cyan
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);
        setMaskPreviewSrc(canvas.toDataURL());
    };

    const startSession = async (payload: { mainImage: string, texture?: any }) => {
        const image = new Image(); image.src = payload.mainImage;
        image.onload = async () => {
            const maxDim = 1500;
            let finalW = image.width, finalH = image.height;
            if (image.width > maxDim || image.height > maxDim) {
                const ratio = image.width/image.height;
                if (image.width > image.height) { finalW = maxDim; finalH = Math.round(maxDim / ratio); } 
                else { finalH = maxDim; finalW = Math.round(maxDim * ratio); }
            }
            setCanvasSize({ w: finalW, h: finalH });
            const initialLayers: DesignLayer[] = [{ id: 'layer-base', type: 'BACKGROUND', name: 'Arte Original', src: payload.mainImage, x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: false, zIndex: 0 }];
            
            if (payload.texture && payload.texture.url) {
                const texImg = await createTextureLayerImage(payload.texture.url, finalW, finalH, payload.texture.opacity || 0.5);
                if (texImg) { initialLayers.push({ id: 'layer-texture', type: 'ELEMENT', name: `Textura (${payload.texture.type})`, src: texImg, x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: true, zIndex: 999 }); }
            }
            
            setLayers(initialLayers); setHistory([initialLayers]); setHistoryIndex(0); setIncomingPayload(null); 
            setTool('WAND');
            setTimeout(() => { if (containerRef.current) { const rect = containerRef.current.getBoundingClientRect(); const k = Math.min(rect.width / finalW, rect.height / finalH) * 0.8; setView({ x: 0, y: 0, k }); } }, 100);
            setActiveMask(null); setMaskPreviewSrc(null); setMaskHistory([]);
        };
    };

    // --- TOOL ACTIONS ---
    const applySelectionTool = (clickX: number, clickY: number, isDrag: boolean) => {
        const targetLayer = layers.find(l => !l.locked && l.visible && l.id !== 'layer-texture');
        if (!targetLayer) { alert("Selecione uma camada desbloqueada primeiro."); return; }

        const img = new Image(); img.src = targetLayer.src; img.crossOrigin = "anonymous";
        const canvas = document.createElement('canvas'); canvas.width = canvasSize.w; canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, canvasSize.w, canvasSize.h);

        // Logic to MERGE mask based on wandAction
        const currentMask = activeMask ? new Uint8Array(activeMask) : new Uint8Array(canvasSize.w * canvasSize.h);
        
        if (tool === 'WAND' && !isDrag) {
            const { mask: newMask, hasPixels } = getSmartObjectMask(ctx, canvasSize.w, canvasSize.h, Math.floor(clickX), Math.floor(clickY), wandTolerance, wandMode);
            
            if (hasPixels) {
                for(let i=0; i<currentMask.length; i++) {
                    if (wandAction === 'NEW') currentMask[i] = newMask[i];
                    else if (wandAction === 'ADD') currentMask[i] = (currentMask[i] === 255 || newMask[i] === 255) ? 255 : 0;
                    else if (wandAction === 'SUB') currentMask[i] = (newMask[i] === 255) ? 0 : currentMask[i];
                }
                // Save history only on click release (handled in pointer up ideally, but wand is instant)
                // For wand we save immediately
                setMaskHistory(prev => [...prev.slice(-10), new Uint8Array(currentMask)]);
                setActiveMask(currentMask);
                updateMaskPreview(currentMask);
            }
        } 
        // Brush logic simplified for this snippet
    };

    // --- MAGIC SWAP ---
    const handleMagicSwap = async () => {
        if (!selectedLayerId || !magicPrompt.trim()) return;
        const targetLayer = layers.find(l => l.id === selectedLayerId);
        if (!targetLayer) return;

        setIsMagicLoading(true);
        try {
            // Get crop of current element as reference
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'TRANSFORM_ELEMENT', 
                    cropBase64: targetLayer.src, // Using full src as reference for now
                    userPrompt: magicPrompt
                })
            });
            const data = await response.json();
            if (data.success && data.src) {
                const newLayers = layers.map(l => l.id === selectedLayerId ? { ...l, src: data.src, name: `✨ ${magicPrompt}` } : l);
                setLayers(newLayers);
                addToLayerHistory(newLayers);
                setMagicPrompt('');
            } else {
                alert("Falha ao gerar elemento.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsMagicLoading(false);
        }
    };

    // --- TRANSFORM HELPERS ---
    const updateSelectedLayer = (updates: Partial<DesignLayer>) => {
        if (!selectedLayerId) return;
        const newLayers = layers.map(l => l.id === selectedLayerId ? { ...l, ...updates } : l);
        setLayers(newLayers);
    };
    
    const commitLayerChange = () => addToLayerHistory(layers);

    const duplicateLayer = () => {
        if (!selectedLayerId) return;
        const original = layers.find(l => l.id === selectedLayerId);
        if (original) {
            const newLayer = { ...original, id: `copy-${Date.now()}`, x: original.x + 20, y: original.y + 20, name: `${original.name} (Copy)` };
            const newLayers = [...layers, newLayer];
            setLayers(newLayers);
            addToLayerHistory(newLayers);
            setSelectedLayerId(newLayer.id);
        }
    };

    // --- RENDER ---
    // ... [Previous render code for canvas/viewport] ...
    const getCanvasCoords = (clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const cx = rect.width / 2; const cy = rect.height / 2;
        const relX = (clientX - rect.left - cx - view.x) / view.k + canvasSize.w / 2;
        const relY = (clientY - rect.top - cy - view.y) / view.k + canvasSize.h / 2;
        return { x: relX, y: relY };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
        if (tool === 'HAND' || e.button === 1) { isPanning.current = true; return; }
        const { x, y } = getCanvasCoords(e.clientX, e.clientY);
        if (tool === 'MOVE' && selectedLayerId) setIsTransforming('DRAG');
        else if (['WAND'].includes(tool)) applySelectionTool(x, y, false);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!lastPointerPos.current) return;
        const dx = e.clientX - lastPointerPos.current.x;
        const dy = e.clientY - lastPointerPos.current.y;
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
        if (isPanning.current) { setView(v => ({ ...v, x: v.x + dx, y: v.y + dy })); return; }
        if (isTransforming === 'DRAG' && selectedLayerId) {
            const newLayers = layers.map(l => l.id === selectedLayerId ? { ...l, x: l.x + dx/view.k, y: l.y + dy/view.k } : l);
            setLayers(newLayers);
        }
    };

    const handlePointerUp = () => {
        if (isTransforming === 'DRAG') commitLayerChange();
        isPanning.current = false; setIsTransforming('NONE'); lastPointerPos.current = null;
    };

    if (incomingPayload) return <div className="flex items-center justify-center h-full bg-black text-white"><Loader2 size={32} className="animate-spin"/></div>;

    const selectedLayer = layers.find(l => l.id === selectedLayerId);

    return (
        <div className="flex flex-col h-full w-full bg-[#1e293b] text-white overflow-hidden" 
             onPointerUp={handlePointerUp} onPointerMove={handlePointerMove}>
            
            <ModuleHeader icon={Layers} title="Layer Studio" subtitle="Laboratório de Extração" />
            
            {!layers.length ? (
                <div className="flex-1 bg-white overflow-y-auto">
                    <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>startSession({mainImage: ev.target?.result as string}); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
                    <ModuleLandingPage icon={Layers} title="Layer Lab" description="Separação inteligente e reconstrução de elementos." primaryActionLabel="Abrir Imagem" onPrimaryAction={() => fileInputRef.current?.click()} />
                </div>
            ) : (
                <>
                    {/* TOP TOOLBAR */}
                    <div className="h-14 bg-[#0f172a] border-b border-gray-700 flex items-center px-4 gap-4 shrink-0 z-30 justify-between">
                        <div className="flex items-center gap-2">
                            <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
                                <button onClick={() => setTool('MOVE')} className={`p-2 rounded-md ${tool==='MOVE' ? 'bg-vingi-600 text-white' : 'text-gray-400'}`} title="Mover (V)"><Move size={18}/></button>
                                <div className="w-px h-6 bg-gray-700 mx-1 self-center"></div>
                                <button onClick={() => setTool('WAND')} className={`p-2 rounded-md ${tool==='WAND' ? 'bg-purple-600 text-white' : 'text-gray-400'}`} title="Varinha (W)"><Wand2 size={18}/></button>
                                <button onClick={() => setTool('HAND')} className={`p-2 rounded-md ${tool==='HAND' ? 'bg-gray-600 text-white' : 'text-gray-400'}`} title="Hand (H)"><Hand size={18}/></button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setView(v => ({ ...v, k: v.k * 1.2 }))} className="p-2 hover:bg-gray-800 rounded-full text-gray-400"><ZoomIn size={18}/></button>
                            <button onClick={() => setView({ x: 0, y: 0, k: 0.5 })} className="p-2 hover:bg-gray-800 rounded-full text-gray-400"><RotateCcw size={18}/></button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                        {/* CANVAS AREA */}
                        <div ref={containerRef} className={`flex-1 relative overflow-hidden flex items-center justify-center bg-[#101010]`} 
                             onPointerDown={handlePointerDown} style={{ cursor: tool === 'MOVE' ? 'default' : tool === 'HAND' ? 'grab' : 'crosshair' }}>
                            
                            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '20px 20px', transform: `scale(${view.k})`, transformOrigin: 'center' }} />

                            <div className="relative shadow-2xl transition-transform duration-75 ease-out origin-center" 
                                 style={{ width: canvasSize.w, height: canvasSize.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                                <div className="absolute inset-0 bg-white" />
                                {layers.map(l => l.visible && (
                                    <div key={l.id} className={`absolute select-none pointer-events-none`} 
                                         style={{ 
                                             left: '50%', top: '50%', 
                                             width: (l.type==='BACKGROUND') ? '100%' : 'auto', 
                                             height: (l.type==='BACKGROUND') ? '100%' : 'auto', 
                                             transform: `translate(calc(-50% + ${l.x}px), calc(-50% + ${l.y}px)) rotate(${l.rotation}deg) scale(${l.flipX?-l.scale:l.scale}, ${l.flipY?-l.scale:l.scale})`, 
                                             zIndex: l.zIndex,
                                             opacity: l.opacity ?? 1
                                         }}>
                                        <img src={l.src} className={`max-w-none ${l.type==='BACKGROUND' ? 'w-full h-full object-contain' : ''} ${selectedLayerId===l.id && tool==='MOVE' ? 'ring-2 ring-blue-500 shadow-xl' : ''}`} draggable={false} />
                                    </div>
                                ))}
                                {maskPreviewSrc && <div className="absolute inset-0 pointer-events-none z-[100] mix-blend-normal opacity-100"><img src={maskPreviewSrc} className="w-full h-full object-contain" /></div>}
                            </div>
                        </div>

                        {/* PROPERTIES PANEL */}
                        <div className="w-full md:w-80 bg-[#1e293b] border-t md:border-t-0 md:border-l border-gray-700 flex flex-col shadow-2xl z-20 h-[45vh] md:h-full">
                            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                                
                                {/* WAND SETTINGS */}
                                {tool === 'WAND' && (
                                    <div className="space-y-4 animate-slide-down bg-gray-800/50 p-3 rounded-xl border border-gray-700">
                                        <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2"><Wand2 size={12}/> Seleção Inteligente</h3>
                                        
                                        <div className="flex bg-gray-900 rounded-lg p-1">
                                            <button onClick={() => setWandAction('NEW')} className={`flex-1 py-2 text-[10px] font-bold rounded flex items-center justify-center gap-1 ${wandAction==='NEW' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}><RefreshCcw size={12}/> Nova</button>
                                            <button onClick={() => setWandAction('ADD')} className={`flex-1 py-2 text-[10px] font-bold rounded flex items-center justify-center gap-1 ${wandAction==='ADD' ? 'bg-vingi-600 text-white' : 'text-gray-500'}`}><PlusCircle size={12}/> Somar</button>
                                            <button onClick={() => setWandAction('SUB')} className={`flex-1 py-2 text-[10px] font-bold rounded flex items-center justify-center gap-1 ${wandAction==='SUB' ? 'bg-red-600 text-white' : 'text-gray-500'}`}><MinusCircle size={12}/> Subtrair</button>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] text-gray-400 font-bold"><span>Tolerância</span><span>{wandTolerance}%</span></div>
                                            <input type="range" min="5" max="100" value={wandTolerance} onChange={(e) => setWandTolerance(parseInt(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none accent-purple-500"/>
                                        </div>

                                        <div className="flex gap-2">
                                            <button onClick={() => setWandMode(m => m === 'SINGLE' ? 'GLOBAL' : 'SINGLE')} className={`flex-1 py-2 text-[10px] font-bold rounded border ${wandMode==='GLOBAL' ? 'bg-purple-900/30 border-purple-500 text-purple-300' : 'border-gray-600 text-gray-400'}`}>
                                                {wandMode === 'SINGLE' ? 'Contíguo (Flood)' : 'Global (Cor)'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* SELECTED LAYER EDITOR */}
                                {selectedLayer && selectedLayer.type === 'ELEMENT' && tool === 'MOVE' && (
                                    <div className="space-y-4 animate-slide-up">
                                        <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-xl">
                                            <h3 className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-3 flex items-center gap-2"><SlidersHorizontal size={12}/> Transformação</h3>
                                            
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] w-12 text-gray-400 font-bold">Escala</span>
                                                    <input type="range" min="0.1" max="3" step="0.1" value={selectedLayer.scale} onChange={(e) => updateSelectedLayer({ scale: parseFloat(e.target.value) })} onMouseUp={commitLayerChange} className="flex-1 h-1 bg-gray-700 rounded appearance-none accent-blue-500"/>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] w-12 text-gray-400 font-bold">Rotação</span>
                                                    <input type="range" min="0" max="360" value={selectedLayer.rotation} onChange={(e) => updateSelectedLayer({ rotation: parseInt(e.target.value) })} onMouseUp={commitLayerChange} className="flex-1 h-1 bg-gray-700 rounded appearance-none accent-blue-500"/>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] w-12 text-gray-400 font-bold">Opacidade</span>
                                                    <input type="range" min="0" max="1" step="0.1" value={selectedLayer.opacity ?? 1} onChange={(e) => updateSelectedLayer({ opacity: parseFloat(e.target.value) })} onMouseUp={commitLayerChange} className="flex-1 h-1 bg-gray-700 rounded appearance-none accent-blue-500"/>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-4 gap-2 mt-4">
                                                <button onClick={() => { updateSelectedLayer({ flipX: !selectedLayer.flipX }); commitLayerChange(); }} className="p-2 bg-gray-800 hover:bg-blue-600 rounded flex justify-center" title="Espelhar H"><FlipHorizontal size={16}/></button>
                                                <button onClick={() => { updateSelectedLayer({ flipY: !selectedLayer.flipY }); commitLayerChange(); }} className="p-2 bg-gray-800 hover:bg-blue-600 rounded flex justify-center" title="Espelhar V"><FlipVertical size={16}/></button>
                                                <button onClick={() => { updateSelectedLayer({ zIndex: selectedLayer.zIndex + 1 }); commitLayerChange(); }} className="p-2 bg-gray-800 hover:bg-blue-600 rounded flex justify-center" title="Trazer para Frente"><BringToFront size={16}/></button>
                                                <button onClick={duplicateLayer} className="p-2 bg-gray-800 hover:bg-green-600 rounded flex justify-center" title="Duplicar"><CopyPlus size={16}/></button>
                                            </div>
                                        </div>

                                        {/* MAGIC SWAP */}
                                        <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 p-3 rounded-xl">
                                            <h3 className="text-[10px] font-bold text-purple-300 uppercase tracking-widest mb-2 flex items-center gap-2"><Sparkles size={12}/> Troca Mágica (Gen AI)</h3>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    value={magicPrompt}
                                                    onChange={(e) => setMagicPrompt(e.target.value)}
                                                    placeholder="Ex: Transformar em rosa vermelha..." 
                                                    className="flex-1 bg-black/50 border border-purple-500/30 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
                                                />
                                                <button onClick={handleMagicSwap} disabled={isMagicLoading || !magicPrompt} className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg disabled:opacity-50">
                                                    {isMagicLoading ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16}/>}
                                                </button>
                                            </div>
                                            <p className="text-[9px] text-purple-400/60 mt-1 italic">O elemento será substituído por um novo gerado por IA.</p>
                                        </div>
                                    </div>
                                )}

                                {/* LAYERS LIST */}
                                <div className="space-y-1">
                                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1 mb-2">Camadas</h3>
                                    {layers.slice().reverse().map(l => (
                                        <div key={l.id} onClick={() => !l.locked && setSelectedLayerId(l.id)} className={`p-2 rounded-lg flex items-center gap-2 cursor-pointer border transition-all ${selectedLayerId===l.id ? 'bg-blue-900/30 border-blue-500/50' : 'bg-transparent border-transparent hover:bg-gray-800'} ${l.locked ? 'opacity-50' : ''}`}>
                                            <button onClick={(e)=>{e.stopPropagation(); updateSelectedLayer({visible: !l.visible})}} className={`p-1 rounded ${l.visible?'text-gray-400':'text-gray-600'}`}>{l.visible?<Eye size={12}/>:<EyeOff size={12}/>}</button>
                                            <div className="w-8 h-8 bg-gray-700 rounded border border-gray-600 overflow-hidden shrink-0"><img src={l.src} className="w-full h-full object-contain" /></div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`text-[11px] font-medium truncate ${selectedLayerId===l.id ? 'text-white' : 'text-gray-400'}`}>{l.name}</h4>
                                                <span className="text-[9px] text-gray-600 uppercase">{l.type === 'BACKGROUND' ? 'Base' : 'Elemento'}</span>
                                            </div>
                                            {l.locked && <Lock size={10} className="text-gray-600"/>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};