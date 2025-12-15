
import React, { useState, useRef, useEffect } from 'react';
import { Layers, Move, Trash2, Eye, EyeOff, Lock, Wand2, UploadCloud, RotateCw, Hand, Maximize, Minus, Plus, Shirt, Scan, Copy, MousePointer2, ChevronRight } from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleHeader, FloatingReference } from './Shared';

// ... (KEEP EXISTING rgbToLab, getSmartMask, healBackground, removeWhiteBackground FUNCTIONS AS IS - NO CHANGE NEEDED) ...
// NOTE: For brevity in XML, assuming helper functions are preserved or I will re-include them if strictly required by format. 
// I will re-include minimal versions for context, but in a real edit I'd assume they are there.
// To be safe, I will include the full file content with the fixes.

// --- MODULE 1: THE COLORIST (LAB Color Space) ---
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

const getSmartMask = (ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number, tolerance: number, mode: 'CONTIGUOUS' | 'GLOBAL') => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const visited = new Uint8Array(width * height);
    const mask = new Uint8Array(width * height);
    const p = (startY * width + startX) * 4;
    if (p < 0 || p >= data.length || data[p + 3] === 0) return { mask, bounds: null, blobs: [] };
    const [l0, a0, b0] = rgbToLab(data[p], data[p+1], data[p+2]);
    const isSimilar = (idx: number) => {
        const pos = idx * 4;
        if (data[pos+3] === 0) return false;
        const [l, a, b] = rgbToLab(data[pos], data[pos+1], data[pos+2]);
        return Math.sqrt((l-l0)**2 + (a-a0)**2 + (b-b0)**2) < tolerance;
    };
    const allMatchingPixels: number[] = [];
    if (mode === 'GLOBAL') {
        for(let i=0; i<width*height; i++) {
            if (isSimilar(i)) { mask[i] = 255; allMatchingPixels.push(i); }
        }
    } else {
        const stack = [[startX, startY]];
        while (stack.length) {
            const [x, y] = stack.pop()!;
            const idx = y * width + x;
            if (visited[idx]) continue;
            visited[idx] = 1;
            if (isSimilar(idx)) {
                mask[idx] = 255; allMatchingPixels.push(idx);
                if (x>0) stack.push([x-1,y]); if (x<width-1) stack.push([x+1,y]);
                if (y>0) stack.push([x,y-1]); if (y<height-1) stack.push([x,y+1]);
            }
        }
    }
    const blobs: any[] = [];
    const blobVisited = new Uint8Array(width * height);
    for (const pixelIdx of allMatchingPixels) {
        if (blobVisited[pixelIdx]) continue;
        const blobPixels: number[] = [];
        const stack = [pixelIdx];
        let minX = width, maxX = 0, minY = height, maxY = 0;
        while(stack.length) {
            const idx = stack.pop()!;
            if (blobVisited[idx]) continue;
            blobVisited[idx] = 1;
            if (mask[idx] === 255) {
                blobPixels.push(idx);
                const x = idx % width, y = Math.floor(idx / width);
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
                [idx-1, idx+1, idx-width, idx+width].forEach(n => {
                    if (n >= 0 && n < width*height && mask[n] === 255 && !blobVisited[n]) stack.push(n);
                });
            }
        }
        if (blobPixels.length > 20) blobs.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, pixels: blobPixels });
    }
    return { mask, bounds: null, blobs };
};

const healBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, mask: Uint8Array) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const damageMask = new Uint8Array(mask); 
    const iterations = 20; 
    for (let it = 0; it < iterations; it++) {
        const nextData = new Uint8ClampedArray(data);
        let filledCount = 0;
        for (let i = 0; i < width * height; i++) {
            if (damageMask[i] > 0 || data[i * 4 + 3] === 0) { 
                let r=0, g=0, b=0, count=0;
                const dist = (it % 8) + 3; const x = i % width; const y = Math.floor(i / width);
                for (let angle=0; angle<Math.PI*2; angle+=0.5) {
                    const nx = Math.floor(x + Math.cos(angle + it) * dist);
                    const ny = Math.floor(y + Math.sin(angle + it) * dist);
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const ni = ny * width + nx;
                        if (damageMask[ni] === 0 && data[ni*4+3] > 0) { r += data[ni*4]; g += data[ni*4+1]; b += data[ni*4+2]; count++; }
                    }
                }
                if (count > 0) { nextData[i*4] = r/count; nextData[i*4+1] = g/count; nextData[i*4+2] = b/count; nextData[i*4+3] = 255; damageMask[i] = 0; filledCount++; }
            }
        }
        if (filledCount === 0) break;
        imgData.data.set(nextData);
        for(let k=0; k<data.length; k++) data[k] = nextData[k];
    }
    ctx.putImageData(imgData, 0, 0);
};

const removeWhiteBackground = (img: HTMLImageElement): string => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0,0,canvas.width,canvas.height);
    const d = id.data;
    for(let i=0; i<d.length; i+=4) if (d[i] > 230 && d[i+1] > 230 && d[i+2] > 230) d[i+3] = 0;
    ctx.putImageData(id, 0, 0);
    return canvas.toDataURL();
};

interface LayerStudioProps {
    onNavigateBack?: () => void;
    onNavigateToMockup?: () => void;
}

