
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layers, Move, Trash2, Eye, EyeOff, Lock, Unlock, Wand2, Download, Image as ImageIcon, Sparkles, Loader2, RotateCw, ZoomIn, Info, UploadCloud, ArrowRight, Shirt, MousePointer2, Scissors, PaintBucket, Sliders, Scan, Copy, ChevronRight, Check, Grid, RefreshCw, Hand, Maximize, Minus, Plus } from 'lucide-react';
import { DesignLayer } from '../types';

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

// --- MODULE 2: THE SELECTOR (Advanced Masking) ---
interface SelectionResult {
    mask: Uint8Array;
    bounds: { x: number, y: number, w: number, h: number } | null;
    blobs: { x: number, y: number, w: number, h: number, pixels: number[] }[]; 
}

const getSmartMask = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    startX: number, 
    startY: number, 
    tolerance: number,
    mode: 'CONTIGUOUS' | 'GLOBAL'
): SelectionResult => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const visited = new Uint8Array(width * height);
    const mask = new Uint8Array(width * height);
    
    // Target Color
    const p = (startY * width + startX) * 4;
    // Safety check for bounds
    if (p < 0 || p >= data.length) return { mask, bounds: null, blobs: [] };

    if (data[p + 3] === 0) return { mask, bounds: null, blobs: [] };
    const [l0, a0, b0] = rgbToLab(data[p], data[p+1], data[p+2]);

    const isSimilar = (idx: number) => {
        const pos = idx * 4;
        if (data[pos+3] === 0) return false;
        const [l, a, b] = rgbToLab(data[pos], data[pos+1], data[pos+2]);
        const dist = Math.sqrt((l-l0)**2 + (a-a0)**2 + (b-b0)**2);
        return dist < tolerance;
    };

    const allMatchingPixels: number[] = [];
    if (mode === 'GLOBAL') {
        for(let i=0; i<width*height; i++) {
            if (isSimilar(i)) {
                mask[i] = 255;
                allMatchingPixels.push(i);
            }
        }
    } else {
        const stack = [[startX, startY]];
        while (stack.length) {
            const [x, y] = stack.pop()!;
            const idx = y * width + x;
            if (visited[idx]) continue;
            visited[idx] = 1;

            if (isSimilar(idx)) {
                mask[idx] = 255;
                allMatchingPixels.push(idx);
                if (x > 0) stack.push([x - 1, y]);
                if (x < width - 1) stack.push([x + 1, y]);
                if (y > 0) stack.push([x, y - 1]);
                if (y < height - 1) stack.push([x, y + 1]);
            }
        }
    }

    // Blob Detection
    const blobs: { x: number, y: number, w: number, h: number, pixels: number[] }[] = [];
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
                const x = idx % width; const y = Math.floor(idx / width);
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;

                const neighbors = [idx-1, idx+1, idx-width, idx+width]; 
                for (const n of neighbors) {
                    if (n >= 0 && n < width*height && mask[n] === 255 && !blobVisited[n]) {
                        stack.push(n);
                    }
                }
            }
        }

        if (blobPixels.length > 20) { 
             blobs.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, pixels: blobPixels });
        }
    }

    let minX=width, maxX=0, minY=height, maxY=0;
    if (allMatchingPixels.length > 0) {
        for(const blob of blobs) {
            if (blob.x < minX) minX = blob.x;
            if (blob.x + blob.w > maxX) maxX = blob.x + blob.w;
            if (blob.y < minY) minY = blob.y;
            if (blob.y + blob.h > maxY) maxY = blob.y + blob.h;
        }
    }

    return { 
        mask, 
        bounds: allMatchingPixels.length ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null,
        blobs 
    };
};

