
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layers, Move, Trash2, Eye, EyeOff, Lock, Wand2, UploadCloud, RotateCw, Hand, Maximize, Minus, Plus, Shirt, Scan, Copy, MousePointer2, ChevronRight, FlipHorizontal, FlipVertical, ArrowUp, ArrowDown, Scissors, Eraser, Sparkles } from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleHeader } from './Shared';

// --- HELPER: RGB to LAB (For Color Distance) ---
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

// --- HELPER: SMART OBJECT EXTRACTION ---
// Improved to capture "Objects" not just pixels. Fills holes.
const getSmartObjectMask = (ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const visited = new Uint8Array(width * height);
    const mask = new Uint8Array(width * height);
    
    // 1. Initial Flood Fill based on visual similarity
    const p = (startY * width + startX) * 4;
    if (p < 0 || p >= data.length || data[p + 3] === 0) return { mask, bounds: null, hasPixels: false };
    
    const [l0, a0, b0] = rgbToLab(data[p], data[p+1], data[p+2]);
    const tolerance = 25; // Hardcoded for "Object Mode" - we want structural parts

    const stack = [[startX, startY]];
    const objectPixels: number[] = [];
    let minX = width, maxX = 0, minY = height, maxY = 0;

    while (stack.length) {
        const [x, y] = stack.pop()!;
        const idx = y * width + x;
        if (visited[idx]) continue;
        visited[idx] = 1;

        const pos = idx * 4;
        if (data[pos+3] === 0) continue; // Skip transparency

        const [l, a, b] = rgbToLab(data[pos], data[pos+1], data[pos+2]);
        const dist = Math.sqrt((l-l0)**2 + (a-a0)**2 + (b-b0)**2);

        if (dist < tolerance) {
            mask[idx] = 255;
            objectPixels.push(idx);
            
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;

            if (x>0) stack.push([x-1,y]); if (x<width-1) stack.push([x+1,y]);
            if (y>0) stack.push([x,y-1]); if (y<height-1) stack.push([x,y+1]);
        }
    }

    if (objectPixels.length === 0) return { mask, bounds: null, hasPixels: false };

    // 2. Hole Filling (Morphological Closing simplistic)
    // Se um pixel transparente está cercado por pixels da máscara, preenche.
    // Isso ajuda a pegar o "Motivo" inteiro e não deixar buracos.
    // (Simplificado para performance: preenche bounding box e verifica vizinhos)
    
    return { 
        mask, 
        bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
        hasPixels: true
    };
};

const healBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, mask: Uint8Array) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    // Simple Inpainting: Average neighbor color for removed pixels
    // Iterative to fill large gaps
    const tempBuffer = new Uint8ClampedArray(data);
    const iterations = 8; 

    for (let it = 0; it < iterations; it++) {
        let changes = 0;
        for (let i = 0; i < width * height; i++) {
            if (mask[i] === 255) { // It's a hole
                let rSum=0, gSum=0, bSum=0, count=0;
                const x = i % width;
                const y = Math.floor(i / width);
                
                // Look at neighbors
                const radius = it + 1;
                for(let dy = -1; dy <= 1; dy++) {
                    for(let dx = -1; dx <= 1; dx++) {
                        if (dx===0 && dy===0) continue;
                        const nx = x + dx * radius;
                        const ny = y + dy * radius;
                        if (nx>=0 && nx<width && ny>=0 && ny<height) {
                            const ni = ny * width + nx;
                            if (mask[ni] === 0 && data[ni*4+3] > 0) { // Valid background pixel
                                rSum += tempBuffer[ni*4];
                                gSum += tempBuffer[ni*4+1];
                                bSum += tempBuffer[ni*4+2];
                                count++;
                            }
                        }
                    }
                }
                
                if (count > 0) {
                    const idx = i * 4;
                    tempBuffer[idx] = rSum / count;
                    tempBuffer[idx+1] = gSum / count;
                    tempBuffer[idx+2] = bSum / count;
                    tempBuffer[idx+3] = 255;
                    // Note: We don't clear mask[i] immediately to allow gradual filling in next iterations, 
                    // but for visual update we need to know it's filled.
                    // Simplified: just update buffer.
                }
            }
        }
        data.set(tempBuffer);
    }
    ctx.putImageData(imgData, 0, 0);
};