export const LayerStudio: React.FC<LayerStudioProps> = ({ onNavigateBack, onNavigateToMockup }) => {
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 1000, h: 1000 });
    const [tool, setTool] = useState<'MOVE' | 'MAGIC_WAND' | 'HAND'>('MOVE');
    const [wandTolerance, setWandTolerance] = useState(25);
    const [view, setView] = useState({ x: 0, y: 0, k: 1 });
    const containerRef = useRef<HTMLDivElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState('');
    const [progress, setProgress] = useState(0);
    const [incomingImage, setIncomingImage] = useState<string | null>(null);
    const [transformMode, setTransformMode] = useState<'IDLE' | 'DRAG' | 'ROTATE' | 'SCALE' | 'PAN'>('IDLE');
    const [startInteraction, setStartInteraction] = useState<{x: number, y: number, val: number} | null>(null);
    const [pendingSelection, setPendingSelection] = useState<{ layerId: string, startX: number, startY: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- TRANSFER LISTENER ---
    useEffect(() => {
        const checkStorage = () => {
            const sourceImage = localStorage.getItem('vingi_layer_studio_source');
            if (sourceImage) {
                setIncomingImage(sourceImage);
                localStorage.removeItem('vingi_layer_studio_source');
            }
        };
        checkStorage();

        const handleTransfer = (e: any) => {
            if (e.detail?.module === 'LAYER') checkStorage();
        };
        window.addEventListener('vingi_transfer', handleTransfer);
        return () => window.removeEventListener('vingi_transfer', handleTransfer);
    }, []);

    const updateLayer = (id: string, updates: Partial<DesignLayer>) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) startSession(ev.target.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const sendToMockup = async () => {
        if (!onNavigateToMockup) return;
        setIsProcessing(true);
        setProcessStatus('Exporting...');
        try {
            const canvas = document.createElement('canvas');
            canvas.width = canvasSize.w; canvas.height = canvasSize.h;
            const ctx = canvas.getContext('2d')!;
            const sorted = [...layers].filter(l => l.visible).sort((a,b) => a.zIndex - b.zIndex);
            for (const layer of sorted) {
                const img = new Image(); img.src = layer.src; img.crossOrigin = "anonymous";
                await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
                ctx.save();
                ctx.translate(canvas.width/2 + layer.x, canvas.height/2 + layer.y);
                ctx.rotate(layer.rotation * Math.PI / 180);
                ctx.scale(layer.scale, layer.scale);
                ctx.drawImage(img, -img.width/2, -img.height/2);
                ctx.restore();
            }
            const dataUrl = canvas.toDataURL('image/png');
            localStorage.setItem('vingi_mockup_pattern', dataUrl);
            window.dispatchEvent(new CustomEvent('vingi_transfer', { detail: { module: 'MOCKUP' } }));
            onNavigateToMockup();
        } catch (e) { console.error(e); } finally { setIsProcessing(false); }
    };

    const startSession = (img: string) => {
        const image = new Image(); image.src = img;
        image.onload = () => {
            const w = image.width, h = image.height;
            const maxDim = 1200;
            let finalW = w, finalH = h;
            if (w > maxDim || h > maxDim) {
                const ratio = w/h;
                if (w > h) { finalW = maxDim; finalH = maxDim / ratio; } else { finalH = maxDim; finalW = maxDim * ratio; }
            }
            setCanvasSize({ w: finalW, h: finalH });
            setLayers([
                { id: 'layer-original', type: 'BACKGROUND', name: 'Original', src: img, x: 0, y: 0, scale: 1, rotation: 0, visible: true, locked: true, zIndex: 0 },
                { id: 'layer-base', type: 'BACKGROUND', name: 'Base Editável', src: img, x: 0, y: 0, scale: 1, rotation: 0, visible: true, locked: false, zIndex: 1 }
            ]);
            setIncomingImage(null); setTool('MAGIC_WAND');
        };
    };

    const executeSeparation = async (mode: 'ONE' | 'ALL') => {
        if (!pendingSelection) return;
        const { layerId, startX, startY } = pendingSelection;
        setPendingSelection(null); setIsProcessing(true); setProgress(5);
        const targetLayer = layers.find(l => l.id === layerId);
        if (!targetLayer) return;
        const img = new Image(); img.src = targetLayer.src; await new Promise(r => img.onload = r);
        const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
        setProcessStatus('Scanning...');
        const scanMode = mode === 'ALL' ? 'GLOBAL' : 'CONTIGUOUS';
        const { mask, blobs } = getSmartMask(ctx, canvas.width, canvas.height, startX, startY, wandTolerance, scanMode);
        if (blobs.length === 0) { setIsProcessing(false); return; }
        setProcessStatus(`Extracting ${blobs.length} items...`);
        const newLayersAdded: DesignLayer[] = [];
        const fullDamageMask = new Uint8Array(canvas.width * canvas.height);
        const CHUNK_SIZE = 4;
        for (let i = 0; i < blobs.length; i += CHUNK_SIZE) {
            const chunk = blobs.slice(i, i + CHUNK_SIZE);
            const chunkPromises = chunk.map(async (blob, idx) => {
                const globalIdx = i + idx;
                const objCanvas = document.createElement('canvas'); objCanvas.width = blob.w; objCanvas.height = blob.h;
                const objCtx = objCanvas.getContext('2d')!;
                const blobPixels = new Set(blob.pixels);
                const srcData = ctx.getImageData(blob.x, blob.y, blob.w, blob.h);
                for(let y=0; y<blob.h; y++) {
                    for(let x=0; x<blob.w; x++) {
                        const gIdx = (blob.y + y) * canvas.width + (blob.x + x);
                        if (!blobPixels.has(gIdx)) srcData.data[(y*blob.w+x)*4+3] = 0; else fullDamageMask[gIdx] = 255;
                    }
                }
                objCtx.putImageData(srcData, 0, 0);
                const rawCrop = objCanvas.toDataURL();
                let finalSrc = rawCrop, finalName = `Elemento ${globalIdx+1}`;
                try {
                    const aiRes = await fetch('/api/analyze', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ action: 'RECONSTRUCT_ELEMENT', cropBase64: rawCrop.split(',')[1] }) });
                    const aiData = await aiRes.json();
                    if (aiData.success && aiData.src) {
                        const aiImg = new Image(); aiImg.src = aiData.src; await new Promise(r => aiImg.onload = r);
                        finalSrc = removeWhiteBackground(aiImg); finalName = aiData.name || finalName;
                    }
                } catch (e) {}
                const origCenterX = canvas.width/2, origCenterY = canvas.height/2;
                const objCenterX = blob.x + blob.w/2, objCenterY = blob.y + blob.h/2;
                const deltaX = objCenterX - origCenterX, deltaY = objCenterY - origCenterY;
                const rad = (targetLayer.rotation * Math.PI) / 180;
                const rotX = deltaX * Math.cos(rad) - deltaY * Math.sin(rad);
                const rotY = deltaX * Math.sin(rad) + deltaY * Math.cos(rad);
                return { id: `obj-${Date.now()}-${globalIdx}`, type: 'ELEMENT', name: finalName, src: finalSrc, x: targetLayer.x + (rotX*targetLayer.scale), y: targetLayer.y + (rotY*targetLayer.scale), scale: targetLayer.scale, rotation: targetLayer.rotation, visible: true, locked: false, zIndex: layers.length + 10 + globalIdx } as DesignLayer;
            });
            newLayersAdded.push(...(await Promise.all(chunkPromises)));
            setProgress(Math.round((Math.min(blobs.length, i + CHUNK_SIZE) / blobs.length) * 80));
        }
        if (!targetLayer.locked) {
            setProcessStatus('Healing Background...');
            healBackground(ctx, canvas.width, canvas.height, fullDamageMask);
            const newBgSrc = canvas.toDataURL();
            setLayers(prev => prev.map(l => l.id === layerId ? { ...l, src: newBgSrc } : l).concat(newLayersAdded));
        } else setLayers(prev => prev.concat(newLayersAdded));
        setProgress(100); setTool('MOVE'); setSelectedLayerId(newLayersAdded.length > 0 ? newLayersAdded[0].id : null); setIsProcessing(false); setProcessStatus(''); setProgress(0);
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); setView(prev => ({ ...prev, k: Math.min(Math.max(0.1, prev.k - e.deltaY*0.001), 5) })); }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button === 1 || tool === 'HAND' || e.buttons === 4) {
            setTransformMode('PAN'); setStartInteraction({ x: e.clientX, y: e.clientY, val: 0 }); e.preventDefault(); return;
        }
        const rect = containerRef.current!.getBoundingClientRect();
        const centerX = rect.left + rect.width/2, centerY = rect.top + rect.height/2;
        const relX = (e.clientX - centerX - view.x) / view.k, relY = (e.clientY - centerY - view.y) / view.k;
        if (tool === 'MAGIC_WAND') {
             const sorted = [...layers].sort((a,b) => b.zIndex - a.zIndex);
             // Very simplified hit test for demo. In real app, use pixel check on layer canvas.
        } else if (tool === 'MOVE') { if (e.target === e.currentTarget) setSelectedLayerId(null); }
    };

    const handleGlobalMove = (e: React.PointerEvent) => {
        if (transformMode === 'PAN' && startInteraction) {
            setView(prev => ({ ...prev, x: prev.x + e.clientX - startInteraction.x, y: prev.y + e.clientY - startInteraction.y }));
            setStartInteraction({ x: e.clientX, y: e.clientY, val: 0 });
        } else if (transformMode === 'DRAG' && selectedLayerId && startInteraction) {
            const layer = layers.find(l => l.id === selectedLayerId);
            if (layer) { updateLayer(selectedLayerId, { x: layer.x + (e.clientX - startInteraction.x) / view.k, y: layer.y + (e.clientY - startInteraction.y) / view.k }); setStartInteraction({ x: e.clientX, y: e.clientY, val: 0 }); }
        }
    };

    const handleLayerMouseDown = (e: React.MouseEvent, layerId: string) => {
        if (tool === 'HAND') return;
        if (tool === 'MAGIC_WAND') {
             e.stopPropagation();
             const layerEl = e.currentTarget.getBoundingClientRect();
             const layer = layers.find(l => l.id === layerId);
             if (layer && !layer.locked) {
                 const img = new Image(); img.src = layer.src;
                 setPendingSelection({ layerId, startX: Math.floor(((e.clientX - layerEl.left)/layerEl.width) * (img.width||1000)), startY: Math.floor(((e.clientY - layerEl.top)/layerEl.height) * (img.height||1000)) });
             }
        } else if (tool === 'MOVE') {
            e.stopPropagation(); setSelectedLayerId(layerId); setTransformMode('DRAG'); setStartInteraction({ x: e.clientX, y: e.clientY, val: 0 });
        }
    };

    if (incomingImage) {
        return (
            <div className="flex flex-col h-full items-center justify-center p-8 bg-gray-50">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-4xl w-full flex gap-8 items-center">
                    <img src={incomingImage} className="w-1/2 h-80 object-contain bg-gray-100 rounded-lg border" />
                    <div className="space-y-6">
                        <h1 className="text-3xl font-bold text-gray-800">Layer Lab 2.0</h1>
                        <p className="text-gray-500">Imagem recebida. Inicie a sessão para decompor os elementos.</p>
                        <button onClick={() => startSession(incomingImage!)} className="w-full py-4 bg-vingi-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-105 transition-transform"><Wand2 size={20}/> INICIAR SESSÃO</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-[#1e293b] text-white overflow-hidden" onPointerMove={handleGlobalMove} onPointerUp={() => { setTransformMode('IDLE'); setStartInteraction(null); }} onWheel={handleWheel}>
            <ModuleHeader icon={Layers} title="Layer Studio" subtitle="Decomposição Inteligente" />
            <div className="flex flex-1 overflow-hidden">
                <div ref={containerRef} className={`flex-1 relative overflow-hidden flex items-center justify-center bg-[#0f172a] ${tool==='HAND'?'cursor-grab':''}`} onPointerDown={handlePointerDown} style={{ touchAction: 'none' }}>
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px]" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}/>
                    <div className="relative shadow-2xl transition-transform duration-75 ease-out" style={{ width: canvasSize.w, height: canvasSize.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: 'center center' }}>
                        <div className="absolute inset-0 bg-white/5 border border-white/10" />
                        {layers.map(l => l.visible && (
                            <div key={l.id} className={`absolute select-none group ${selectedLayerId===l.id ? 'z-[999]' : ''}`} style={{ left: '50%', top: '50%', width: '100%', height: '100%', transform: `translate(calc(-50% + ${l.x}px), calc(-50% + ${l.y}px)) rotate(${l.rotation}deg) scale(${l.scale})`, zIndex: l.zIndex, pointerEvents: l.type === 'BACKGROUND' && l.locked ? 'none' : 'auto' }} onMouseDown={(e) => handleLayerMouseDown(e, l.id)}>
                                <img src={l.src} className={`w-full h-full object-contain pointer-events-none ${selectedLayerId===l.id && tool!=='MAGIC_WAND' ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : ''}`} />
                                {selectedLayerId===l.id && tool==='MOVE' && !l.locked && ( <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none"><div className="absolute -top-3 -left-3 w-6 h-6 bg-blue-500 rounded-full shadow cursor-pointer flex items-center justify-center pointer-events-auto" onMouseDown={(e)=>{e.stopPropagation(); updateLayer(l.id, {rotation: l.rotation-15})}}><RotateCw size={12}/></div></div> )}
                            </div>
                        ))}
                    </div>
                    {/* Controls & Modals */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-gray-900/90 backdrop-blur px-4 py-2 rounded-full border border-gray-700 shadow-xl z-[100]">
                        <button onClick={() => setView(p => ({...p, k: Math.max(0.1, p.k-0.1)}))}><Minus size={16}/></button><span className="text-xs font-mono w-12 text-center">{Math.round(view.k*100)}%</span><button onClick={() => setView(p => ({...p, k: Math.min(5, p.k+0.1)}))}><Plus size={16}/></button>
                        <div className="w-px h-4 bg-gray-600 mx-2"></div><button onClick={() => setView({x:0, y:0, k: 0.8})} title="Fit to Screen"><Maximize size={16}/></button>
                    </div>
                    {pendingSelection && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-gray-800 p-6 rounded-2xl shadow-2xl z-[100] w-80 animate-fade-in border border-gray-200">
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Scan size={20} className="text-purple-600"/> Smart Extract</h3>
                            <div className="space-y-3 mt-4">
                                <button onClick={() => executeSeparation('ONE')} className="w-full p-3 bg-gray-50 hover:bg-purple-50 rounded-xl flex items-center gap-3 text-left font-bold text-sm"><MousePointer2 size={18}/> Extrair Elemento</button>
                                <button onClick={() => executeSeparation('ALL')} className="w-full p-3 bg-gray-50 hover:bg-vingi-50 rounded-xl flex items-center gap-3 text-left font-bold text-sm"><Copy size={18}/> Extrair Similares</button>
                            </div>
                            <button onClick={() => setPendingSelection(null)} className="mt-4 w-full py-2 text-xs font-bold text-gray-400">Cancelar</button>
                        </div>
                    )}
                    {isProcessing && <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-[110]"><div className="text-xl font-bold text-white animate-pulse">{processStatus}</div><div className="mt-2 text-xs text-gray-500 font-mono">{progress}%</div></div>}
                </div>
                {/* SIDEBAR */}
                <div className="w-80 bg-[#1e293b] border-l border-gray-700 flex flex-col shadow-2xl z-20">
                    <div className="p-4 bg-[#0f172a] border-b border-gray-700 space-y-4">
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-gray-800 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 hover:text-white transition-colors text-xs font-bold flex items-center justify-center gap-2"><UploadCloud size={14}/> CARREGAR IMAGEM</button>
                        <div className="flex bg-gray-800 p-1 rounded-lg">
                            <button onClick={() => setTool('MOVE')} className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 ${tool==='MOVE' ? 'bg-vingi-600 shadow' : 'text-gray-400'}`}><Move size={14}/> Mover</button>
                            <button onClick={() => setTool('MAGIC_WAND')} className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 ${tool==='MAGIC_WAND' ? 'bg-purple-600 shadow' : 'text-gray-400'}`}><Wand2 size={14}/> Varinha</button>
                            <button onClick={() => setTool('HAND')} className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 ${tool==='HAND' ? 'bg-gray-600 shadow text-white' : 'text-gray-400'}`}><Hand size={14}/></button>
                        </div>
                        {tool === 'MAGIC_WAND' && <input type="range" min="5" max="100" value={wandTolerance} onChange={(e) => setWandTolerance(Number(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"/>}
                        <button onClick={sendToMockup} className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg font-bold text-sm shadow-lg flex items-center justify-center gap-2"><Shirt size={16}/> ENVIAR P/ PROVADOR</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                        {layers.slice().reverse().map(l => (
                            <div key={l.id} onClick={() => setSelectedLayerId(l.id)} className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer border transition-all ${selectedLayerId===l.id ? 'bg-vingi-900/50 border-vingi-500/50' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
                                <img src={l.src} className="w-8 h-8 object-contain bg-gray-900 rounded border border-gray-600" />
                                <div className="flex-1 min-w-0"><h4 className="text-xs font-bold text-gray-200 truncate">{l.name}</h4></div>
                                <div className="flex gap-1">
                                    <button onClick={(e)=>{e.stopPropagation(); updateLayer(l.id, {visible: !l.visible})}} className="p-1.5 text-gray-400 hover:text-white rounded">{l.visible?<Eye size={12}/>:<EyeOff size={12}/>}</button>
                                    {!l.locked && <button onClick={(e)=>{e.stopPropagation(); setLayers(prev=>prev.filter(x=>x.id!==l.id))}} className="p-1.5 text-gray-400 hover:text-red-400 rounded"><Trash2 size={12}/></button>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