// --- MODULE 3: THE HEALER (Canvas Texture Diffusion) ---
const healBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, mask: Uint8Array) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const damageMask = new Uint8Array(mask); 
    
    // Aggressive Inpainting (Multi-pass diffusion)
    const iterations = 20; // More iterations for better healing
    for (let it = 0; it < iterations; it++) {
        const nextData = new Uint8ClampedArray(data);
        let filledCount = 0;

        for (let i = 0; i < width * height; i++) {
            if (damageMask[i] > 0 || data[i * 4 + 3] === 0) { 
                let r=0, g=0, b=0, count=0;
                // Expanding radius search for texture cloning
                const dist = (it % 8) + 3; 
                const x = i % width; const y = Math.floor(i / width);

                // Spiral sampling (more organic)
                for (let angle=0; angle<Math.PI*2; angle+=0.5) {
                    const nx = Math.floor(x + Math.cos(angle + it) * dist);
                    const ny = Math.floor(y + Math.sin(angle + it) * dist);
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const ni = ny * width + nx;
                        if (damageMask[ni] === 0 && data[ni*4+3] > 0) {
                             r += data[ni*4]; g += data[ni*4+1]; b += data[ni*4+2]; count++;
                        }
                    }
                }

                if (count > 0) {
                    nextData[i*4] = r/count; nextData[i*4+1] = g/count; nextData[i*4+2] = b/count; nextData[i*4+3] = 255;
                    damageMask[i] = 0; // Healed
                    filledCount++;
                }
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
    for(let i=0; i<d.length; i+=4) {
        if (d[i] > 230 && d[i+1] > 230 && d[i+2] > 230) { d[i+3] = 0; }
    }
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
    
    // Tools
    const [tool, setTool] = useState<'MOVE' | 'MAGIC_WAND' | 'HAND'>('MOVE');
    const [wandTolerance, setWandTolerance] = useState(25);
    
    // Viewport Transform (Zoom/Pan)
    const [view, setView] = useState({ x: 0, y: 0, k: 1 });
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Process State
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState('');
    const [progress, setProgress] = useState(0);

    const [incomingImage, setIncomingImage] = useState<string | null>(null);
    const [transformMode, setTransformMode] = useState<'IDLE' | 'DRAG' | 'ROTATE' | 'SCALE' | 'PAN'>('IDLE');
    const [startInteraction, setStartInteraction] = useState<{x: number, y: number, val: number} | null>(null);

    // Modal State
    const [pendingSelection, setPendingSelection] = useState<{ layerId: string, startX: number, startY: number } | null>(null);
    const [transformPrompt, setTransformPrompt] = useState('');
    const [showTransformModal, setShowTransformModal] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Refs for Gestures
    const lastPinchDist = useRef(0);
    const lastPinchCenter = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const sourceImage = localStorage.getItem('vingi_layer_studio_source');
        if (sourceImage) {
            setIncomingImage(sourceImage);
            localStorage.removeItem('vingi_layer_studio_source');
        }
    }, []);

    // Helper: updateLayer
    const updateLayer = (id: string, updates: Partial<DesignLayer>) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    };

    // Helper: handleFileUpload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    startSession(ev.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // Helper: sendToMockup
    const sendToMockup = async () => {
        if (!onNavigateToMockup) return;
        setIsProcessing(true);
        setProcessStatus('Renderizando composição...');
        
        try {
            const canvas = document.createElement('canvas');
            canvas.width = canvasSize.w;
            canvas.height = canvasSize.h;
            const ctx = canvas.getContext('2d')!;

            // Sort layers by zIndex
            const sorted = [...layers].filter(l => l.visible).sort((a,b) => a.zIndex - b.zIndex);

            for (const layer of sorted) {
                const img = new Image();
                img.src = layer.src;
                img.crossOrigin = "anonymous";
                await new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });

                ctx.save();
                ctx.translate(canvas.width/2 + layer.x, canvas.height/2 + layer.y);
                ctx.rotate(layer.rotation * Math.PI / 180);
                ctx.scale(layer.scale, layer.scale);
                ctx.drawImage(img, -img.width/2, -img.height/2);
                ctx.restore();
            }

            const dataUrl = canvas.toDataURL('image/png');
            localStorage.setItem('vingi_mockup_pattern', dataUrl);
            onNavigateToMockup();
        } catch (e) {
            console.error("Failed to export", e);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- NON-DESTRUCTIVE SETUP ---
    const startSession = (img: string) => {
        // Load image to get dimensions
        const image = new Image();
        image.src = img;
        image.onload = () => {
            const w = image.width;
            const h = image.height;
            // Limit canvas size for performance but keep aspect ratio
            const maxDim = 1200;
            let finalW = w, finalH = h;
            if (w > maxDim || h > maxDim) {
                const ratio = w/h;
                if (w > h) { finalW = maxDim; finalH = maxDim / ratio; }
                else { finalH = maxDim; finalW = maxDim * ratio; }
            }
            
            setCanvasSize({ w: finalW, h: finalH });
            
            setLayers([
                // Layer 0: Original (Locked reference)
                {
                    id: 'layer-original', type: 'BACKGROUND', name: 'Original (Ref)',
                    src: img, x: 0, y: 0, scale: 1, rotation: 0, visible: true, locked: true, zIndex: 0
                },
                // Layer 1: Working Copy (Editable)
                {
                    id: 'layer-base', type: 'BACKGROUND', name: 'Base Editável',
                    src: img, x: 0, y: 0, scale: 1, rotation: 0, visible: true, locked: false, zIndex: 1
                }
            ]);
            setIncomingImage(null);
            setTool('MAGIC_WAND');
            // Center View
            // setView({ x: (window.innerWidth - finalW)/2, y: (window.innerHeight - finalH)/2, k: 0.8 });
        };
    };

    // --- ENGINE: SEPARATION LOGIC ---
    const executeSeparation = async (mode: 'ONE' | 'ALL') => {
        if (!pendingSelection) return;
        const { layerId, startX, startY } = pendingSelection;
        setPendingSelection(null);
        setIsProcessing(true);
        setProgress(5);

        const targetLayer = layers.find(l => l.id === layerId);
        if (!targetLayer) return;

        // 1. Prepare Canvas
        const img = new Image(); img.src = targetLayer.src;
        await new Promise(r => img.onload = r);
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        // 2. Select
        setProcessStatus('Escaneando Objeto...');
        const scanMode = mode === 'ALL' ? 'GLOBAL' : 'CONTIGUOUS';
        const { mask, blobs } = getSmartMask(ctx, canvas.width, canvas.height, startX, startY, wandTolerance, scanMode);

        if (blobs.length === 0) {
            setIsProcessing(false); return;
        }

        // 3. PARALLEL BATCH PROCESSING (Turbo Mode)
        setProcessStatus(`Extraindo ${blobs.length} elementos...`);
        const newLayersAdded: DesignLayer[] = [];
        const fullDamageMask = new Uint8Array(canvas.width * canvas.height);

        // Process blobs in chunks to allow UI updates, but parallel requests
        const CHUNK_SIZE = 4; // 4 Parallel AI requests
        
        for (let i = 0; i < blobs.length; i += CHUNK_SIZE) {
            const chunk = blobs.slice(i, i + CHUNK_SIZE);
            const chunkPromises = chunk.map(async (blob, idx) => {
                const globalIdx = i + idx;
                
                // 3a. Extract Crop
                const objCanvas = document.createElement('canvas');
                objCanvas.width = blob.w; objCanvas.height = blob.h;
                const objCtx = objCanvas.getContext('2d')!;
                const blobPixels = new Set(blob.pixels);
                const srcData = ctx.getImageData(blob.x, blob.y, blob.w, blob.h);
                
                for(let y=0; y<blob.h; y++) {
                    for(let x=0; x<blob.w; x++) {
                        const gIdx = (blob.y + y) * canvas.width + (blob.x + x);
                        if (!blobPixels.has(gIdx)) {
                            srcData.data[(y*blob.w + x)*4 + 3] = 0;
                        } else {
                            fullDamageMask[gIdx] = 255; // Mark hole
                        }
                    }
                }
                objCtx.putImageData(srcData, 0, 0);
                
                // 3b. AI Reconstruction
                const rawCrop = objCanvas.toDataURL();
                const base64Crop = rawCrop.split(',')[1];
                let finalSrc = rawCrop;
                let finalName = `Elemento ${globalIdx+1}`;
                
                try {
                    const aiRes = await fetch('/api/analyze', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ action: 'RECONSTRUCT_ELEMENT', cropBase64: base64Crop })
                    });
                    const aiData = await aiRes.json();
                    if (aiData.success && aiData.src) {
                        const aiImg = new Image(); aiImg.src = aiData.src;
                        await new Promise(r => aiImg.onload = r);
                        finalSrc = removeWhiteBackground(aiImg);
                        finalName = aiData.name || finalName;
                    }
                } catch (e) {
                    console.warn("AI fail", e);
                }

                // 3c. Position
                const origCenterX = canvas.width / 2;
                const origCenterY = canvas.height / 2;
                const objCenterX = blob.x + blob.w / 2;
                const objCenterY = blob.y + blob.h / 2;
                const deltaX = objCenterX - origCenterX;
                const deltaY = objCenterY - origCenterY;
                const rad = (targetLayer.rotation * Math.PI) / 180;
                const rotX = deltaX * Math.cos(rad) - deltaY * Math.sin(rad);
                const rotY = deltaX * Math.sin(rad) + deltaY * Math.cos(rad);

                return {
                    id: `obj-${Date.now()}-${globalIdx}`,
                    type: 'ELEMENT',
                    name: finalName,
                    src: finalSrc,
                    x: targetLayer.x + (rotX * targetLayer.scale),
                    y: targetLayer.y + (rotY * targetLayer.scale),
                    scale: targetLayer.scale,
                    rotation: targetLayer.rotation,
                    visible: true, locked: false, 
                    zIndex: layers.length + 10 + globalIdx
                } as DesignLayer;
            });

            // Wait for this chunk
            const processedChunk = await Promise.all(chunkPromises);
            newLayersAdded.push(...processedChunk);
            
            // Update Progress
            const currentCount = Math.min(blobs.length, i + CHUNK_SIZE);
            setProgress(Math.round((currentCount / blobs.length) * 80));
            setProcessStatus(`Processado ${currentCount} de ${blobs.length}...`);
        }

        // 4. HEAL BACKGROUND (Single Pass for all holes)
        if (!targetLayer.locked) {
            setProcessStatus('Regenerando Fundo (Texture Diffusion)...');
            healBackground(ctx, canvas.width, canvas.height, fullDamageMask);
            const newBgSrc = canvas.toDataURL();
            setLayers(prev => prev.map(l => l.id === layerId ? { ...l, src: newBgSrc } : l).concat(newLayersAdded));
        } else {
            setLayers(prev => prev.concat(newLayersAdded));
        }
        setProgress(100);

        setTool('MOVE');
        setSelectedLayerId(newLayersAdded.length > 0 ? newLayersAdded[0].id : null);
        setIsProcessing(false);
        setProcessStatus('');
        setProgress(0);
    };

    // --- TRANSFORM & ZOOM LOGIC ---
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) { // Zoom
            e.preventDefault();
            const scaleChange = -e.deltaY * 0.001;
            const newScale = Math.min(Math.max(0.1, view.k + scaleChange), 5);
            setView(prev => ({ ...prev, k: newScale }));
        } else { // Pan (if shift) or Scroll
             // Optional: Handle pan on wheel
        }
    };

    const getLocalCoords = (clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 }; // FIXED: Use containerRef
        const rect = containerRef.current.getBoundingClientRect();
        
        // Let's use simpler logic: 
        // 1. Get click relative to center of screen (viewport)
        // 2. Adjust for view.x/y and view.k
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const relX = (clientX - centerX - view.x) / view.k;
        const relY = (clientY - centerY - view.y) / view.k;
        
        return { x: relX, y: relY }; // Relative to center of canvas
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        // Multi-touch logic handled by specific touch listeners usually, but for unified pointer:
        // For simplicity in this codebase, we use basic logic.
        
        // Check for Middle Mouse or Spacebar -> Pan
        if (e.button === 1 || tool === 'HAND' || e.buttons === 4) {
            setTransformMode('PAN');
            setStartInteraction({ x: e.clientX, y: e.clientY, val: 0 });
            e.preventDefault();
            return;
        }

        const { x, y } = getLocalCoords(e.clientX, e.clientY);

        if (tool === 'MAGIC_WAND') {
            // Find clicked layer (Topmost visible unlocked)
            // Reverse layers to hit check top first
            const sorted = [...layers].sort((a,b) => b.zIndex - a.zIndex);
            
            for (const layer of sorted) {
                if (!layer.visible || layer.locked) continue; // Skip locked layers (Layer 0)
                
                // Simple Bounds check (Visual only, exact pixel check happens in executeSeparation)
                // Assuming layer is roughly centered at its X/Y.
                // We need to inverse transform the point to layer local space.
                // For selection, we just pick the layer ID and normalized relative click.
                
                // Rough Hit Test:
                const dx = x - layer.x;
                const dy = y - layer.y;
                // De-rotate
                const rad = -layer.rotation * Math.PI / 180;
                const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
                const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
                // De-scale
                const lx = rx / layer.scale;
                const ly = ry / layer.scale;

                // We don't know exact WH yet without checking image, but we can assume click is intended for this layer if it's "close enough" 
                // or we rely on the visual DOM element's BoundingBox check which is easier.
            }
            // For now, let the DOM `onMouseDown` on the layer element handle selection.
            // But we need to handle clicks on the background canvas too.
        } else if (tool === 'MOVE') {
             // Logic handled by Layer Element
             // If clicking empty space, maybe Deselect?
             if (e.target === e.currentTarget) setSelectedLayerId(null);
        }
    };

    const handleGlobalMove = (e: React.PointerEvent) => {
        if (transformMode === 'PAN' && startInteraction) {
            const dx = e.clientX - startInteraction.x;
            const dy = e.clientY - startInteraction.y;
            setView(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setStartInteraction({ x: e.clientX, y: e.clientY, val: 0 });
            return;
        }
        
        if (transformMode === 'DRAG' && selectedLayerId && startInteraction) {
            const layer = layers.find(l => l.id === selectedLayerId);
            if (!layer) return;
            // Adjust dx/dy by zoom level
            const dx = (e.clientX - startInteraction.x) / view.k;
            const dy = (e.clientY - startInteraction.y) / view.k;
            
            updateLayer(selectedLayerId, { x: layer.x + dx, y: layer.y + dy });
            setStartInteraction({ x: e.clientX, y: e.clientY, val: 0 });
        }
    };

    const handleLayerMouseDown = (e: React.MouseEvent, layerId: string) => {
        if (tool === 'HAND') return;
        
        if (tool === 'MAGIC_WAND') {
             e.stopPropagation();
             const layerEl = e.currentTarget.getBoundingClientRect();
             const relX = (e.clientX - layerEl.left) / layerEl.width;
             const relY = (e.clientY - layerEl.top) / layerEl.height;
             
             const layer = layers.find(l => l.id === layerId);
             if (layer && !layer.locked) {
                 const img = new Image(); img.src = layer.src;
                 // Need actual pixels if loaded
                 setPendingSelection({
                     layerId,
                     startX: Math.floor(relX * (img.width || 1000)),
                     startY: Math.floor(relY * (img.height || 1000))
                 });
             }
             return;
        }

        if (tool === 'MOVE') {
            e.stopPropagation();
            setSelectedLayerId(layerId);
            setTransformMode('DRAG');
            setStartInteraction({ x: e.clientX, y: e.clientY, val: 0 });
        }
    };

    // --- RENDER ---
    if (incomingImage) {
        return (
            <div className="flex flex-col h-full items-center justify-center p-8 bg-gray-50">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-4xl w-full flex gap-8 items-center">
                    <img src={incomingImage} className="w-1/2 h-80 object-contain bg-gray-100 rounded-lg border" />
                    <div className="space-y-6">
                        <h1 className="text-3xl font-bold text-gray-800">Layer Lab 2.0</h1>
                        <p className="text-gray-500">
                            A imagem será duplicada para preservação. Use a Varinha para separar elementos e a IA reconstruirá o que estiver escondido.
                        </p>
                        <button onClick={() => startSession(incomingImage!)} className="w-full py-4 bg-vingi-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-105 transition-transform">
                            <Wand2 size={20}/> INICIAR SESSÃO
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-[#1e293b] text-white overflow-hidden" 
            onPointerMove={handleGlobalMove} 
            onPointerUp={() => { setTransformMode('IDLE'); setStartInteraction(null); }}
            onWheel={handleWheel}
        >
            
            {/* WORKSPACE */}
            <div 
                ref={containerRef}
                className={`flex-1 relative overflow-hidden flex items-center justify-center bg-[#0f172a] ${tool==='HAND'?'cursor-grab':''}`} 
                onPointerDown={handlePointerDown}
                style={{ touchAction: 'none' }}
            >
                 {/* GRID BG */}
                 <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px]" 
                      style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
                 />
                 
                 {/* TRANSFORM WRAPPER */}
                 <div 
                    className="relative shadow-2xl transition-transform duration-75 ease-out"
                    style={{ 
                        width: canvasSize.w, 
                        height: canvasSize.h,
                        transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
                        transformOrigin: 'center center'
                    }}
                 >
                    {/* CANVAS BG */}
                    <div className="absolute inset-0 bg-white/5 border border-white/10" />

                    {layers.map(l => l.visible && (
                        <div key={l.id} id={`layer-visual-${l.id}`}
                            className={`absolute select-none group ${selectedLayerId===l.id ? 'z-[999]' : ''}`}
                            style={{ 
                                left: '50%', top: '50%',
                                width: '100%', height: '100%', // Assume wrapper size for bg
                                transform: `translate(calc(-50% + ${l.x}px), calc(-50% + ${l.y}px)) rotate(${l.rotation}deg) scale(${l.scale})`,
                                zIndex: l.zIndex,
                                pointerEvents: l.type === 'BACKGROUND' && l.locked ? 'none' : 'auto'
                            }}
                            onMouseDown={(e) => handleLayerMouseDown(e, l.id)}
                        >
                            <img src={l.src} className={`w-full h-full object-contain pointer-events-none ${selectedLayerId===l.id && tool!=='MAGIC_WAND' ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : ''}`} />
                            
                            {/* BOUNDING BOX */}
                            {selectedLayerId===l.id && tool==='MOVE' && !l.locked && (
                                <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none">
                                    <div className="absolute -top-3 -left-3 w-6 h-6 bg-blue-500 rounded-full shadow cursor-pointer flex items-center justify-center pointer-events-auto" 
                                         onMouseDown={(e)=>{e.stopPropagation(); updateLayer(l.id, {rotation: l.rotation-15})}}><RotateCw size={12}/></div>
                                </div>
                            )}
                        </div>
                    ))}
                 </div>

                 {/* ZOOM CONTROLS (Floating) */}
                 <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-gray-900/90 backdrop-blur px-4 py-2 rounded-full border border-gray-700 shadow-xl z-[100]">
                    <button onClick={() => setView(p => ({...p, k: Math.max(0.1, p.k-0.1)}))}><Minus size={16}/></button>
                    <span className="text-xs font-mono w-12 text-center">{Math.round(view.k*100)}%</span>
                    <button onClick={() => setView(p => ({...p, k: Math.min(5, p.k+0.1)}))}><Plus size={16}/></button>
                    <div className="w-px h-4 bg-gray-600 mx-2"></div>
                    <button onClick={() => setView({x:0, y:0, k: 0.8})} title="Fit to Screen"><Maximize size={16}/></button>
                 </div>

                 {/* SELECTION MODAL */}
                 {pendingSelection && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-gray-800 p-6 rounded-2xl shadow-2xl z-[100] w-80 animate-fade-in border border-gray-200">
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Scan size={20} className="text-purple-600"/> Smart Extract</h3>
                            <p className="text-sm text-gray-500 mb-6">A IA irá recortar e reconstruir partes ocultas.</p>
                            
                            <div className="space-y-3">
                                <button onClick={() => executeSeparation('ONE')} className="w-full p-3 bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-200 rounded-xl flex items-center gap-3 transition-colors text-left group">
                                    <div className="bg-purple-100 p-2 rounded-lg text-purple-600"><MousePointer2 size={18}/></div>
                                    <div>
                                        <div className="font-bold text-sm text-gray-800">Extrair Este Elemento</div>
                                        <div className="text-[10px] text-gray-400">Remove e preenche o fundo.</div>
                                    </div>
                                    <ChevronRight size={16} className="ml-auto text-gray-300 group-hover:text-purple-500"/>
                                </button>
                                
                                <button onClick={() => executeSeparation('ALL')} className="w-full p-3 bg-gray-50 hover:bg-vingi-50 border border-gray-200 hover:border-vingi-200 rounded-xl flex items-center gap-3 transition-colors text-left group">
                                    <div className="bg-vingi-100 p-2 rounded-lg text-vingi-600"><Copy size={18}/></div>
                                    <div>
                                        <div className="font-bold text-sm text-gray-800">Extrair Todos Iguais</div>
                                        <div className="text-[10px] text-gray-400">Processamento Paralelo (Rápido).</div>
                                    </div>
                                    <ChevronRight size={16} className="ml-auto text-gray-300 group-hover:text-vingi-500"/>
                                </button>
                            </div>
                            <button onClick={() => setPendingSelection(null)} className="mt-4 w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600">Cancelar</button>
                        </div>
                 )}

                 {/* LOADING OVERLAY */}
                 {isProcessing && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-[110]">
                        <div className="relative w-24 h-24 mb-6">
                            <svg className="w-full h-full" viewBox="0 0 100 100">
                                <circle className="text-gray-800 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"></circle>
                                <circle className="text-vingi-500 progress-ring__circle stroke-current transition-all duration-300" strokeWidth="8" strokeLinecap="round" cx="50" cy="50" r="40" fill="transparent" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * progress) / 100}></circle>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-white">{progress}%</div>
                        </div>
                        <div className="text-xl font-bold text-white animate-pulse">{processStatus}</div>
                        <div className="mt-2 text-xs text-gray-500 font-mono">Motor de Reconstrução IA Ativo</div>
                    </div>
                 )}
            </div>

            {/* SIDEBAR */}
            <div className="w-80 bg-[#1e293b] border-l border-gray-700 flex flex-col shadow-2xl z-20">
                <div className="p-4 bg-[#0f172a] border-b border-gray-700 space-y-4">
                    <h2 className="font-bold flex items-center gap-2"><Layers size={18} className="text-vingi-500"/> Layer Lab 2.0</h2>
                    
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-gray-800 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 hover:text-white transition-colors text-xs font-bold flex items-center justify-center gap-2">
                        <UploadCloud size={14}/> NOVO PROJETO
                    </button>
                    
                    <div className="flex bg-gray-800 p-1 rounded-lg">
                        <button onClick={() => setTool('MOVE')} className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 ${tool==='MOVE' ? 'bg-vingi-600 shadow' : 'text-gray-400'}`}><Move size={14}/> Mover</button>
                        <button onClick={() => setTool('MAGIC_WAND')} className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 ${tool==='MAGIC_WAND' ? 'bg-purple-600 shadow' : 'text-gray-400'}`}><Wand2 size={14}/> Varinha</button>
                        <button onClick={() => setTool('HAND')} className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 ${tool==='HAND' ? 'bg-gray-600 shadow text-white' : 'text-gray-400'}`}><Hand size={14}/></button>
                    </div>

                    {tool === 'MAGIC_WAND' && (
                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 space-y-2 animate-fade-in">
                            <label className="flex justify-between text-[10px] text-gray-300"><span>Tolerância Visual</span> <span>{wandTolerance}%</span></label>
                            <input type="range" min="5" max="100" value={wandTolerance} onChange={(e) => setWandTolerance(Number(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"/>
                        </div>
                    )}

                    <button onClick={sendToMockup} className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg font-bold text-sm shadow-lg flex items-center justify-center gap-2">
                        <Shirt size={16}/> ENVIAR P/ PROVADOR
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {layers.slice().reverse().map(l => (
                        <div key={l.id} onClick={() => setSelectedLayerId(l.id)} className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer border transition-all ${selectedLayerId===l.id ? 'bg-vingi-900/50 border-vingi-500/50' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
                            <div className="w-10 h-10 bg-gray-900 rounded overflow-hidden shrink-0 border border-gray-600 relative">
                                <img src={l.src} className="w-full h-full object-contain" />
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/checkerboard-crosshairs.png')] opacity-20"/>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-gray-200 truncate">{l.name}</h4>
                                <span className="text-[9px] text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded uppercase">{l.type==='BACKGROUND'?(l.locked?'Original':'Fundo Editado'):'Elemento'}</span>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={(e)=>{e.stopPropagation(); updateLayer(l.id, {visible: !l.visible})}} className="p-1.5 text-gray-400 hover:text-white rounded">{l.visible?<Eye size={12}/>:<EyeOff size={12}/>}</button>
                                {l.locked ? <Lock size={12} className="p-1.5 text-gray-500"/> : <button onClick={(e)=>{e.stopPropagation(); setLayers(prev=>prev.filter(x=>x.id!==l.id))}} className="p-1.5 text-gray-400 hover:text-red-400 rounded"><Trash2 size={12}/></button>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