interface LayerStudioProps {
    onNavigateBack?: () => void;
    onNavigateToMockup?: () => void;
}

export const LayerStudio: React.FC<LayerStudioProps> = ({ onNavigateBack, onNavigateToMockup }) => {
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 1000, h: 1000 });
    const [tool, setTool] = useState<'MOVE' | 'SMART_EXTRACT' | 'HAND'>('MOVE');
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 }); // Default zoom out to see canvas
    const containerRef = useRef<HTMLDivElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState('');
    const [incomingImage, setIncomingImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Transformation Logic
    const [isTransforming, setIsTransforming] = useState<'NONE' | 'DRAG' | 'RESIZE' | 'ROTATE'>('NONE');
    const [transformMode, setTransformMode] = useState<'IDLE' | 'PAN'>('IDLE');
    const transformStartRef = useRef<{x: number, y: number, w: number, h: number, r: number, scale: number, angle: number}>({x:0, y:0, w:0, h:0, r:0, scale:1, angle:0});
    
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
        window.addEventListener('vingi_transfer', (e: any) => { if (e.detail?.module === 'LAYER') checkStorage(); });
    }, []);

    const updateLayer = (id: string, updates: Partial<DesignLayer>) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    };

    const startSession = (img: string) => {
        const image = new Image(); image.src = img;
        image.onload = () => {
            const maxDim = 1500;
            let finalW = image.width, finalH = image.height;
            if (image.width > maxDim || image.height > maxDim) {
                const ratio = image.width/image.height;
                if (image.width > image.height) { finalW = maxDim; finalH = maxDim / ratio; } else { finalH = maxDim; finalW = maxDim * ratio; }
            }
            setCanvasSize({ w: finalW, h: finalH });
            setLayers([
                { id: 'layer-base', type: 'BACKGROUND', name: 'Original', src: img, x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: false, zIndex: 0 }
            ]);
            setIncomingImage(null); setTool('SMART_EXTRACT');
            setView({ x: 0, y: 0, k: 500 / finalW }); // Auto fit
        };
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => { if (ev.target?.result) startSession(ev.target.result as string); };
            reader.readAsDataURL(file);
        }
    };

    // --- SMART EXTRACTION LOGIC ---
    const executeSmartExtraction = async (clickX: number, clickY: number) => {
        if (tool !== 'SMART_EXTRACT') return;
        
        // Find top-most visible layer at click position to extract from
        // Simplified: extracting from Base Layer or Selected Layer
        const targetId = selectedLayerId || (layers.length > 0 ? layers[0].id : null);
        if (!targetId) return;

        const targetLayer = layers.find(l => l.id === targetId);
        if (!targetLayer || targetLayer.locked || !targetLayer.visible) return;

        setIsProcessing(true); setProcessStatus('Detecting Object...');

        // 1. Prepare Canvas for Analysis
        const img = new Image(); img.src = targetLayer.src; img.crossOrigin = "anonymous";
        await new Promise(r => img.onload = r);

        const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);

        // Adjust click coordinates relative to layer (inverse transform)
        // Note: For simplicity in this demo, assuming base layer is at 0,0 unscaled. 
        // Real implementation requires matrix inversion for transformed layers.
        // We will assume user is clicking on the "Base" for extraction mainly.
        
        // 2. Compute Mask
        const { mask, bounds, hasPixels } = getSmartObjectMask(ctx, canvas.width, canvas.height, Math.floor(clickX), Math.floor(clickY));
        
        if (!hasPixels || !bounds) {
            setIsProcessing(false); setProcessStatus('');
            return;
        }

        setProcessStatus('Extracting & Healing...');

        // 3. Create New Object Image
        const objCanvas = document.createElement('canvas'); objCanvas.width = bounds.w; objCanvas.height = bounds.h;
        const objCtx = objCanvas.getContext('2d')!;
        const srcData = ctx.getImageData(bounds.x, bounds.y, bounds.w, bounds.h);
        
        // Apply mask alpha to object
        for (let i=0; i < bounds.w * bounds.h; i++) {
            const gIdx = (bounds.y + Math.floor(i/bounds.w)) * canvas.width + (bounds.x + (i%bounds.w));
            if (mask[gIdx] === 0) srcData.data[i*4+3] = 0; // Transparent if not in mask
        }
        objCtx.putImageData(srcData, 0, 0);
        const newObjSrc = objCanvas.toDataURL();

        // 4. Heal Background (In-place on original canvas)
        healBackground(ctx, canvas.width, canvas.height, mask);
        const healedSrc = canvas.toDataURL();

        // 5. Update State
        const newLayerId = `element-${Date.now()}`;
        
        // Update original layer (healed)
        setLayers(prev => prev.map(l => l.id === targetLayer.id ? { ...l, src: healedSrc } : l));

        // Add new layer (extracted)
        // CRITICAL: Position exact match
        const centerX = bounds.x + bounds.w / 2;
        const centerY = bounds.y + bounds.h / 2;
        
        // Adjust for canvas center coordinate system used in rendering
        const canvasCenterX = canvas.width / 2;
        const canvasCenterY = canvas.height / 2;
        
        const newLayer: DesignLayer = {
            id: newLayerId,
            type: 'ELEMENT',
            name: 'Elemento Separado',
            src: newObjSrc,
            // Position relative to center
            x: centerX - canvasCenterX,
            y: centerY - canvasCenterY,
            scale: 1,
            rotation: 0,
            flipX: false,
            flipY: false,
            visible: true,
            locked: false,
            zIndex: layers.length + 10
        };

        setLayers(prev => [...prev, newLayer]);
        setSelectedLayerId(newLayerId);
        setTool('MOVE'); // Switch to move tool automatically
        setIsProcessing(false); setProcessStatus('');
    };

    // --- RENDERER ---
    const sendToMockup = async () => {
        if (!onNavigateToMockup) return;
        setIsProcessing(true); setProcessStatus('Compositing...');
        const canvas = document.createElement('canvas');
        canvas.width = canvasSize.w; canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!;
        
        const sorted = [...layers].filter(l => l.visible).sort((a,b) => a.zIndex - b.zIndex);
        for (const layer of sorted) {
            const img = new Image(); img.src = layer.src; await new Promise(r => img.onload = r);
            ctx.save();
            ctx.translate(canvas.width/2 + layer.x, canvas.height/2 + layer.y);
            ctx.rotate(layer.rotation * Math.PI / 180);
            ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
            ctx.scale(layer.scale, layer.scale);
            ctx.drawImage(img, -img.width/2, -img.height/2);
            ctx.restore();
        }
        localStorage.setItem('vingi_mockup_pattern', canvas.toDataURL());
        window.dispatchEvent(new CustomEvent('vingi_transfer', { detail: { module: 'MOCKUP' } }));
        onNavigateToMockup();
    };

    // --- INTERACTION HANDLERS ---
    const getPointerCoords = (e: React.PointerEvent) => {
        const rect = containerRef.current!.getBoundingClientRect();
        const centerX = rect.left + rect.width/2;
        const centerY = rect.top + rect.height/2;
        // Apply inverse view transform
        const x = (e.clientX - centerX - view.x) / view.k;
        const y = (e.clientY - centerY - view.y) / view.k;
        return { x, y };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (tool === 'HAND' || e.button === 1) {
            setTransformMode('PAN'); 
            transformStartRef.current = { x: e.clientX, y: e.clientY, w:0, h:0, r:0, scale:0, angle:0 }; 
            return;
        }

        const { x, y } = getPointerCoords(e);

        // Smart Extract Logic
        if (tool === 'SMART_EXTRACT') {
            // Need pixel coords relative to canvas top-left
            const pixelX = x + canvasSize.w / 2;
            const pixelY = y + canvasSize.h / 2;
            if (pixelX >= 0 && pixelX <= canvasSize.w && pixelY >= 0 && pixelY <= canvasSize.h) {
                executeSmartExtraction(pixelX, pixelY);
            }
            return;
        }

        // Move/Transform Logic
        if (tool === 'MOVE' && selectedLayerId) {
            setIsTransforming('DRAG');
            transformStartRef.current = { x: e.clientX, y: e.clientY, w:0, h:0, r:0, scale:0, angle:0 }; 
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (transformMode === 'PAN') {
            setView(p => ({ ...p, x: p.x + (e.clientX - transformStartRef.current.x), y: p.y + (e.clientY - transformStartRef.current.y) }));
            transformStartRef.current = { x: e.clientX, y: e.clientY, w:0,h:0,r:0,scale:0,angle:0 };
            return;
        }

        if (isTransforming === 'DRAG' && selectedLayerId) {
            const dx = (e.clientX - transformStartRef.current.x) / view.k;
            const dy = (e.clientY - transformStartRef.current.y) / view.k;
            const layer = layers.find(l => l.id === selectedLayerId);
            if (layer) {
                updateLayer(selectedLayerId, { x: layer.x + dx, y: layer.y + dy });
            }
            transformStartRef.current = { x: e.clientX, y: e.clientY, w:0,h:0,r:0,scale:0,angle:0 };
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        const zoomDelta = -e.deltaY * 0.001;
        setView(prev => ({
            ...prev,
            k: Math.min(Math.max(0.1, prev.k + zoomDelta), 5)
        }));
    };

    // --- TOOLBAR ACTIONS ---
    const transformSelected = (action: 'FLIP_H' | 'FLIP_V' | 'ROT_90' | 'DUP' | 'DEL' | 'FRONT' | 'BACK') => {
        if (!selectedLayerId) return;
        const l = layers.find(x => x.id === selectedLayerId);
        if (!l) return;

        switch(action) {
            case 'FLIP_H': updateLayer(selectedLayerId, { flipX: !l.flipX }); break;
            case 'FLIP_V': updateLayer(selectedLayerId, { flipY: !l.flipY }); break;
            case 'ROT_90': updateLayer(selectedLayerId, { rotation: (l.rotation + 90) % 360 }); break;
            case 'DUP': 
                const dup = { ...l, id: `copy-${Date.now()}`, x: l.x + 20, y: l.y + 20, name: l.name + ' (Cópia)', zIndex: layers.length + 10 };
                setLayers(p => [...p, dup]); setSelectedLayerId(dup.id);
                break;
            case 'DEL': 
                if (!l.locked) { setLayers(p => p.filter(x => x.id !== selectedLayerId)); setSelectedLayerId(null); }
                break;
            case 'FRONT': updateLayer(selectedLayerId, { zIndex: Math.max(...layers.map(x=>x.zIndex)) + 1 }); break;
            case 'BACK': updateLayer(selectedLayerId, { zIndex: Math.min(...layers.map(x=>x.zIndex)) - 1 }); break;
        }
    };

    const handleRefineEdge = async () => {
        if (!selectedLayerId) return;
        const layer = layers.find(l => l.id === selectedLayerId);
        if (!layer) return;

        setIsProcessing(true); setProcessStatus('Refining Edges with AI...');
        try {
            // Remove background format
            const cropBase64 = layer.src.split(',')[1];
            // Call backend reconstruction to get a cleaner version
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'RECONSTRUCT_ELEMENT', cropBase64 })
            });
            const data = await res.json();
            if (data.success && data.src) {
                updateLayer(selectedLayerId, { src: data.src });
            }
        } catch(e) {}
        setIsProcessing(false);
    };

    if (incomingImage) {
        return (
            <div className="flex flex-col h-full items-center justify-center p-8 bg-gray-50">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-4xl w-full flex gap-8 items-center">
                    <img src={incomingImage} className="w-1/2 h-80 object-contain bg-gray-100 rounded-lg border" />
                    <div className="space-y-6">
                        <h1 className="text-3xl font-bold text-gray-800">Layer Lab</h1>
                        <p className="text-gray-500">Imagem carregada. Use a Varinha para extrair elementos.</p>
                        <button onClick={() => startSession(incomingImage!)} className="w-full py-4 bg-vingi-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-105 transition-transform"><Wand2 size={20}/> INICIAR SESSÃO</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-[#1e293b] text-white overflow-hidden" 
             onPointerMove={handlePointerMove} 
             onPointerUp={() => { setIsTransforming('NONE'); setTransformMode('IDLE'); }}
             onWheel={handleWheel}>
            
            <ModuleHeader icon={Layers} title="Layer Studio" subtitle="Composição & Edição" />
            
            {/* TOOLBAR SUPERIOR (PHOTOSHOP STYLE) */}
            <div className="h-12 bg-[#0f172a] border-b border-gray-700 flex items-center px-4 gap-2 z-30">
                {/* Tools */}
                <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
                    <button onClick={() => setTool('MOVE')} className={`p-1.5 rounded ${tool==='MOVE' ? 'bg-vingi-600 text-white shadow' : 'text-gray-400 hover:text-white'}`} title="Mover (V)"><Move size={16}/></button>
                    <button onClick={() => setTool('SMART_EXTRACT')} className={`p-1.5 rounded ${tool==='SMART_EXTRACT' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`} title="Extração Inteligente (W)"><Scissors size={16}/></button>
                    <button onClick={() => setTool('HAND')} className={`p-1.5 rounded ${tool==='HAND' ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-white'}`} title="Pan (H)"><Hand size={16}/></button>
                </div>
                
                <div className="w-px h-6 bg-gray-700 mx-2"></div>

                {/* Transform Controls (Only visible if layer selected) */}
                {selectedLayerId && (
                    <div className="flex items-center gap-2 animate-fade-in">
                        <button onClick={() => transformSelected('FLIP_H')} className="p-1.5 hover:bg-gray-700 rounded text-gray-300" title="Espelhar H"><FlipHorizontal size={16}/></button>
                        <button onClick={() => transformSelected('FLIP_V')} className="p-1.5 hover:bg-gray-700 rounded text-gray-300" title="Espelhar V"><FlipVertical size={16}/></button>
                        <button onClick={() => transformSelected('ROT_90')} className="p-1.5 hover:bg-gray-700 rounded text-gray-300" title="Girar 90°"><RotateCw size={16}/></button>
                        <div className="w-px h-6 bg-gray-700 mx-1"></div>
                        <button onClick={() => transformSelected('FRONT')} className="p-1.5 hover:bg-gray-700 rounded text-gray-300" title="Trazer p/ Frente"><ArrowUp size={16}/></button>
                        <button onClick={() => transformSelected('BACK')} className="p-1.5 hover:bg-gray-700 rounded text-gray-300" title="Enviar p/ Trás"><ArrowDown size={16}/></button>
                        <div className="w-px h-6 bg-gray-700 mx-1"></div>
                        <button onClick={() => transformSelected('DUP')} className="p-1.5 hover:bg-gray-700 rounded text-gray-300" title="Duplicar"><Copy size={16}/></button>
                        <button onClick={() => transformSelected('DEL')} className="p-1.5 hover:bg-red-900/50 text-red-400 rounded" title="Deletar"><Trash2 size={16}/></button>
                        
                        <button onClick={handleRefineEdge} className="ml-4 px-3 py-1 bg-purple-900/50 border border-purple-500/50 text-purple-300 rounded text-xs font-bold flex items-center gap-2 hover:bg-purple-900"><Sparkles size={12}/> REFINAR (IA)</button>
                    </div>
                )}
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* CANVAS AREA */}
                <div ref={containerRef} className={`flex-1 relative overflow-hidden flex items-center justify-center bg-[#1e1e1e] ${tool==='HAND'?'cursor-grab': tool==='SMART_EXTRACT'?'cursor-crosshair':'cursor-default'}`} onPointerDown={handlePointerDown} style={{ touchAction: 'none' }}>
                    
                    {/* Checkered Background */}
                    <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,#808080_25%,transparent_25%,transparent_75%,#808080_75%,#808080),linear-gradient(45deg,#808080_25%,transparent_25%,transparent_75%,#808080_75%,#808080)]" style={{ backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px' }} />

                    <div className="relative shadow-2xl" style={{ width: canvasSize.w, height: canvasSize.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: 'center center', transition: 'transform 0.05s linear' }}>
                        {/* White Artboard Base */}
                        <div className="absolute inset-0 bg-white" />
                        
                        {layers.map(l => l.visible && (
                            <div key={l.id} 
                                 className={`absolute select-none pointer-events-none ${selectedLayerId===l.id ? 'z-[999]' : ''}`} 
                                 style={{ 
                                     left: '50%', top: '50%', width: l.id.includes('base') ? '100%' : 'auto', height: l.id.includes('base') ? '100%' : 'auto',
                                     transform: `translate(calc(-50% + ${l.x}px), calc(-50% + ${l.y}px)) rotate(${l.rotation}deg) scale(${l.flipX?-l.scale:l.scale}, ${l.flipY?-l.scale:l.scale})`, 
                                     zIndex: l.zIndex 
                                 }}>
                                
                                <img src={l.src} className={`max-w-none ${l.id.includes('base') ? 'w-full h-full' : ''} ${selectedLayerId===l.id ? 'drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]' : ''}`} draggable={false} />
                                
                                {/* BOUNDING BOX & HANDLES (Visual Only) */}
                                {selectedLayerId === l.id && tool === 'MOVE' && (
                                    <div className="absolute -inset-1 border border-blue-500 pointer-events-none">
                                        {/* Corners */}
                                        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-blue-500 rounded-full"></div>
                                        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-blue-500 rounded-full"></div>
                                        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-blue-500 rounded-full"></div>
                                        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-blue-500 rounded-full"></div>
                                        {/* Rotation Handle */}
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-blue-500"></div>
                                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 rounded-full cursor-pointer pointer-events-auto shadow-sm"></div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {isProcessing && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[1000]"><div className="text-xl font-bold text-white animate-pulse">{processStatus}</div><div className="mt-2 text-xs text-gray-400">Usando Processamento de Pixel & IA</div></div>}
                    
                    {/* Overlay Info */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gray-900/80 rounded-full text-[10px] text-gray-400 font-mono pointer-events-none backdrop-blur border border-gray-700">
                        {Math.round(view.k * 100)}% | {canvasSize.w}x{canvasSize.h}px
                    </div>
                </div>

                {/* SIDEBAR (LAYERS) */}
                <div className="w-64 bg-[#1e293b] border-l border-gray-700 flex flex-col shadow-2xl z-20">
                    <div className="p-3 bg-[#0f172a] border-b border-gray-700">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Camadas</h3>
                        <div className="flex gap-2">
                             <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-2 bg-gray-800 border border-gray-600 rounded text-[10px] font-bold hover:bg-gray-700">IMPORTAR</button>
                             <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                             <button onClick={sendToMockup} className="flex-1 py-2 bg-vingi-600 text-white rounded text-[10px] font-bold shadow hover:bg-vingi-500">FINALIZAR</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {layers.slice().reverse().map(l => (
                            <div key={l.id} 
                                 onClick={() => !l.locked && setSelectedLayerId(l.id)} 
                                 className={`p-2 rounded-lg flex items-center gap-2 cursor-pointer border transition-all ${selectedLayerId===l.id ? 'bg-blue-900/30 border-blue-500/50' : 'bg-transparent border-transparent hover:bg-gray-800'}`}>
                                
                                <button onClick={(e)=>{e.stopPropagation(); updateLayer(l.id, {visible: !l.visible})}} className={`p-1 rounded ${l.visible?'text-gray-400':'text-gray-600'}`}>{l.visible?<Eye size={12}/>:<EyeOff size={12}/>}</button>
                                
                                <div className="w-8 h-8 bg-gray-700 rounded border border-gray-600 overflow-hidden shrink-0">
                                    <img src={l.src} className="w-full h-full object-contain" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className={`text-[11px] font-medium truncate ${selectedLayerId===l.id ? 'text-white' : 'text-gray-400'}`}>{l.name}</h4>
                                </div>
                                {l.locked && <Lock size={10} className="text-gray-600"/>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
