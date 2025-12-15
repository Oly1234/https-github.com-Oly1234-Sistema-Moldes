
import React, { useState, useRef, useEffect } from 'react';
import { Layers, Move, Trash2, Eye, EyeOff, Lock, Unlock, Wand2, Download, Image as ImageIcon, Sparkles, Loader2, RotateCw, ZoomIn, Info, UploadCloud, ArrowRight, Shirt, MousePointer2, Scissors, PaintBucket, Sliders, Scan, Copy, ChevronRight, Check, Grid, RefreshCw } from 'lucide-react';
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
    blobs: { x: number, y: number, w: number, h: number, pixels: number[] }[]; // List of detected separated objects
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
    if (data[p + 3] === 0) return { mask, bounds: null, blobs: [] };
    const [l0, a0, b0] = rgbToLab(data[p], data[p+1], data[p+2]);

    const isSimilar = (idx: number) => {
        const pos = idx * 4;
        if (data[pos+3] === 0) return false;
        const [l, a, b] = rgbToLab(data[pos], data[pos+1], data[pos+2]);
        const dist = Math.sqrt((l-l0)**2 + (a-a0)**2 + (b-b0)**2);
        return dist < tolerance;
    };

    // Global scanning for all matches
    const allMatchingPixels: number[] = [];
    if (mode === 'GLOBAL') {
        for(let i=0; i<width*height; i++) {
            if (isSimilar(i)) {
                mask[i] = 255;
                allMatchingPixels.push(i);
            }
        }
    } else {
        // Flood Fill for Contiguous
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

    // Blob Detection (Grouping connected pixels into objects)
    // Used to separate "All Identical" into distinct layer objects
    const blobs: { x: number, y: number, w: number, h: number, pixels: number[] }[] = [];
    const blobVisited = new Uint8Array(width * height);

    for (const pixelIdx of allMatchingPixels) {
        if (blobVisited[pixelIdx]) continue;
        
        // Start new blob
        const blobPixels: number[] = [];
        const stack = [pixelIdx];
        let minX = width, maxX = 0, minY = height, maxY = 0;

        while(stack.length) {
            const idx = stack.pop()!;
            if (blobVisited[idx]) continue;
            blobVisited[idx] = 1;
            
            // If pixel is in our mask
            if (mask[idx] === 255) {
                blobPixels.push(idx);
                const x = idx % width; const y = Math.floor(idx / width);
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;

                // Check neighbors (8-way for robustness)
                const neighbors = [idx-1, idx+1, idx-width, idx+width]; // Simplified 4-way
                for (const n of neighbors) {
                    if (n >= 0 && n < width*height && mask[n] === 255 && !blobVisited[n]) {
                        stack.push(n);
                    }
                }
            }
        }

        if (blobPixels.length > 20) { // Filter noise
             blobs.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, pixels: blobPixels });
        }
    }

    // Overall bounds
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
    const iterations = 15;
    for (let it = 0; it < iterations; it++) {
        const nextData = new Uint8ClampedArray(data);
        let filledCount = 0;

        for (let i = 0; i < width * height; i++) {
            if (damageMask[i] > 0 || data[i * 4 + 3] === 0) { 
                let r=0, g=0, b=0, count=0;
                // Variable sampling radius
                const dist = (it % 4) + 2; 
                const x = i % width; const y = Math.floor(i / width);

                // Circular sampling
                for (let angle=0; angle<Math.PI*2; angle+=Math.PI/4) {
                    const nx = Math.floor(x + Math.cos(angle) * dist);
                    const ny = Math.floor(y + Math.sin(angle) * dist);
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

// --- HELPER: WHITE REMOVAL FOR AI ASSETS ---
// Removes white background from AI generated elements
const removeWhiteBackground = (img: HTMLImageElement): string => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0,0,canvas.width,canvas.height);
    const d = id.data;
    for(let i=0; i<d.length; i+=4) {
        // High tolerance for "white"
        if (d[i] > 230 && d[i+1] > 230 && d[i+2] > 230) {
            d[i+3] = 0; 
        }
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
    const [canvasSize, setCanvasSize] = useState({ w: 800, h: 800 });
    
    // Tools
    const [tool, setTool] = useState<'MOVE' | 'MAGIC_WAND'>('MOVE');
    const [wandTolerance, setWandTolerance] = useState(25);
    
    // Process State
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState('');
    const [incomingImage, setIncomingImage] = useState<string | null>(null);
    const [transformMode, setTransformMode] = useState<'IDLE' | 'DRAG' | 'ROTATE' | 'SCALE'>('IDLE');
    const [startInteraction, setStartInteraction] = useState<{x: number, y: number, val: number} | null>(null);

    // Modal State
    const [pendingSelection, setPendingSelection] = useState<{ layerId: string, startX: number, startY: number } | null>(null);
    const [transformPrompt, setTransformPrompt] = useState('');
    const [showTransformModal, setShowTransformModal] = useState(false);

    const workspaceRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const sourceImage = localStorage.getItem('vingi_layer_studio_source');
        if (sourceImage) {
            setIncomingImage(sourceImage);
            localStorage.removeItem('vingi_layer_studio_source');
        }
    }, []);

    // --- ENGINE: SEPARATION LOGIC ---
    const executeSeparation = async (mode: 'ONE' | 'ALL') => {
        if (!pendingSelection) return;
        const { layerId, startX, startY } = pendingSelection;
        setPendingSelection(null);
        setIsProcessing(true);

        const targetLayer = layers.find(l => l.id === layerId);
        if (!targetLayer) return;

        // 1. Prepare Canvas
        const img = new Image(); img.src = targetLayer.src;
        await new Promise(r => img.onload = r);
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        // 2. Select (using GLOBAL mode if 'ALL' chosen, else Contiguous implicitly via logic, but we use SmartMask's mode param)
        setProcessStatus('Analisando Geometria...');
        const scanMode = mode === 'ALL' ? 'GLOBAL' : 'CONTIGUOUS';
        const { mask, blobs } = getSmartMask(ctx, canvas.width, canvas.height, startX, startY, wandTolerance, scanMode);

        if (blobs.length === 0) {
            setIsProcessing(false); return;
        }

        // 3. Process Each Blob (Object)
        let newLayersAdded: DesignLayer[] = [];
        const fullDamageMask = new Uint8Array(canvas.width * canvas.height); // Accumulate holes

        for (let i = 0; i < blobs.length; i++) {
            const blob = blobs[i];
            setProcessStatus(`Separando objeto ${i+1}/${blobs.length}...`);

            // 3a. Extract Pixel Cutout
            const objCanvas = document.createElement('canvas');
            objCanvas.width = blob.w; objCanvas.height = blob.h;
            const objCtx = objCanvas.getContext('2d')!;
            
            const blobPixels = new Set(blob.pixels);
            const srcData = ctx.getImageData(blob.x, blob.y, blob.w, blob.h);
            
            // Mask out non-blob pixels in this rect
            for(let y=0; y<blob.h; y++) {
                for(let x=0; x<blob.w; x++) {
                    const globalIdx = (blob.y + y) * canvas.width + (blob.x + x);
                    if (!blobPixels.has(globalIdx)) {
                        srcData.data[(y*blob.w + x)*4 + 3] = 0; // Transparent
                    } else {
                        fullDamageMask[globalIdx] = 255; // Mark for healing
                    }
                }
            }
            objCtx.putImageData(srcData, 0, 0);
            
            // 3b. AI RECONSTRUCTION (The "Complete" Engine)
            // Send the raw cutout to AI to hallucinate missing parts/edges
            const rawCrop = objCanvas.toDataURL();
            // Remove prefix data:image... for API
            const base64Crop = rawCrop.split(',')[1]; 

            let finalSrc = rawCrop; // Default fallback
            let finalName = `Elemento ${i+1}`;
            
            try {
                // Async call for speed - could implement Promise.all for batching
                setProcessStatus(`IA: Reconstruindo detalhes (${i+1})...`);
                const aiRes = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ action: 'RECONSTRUCT_ELEMENT', cropBase64: base64Crop })
                });
                const aiData = await aiRes.json();
                
                if (aiData.success && aiData.src) {
                    // AI returns solid white bg image. We need to key it out.
                    const aiImg = new Image(); aiImg.src = aiData.src;
                    await new Promise(r => aiImg.onload = r);
                    finalSrc = removeWhiteBackground(aiImg);
                    finalName = aiData.name || finalName;
                }
            } catch (e) {
                console.warn("AI Reconstruction skipped", e);
            }

            // 3c. Calculate Position relative to Canvas center
            const origCenterX = canvas.width / 2;
            const origCenterY = canvas.height / 2;
            const objCenterX = blob.x + blob.w / 2;
            const objCenterY = blob.y + blob.h / 2;
            
            const deltaX = objCenterX - origCenterX;
            const deltaY = objCenterY - origCenterY;

            // Apply Parent Rotation logic
            const rad = (targetLayer.rotation * Math.PI) / 180;
            const rotX = deltaX * Math.cos(rad) - deltaY * Math.sin(rad);
            const rotY = deltaX * Math.sin(rad) + deltaY * Math.cos(rad);

            newLayersAdded.push({
                id: `obj-${Date.now()}-${i}`,
                type: 'ELEMENT',
                name: finalName,
                src: finalSrc,
                x: targetLayer.x + (rotX * targetLayer.scale),
                y: targetLayer.y + (rotY * targetLayer.scale),
                scale: targetLayer.scale,
                rotation: targetLayer.rotation,
                visible: true, locked: false, 
                zIndex: layers.length + 10 + i
            });
        }

        // 4. HEAL BACKGROUND
        if (targetLayer.type === 'BACKGROUND' || targetLayer.locked) {
            setProcessStatus('Regenerando Fundo (Texture Diffusion)...');
            healBackground(ctx, canvas.width, canvas.height, fullDamageMask);
            const newBgSrc = canvas.toDataURL();
            
            setLayers(prev => prev.map(l => l.id === layerId ? { ...l, src: newBgSrc } : l).concat(newLayersAdded));
        } else {
            // If cutting from an element, just add new ones, maybe hide original? 
            // For now, assume we're cutting from Base.
            setLayers(prev => prev.concat(newLayersAdded));
        }

        setTool('MOVE');
        setSelectedLayerId(newLayersAdded.length > 0 ? newLayersAdded[0].id : null);
        setIsProcessing(false);
        setProcessStatus('');
    };

    const handleTransformLayer = async () => {
        if (!selectedLayerId || !transformPrompt) return;
        const layer = layers.find(l => l.id === selectedLayerId);
        if (!layer) return;

        setIsProcessing(true);
        setShowTransformModal(false);
        setProcessStatus('IA: Transformando Objeto...');

        try {
            // Get current visual
            const img = new Image(); img.src = layer.src;
            await new Promise(r => img.onload = r);
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            
            const base64Crop = canvas.toDataURL().split(',')[1];
            
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    action: 'TRANSFORM_ELEMENT', 
                    cropBase64: base64Crop,
                    prompt: transformPrompt
                })
            });
            const data = await res.json();
            
            if (data.success && data.src) {
                const aiImg = new Image(); aiImg.src = data.src;
                await new Promise(r => aiImg.onload = r);
                const finalSrc = removeWhiteBackground(aiImg);
                
                updateLayer(selectedLayerId, { src: finalSrc, name: transformPrompt });
            }
        } catch (e) {
            alert("Erro na transformação.");
        } finally {
            setIsProcessing(false);
            setProcessStatus('');
            setTransformPrompt('');
        }
    };

    // --- INTERACTION ---
    const handleMouseDown = (e: React.MouseEvent, type: 'CANVAS' | 'HANDLE', layerId?: string) => {
        if (tool === 'MAGIC_WAND') {
            if (layerId) {
                const layerEl = document.getElementById(`layer-visual-${layerId}`);
                if (!layerEl) return;
                const rect = layerEl.getBoundingClientRect();
                
                // Calculate relative click coords for processing
                const layer = layers.find(l => l.id === layerId)!;
                const img = new Image(); img.src = layer.src;
                // We need image dimensions. Assume loaded if visible.
                // Approximation for click detection:
                const relX = (e.clientX - rect.left) / rect.width;
                const relY = (e.clientY - rect.top) / rect.height;
                // Defer actual pixel read to executeSeparation
                setPendingSelection({ 
                    layerId, 
                    startX: Math.floor(relX * img.width) || Math.floor(relX * 1024), // Fallback width
                    startY: Math.floor(relY * img.height) || Math.floor(relY * 1024)
                });
            }
            return;
        }
        // ... (Existing Move logic)
        if (!layerId && !selectedLayerId) return;
        const targetId = layerId || selectedLayerId!;
        const layer = layers.find(l => l.id === targetId);
        if (!layer || layer.locked) return;
        
        e.stopPropagation();
        setSelectedLayerId(targetId);
        
        if (type === 'CANVAS') {
            setTransformMode('DRAG');
            setStartInteraction({ x: e.clientX, y: e.clientY, val: 0 });
        } else {
            setTransformMode('SCALE');
            setStartInteraction({ x: e.clientX, y: e.clientY, val: layer.scale });
        }
    };

    // ... (Existing HandleMouseMove / FileUpload / SendToMockup)
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => { if(ev.target?.result) setIncomingImage(ev.target.result as string); };
            reader.readAsDataURL(file);
        }
    };

    const startSession = (img: string) => {
        setLayers([{
            id: 'master-bg', type: 'BACKGROUND', name: 'Imagem Original',
            src: img, x: 0, y: 0, scale: 1, rotation: 0, visible: true, locked: true, zIndex: 0
        }]);
        setIncomingImage(null);
        setTool('MAGIC_WAND');
    };

    const updateLayer = (id: string, updates: Partial<DesignLayer>) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!startInteraction || !selectedLayerId || tool === 'MAGIC_WAND') return;
        const layer = layers.find(l => l.id === selectedLayerId)!;
        const dx = e.clientX - startInteraction.x;
        const dy = e.clientY - startInteraction.y;

        if (transformMode === 'DRAG') {
            updateLayer(selectedLayerId, { x: layer.x + dx, y: layer.y + dy });
            setStartInteraction({ x: e.clientX, y: e.clientY, val: 0 });
        } else if (transformMode === 'SCALE') {
            updateLayer(selectedLayerId, { scale: Math.max(0.1, startInteraction.val + (dx+dy)/200) });
        }
    };

    const sendToMockup = () => {
        setIsProcessing(true);
        setProcessStatus('Gerando Composição 2K...');
        setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = 2048; canvas.height = 2048;
            const ctx = canvas.getContext('2d')!;
            const sorted = [...layers].sort((a,b) => a.zIndex - b.zIndex);
            const draw = async () => {
                for (const l of sorted) {
                    if (!l.visible) continue;
                    const img = new Image(); img.src = l.src;
                    await new Promise(r => img.onload = r);
                    ctx.save();
                    const ratio = 2048/800;
                    ctx.translate(1024 + l.x*ratio, 1024 + l.y*ratio);
                    ctx.rotate(l.rotation * Math.PI / 180);
                    ctx.scale(l.scale*ratio, l.scale*ratio);
                    ctx.drawImage(img, -img.width/2, -img.height/2);
                    ctx.restore();
                }
                const url = canvas.toDataURL('image/jpeg', 0.9);
                localStorage.setItem('vingi_mockup_pattern', url);
                setIsProcessing(false);
                if (onNavigateToMockup) onNavigateToMockup();
            };
            draw();
        }, 100);
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
                            Novo motor de decomposição com reconstrução IA. Separe elementos e o sistema recriará automaticamente as partes ocultas.
                        </p>
                        <button onClick={() => startSession(incomingImage!)} className="w-full py-4 bg-vingi-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-105 transition-transform">
                            <Wand2 size={20}/> INICIAR EDIÇÃO
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-[#1e293b] text-white overflow-hidden" onMouseMove={handleMouseMove} onMouseUp={() => setTransformMode('IDLE')}>
            
            {/* CANVAS AREA */}
            <div className={`flex-1 relative overflow-hidden flex items-center justify-center bg-[#0f172a] ${tool==='MAGIC_WAND'?'cursor-crosshair':''}`} ref={workspaceRef}>
                 <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px]"/>
                 
                 <div className="relative bg-white/5 shadow-2xl" style={{ width: canvasSize.w, height: canvasSize.h }}>
                    {layers.map(l => l.visible && (
                        <div key={l.id} id={`layer-visual-${l.id}`}
                            className={`absolute select-none group ${selectedLayerId===l.id ? 'z-50' : ''}`}
                            style={{ 
                                left: '50%', top: '50%',
                                transform: `translate(calc(-50% + ${l.x}px), calc(-50% + ${l.y}px)) rotate(${l.rotation}deg) scale(${l.scale})`,
                                zIndex: l.zIndex
                            }}
                            onMouseDown={(e) => handleMouseDown(e, 'CANVAS', l.id)}
                        >
                            <img src={l.src} className={`pointer-events-none ${selectedLayerId===l.id && tool!=='MAGIC_WAND' ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : ''}`} />
                            {selectedLayerId===l.id && tool==='MOVE' && !l.locked && (
                                <div className="absolute inset-0 border border-blue-500">
                                    <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 cursor-nwse-resize" onMouseDown={(e) => handleMouseDown(e, 'HANDLE', l.id)} />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* SELECTION MODAL */}
                    {pendingSelection && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-gray-800 p-6 rounded-2xl shadow-2xl z-[100] w-80 animate-fade-in border border-gray-200">
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Scan size={20} className="text-purple-600"/> Smart Select</h3>
                            <p className="text-sm text-gray-500 mb-6">A IA detectou elementos no padrão. Como você deseja proceder?</p>
                            
                            <div className="space-y-3">
                                <button onClick={() => executeSeparation('ONE')} className="w-full p-3 bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-200 rounded-xl flex items-center gap-3 transition-colors text-left group">
                                    <div className="bg-purple-100 p-2 rounded-lg text-purple-600"><MousePointer2 size={18}/></div>
                                    <div>
                                        <div className="font-bold text-sm text-gray-800">Isolar Apenas Este</div>
                                        <div className="text-[10px] text-gray-400">Recorta e reconstrói o objeto clicado.</div>
                                    </div>
                                    <ChevronRight size={16} className="ml-auto text-gray-300 group-hover:text-purple-500"/>
                                </button>
                                
                                <button onClick={() => executeSeparation('ALL')} className="w-full p-3 bg-gray-50 hover:bg-vingi-50 border border-gray-200 hover:border-vingi-200 rounded-xl flex items-center gap-3 transition-colors text-left group">
                                    <div className="bg-vingi-100 p-2 rounded-lg text-vingi-600"><Copy size={18}/></div>
                                    <div>
                                        <div className="font-bold text-sm text-gray-800">Isolar Todos Iguais</div>
                                        <div className="text-[10px] text-gray-400">Separa todas as ocorrências visuais.</div>
                                    </div>
                                    <ChevronRight size={16} className="ml-auto text-gray-300 group-hover:text-vingi-500"/>
                                </button>
                            </div>
                            <button onClick={() => setPendingSelection(null)} className="mt-4 w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600">Cancelar</button>
                        </div>
                    )}

                    {/* TRANSFORM MODAL */}
                    {showTransformModal && selectedLayerId && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-gray-800 p-6 rounded-2xl shadow-2xl z-[100] w-96 animate-fade-in border border-gray-200">
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Sparkles size={20} className="text-pink-500"/> Magic Transform</h3>
                            <p className="text-sm text-gray-500 mb-4">Transforme este elemento em outra coisa mantendo a posição.</p>
                            <textarea 
                                value={transformPrompt}
                                onChange={(e) => setTransformPrompt(e.target.value)}
                                placeholder="Ex: Transforme esta flor em uma caveira mexicana colorida..."
                                className="w-full h-24 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm mb-4 resize-none focus:border-pink-500 focus:bg-white outline-none"
                            />
                            <div className="flex gap-2">
                                <button onClick={() => setShowTransformModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancelar</button>
                                <button onClick={handleTransformLayer} className="flex-1 py-3 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 shadow-lg">Transformar</button>
                            </div>
                        </div>
                    )}

                    {/* Loading Overlay */}
                    {isProcessing && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-[100]">
                            <Loader2 size={48} className="text-vingi-500 animate-spin mb-4"/>
                            <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-vingi-400 to-purple-400 animate-pulse">{processStatus}</div>
                            <div className="mt-2 text-xs text-gray-500 font-mono">IA Generativa em Execução...</div>
                        </div>
                    )}
                 </div>
            </div>

            {/* SIDEBAR */}
            <div className="w-80 bg-[#1e293b] border-l border-gray-700 flex flex-col shadow-2xl z-20">
                <div className="p-4 bg-[#0f172a] border-b border-gray-700 space-y-4">
                    <h2 className="font-bold flex items-center gap-2"><Layers size={18} className="text-vingi-500"/> Layer Lab 2.0</h2>
                    
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-gray-800 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 hover:text-white transition-colors text-xs font-bold flex items-center justify-center gap-2">
                        <UploadCloud size={14}/> CARREGAR IMAGEM
                    </button>
                    
                    <div className="flex bg-gray-800 p-1 rounded-lg">
                        <button onClick={() => setTool('MOVE')} className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 ${tool==='MOVE' ? 'bg-vingi-600 shadow' : 'text-gray-400'}`}><Move size={14}/> Mover</button>
                        <button onClick={() => setTool('MAGIC_WAND')} className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 ${tool==='MAGIC_WAND' ? 'bg-purple-600 shadow' : 'text-gray-400'}`}><Wand2 size={14}/> Varinha</button>
                    </div>

                    {tool === 'MAGIC_WAND' && (
                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 space-y-2 animate-fade-in">
                            <label className="flex justify-between text-[10px] text-gray-300"><span>Sensibilidade de Cor</span> <span>{wandTolerance}%</span></label>
                            <input type="range" min="5" max="100" value={wandTolerance} onChange={(e) => setWandTolerance(Number(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"/>
                            <p className="text-[9px] text-gray-500 mt-1 italic">Clique em um elemento na tela para isolá-lo.</p>
                        </div>
                    )}
                    
                    {/* CONTEXT ACTIONS */}
                    {selectedLayerId && !layers.find(l => l.id === selectedLayerId)?.locked && (
                         <div className="bg-pink-900/20 border border-pink-500/30 p-3 rounded-lg animate-fade-in">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-bold text-pink-300 uppercase">IA Actions</span>
                                <Sparkles size={10} className="text-pink-500"/>
                             </div>
                             <button onClick={() => setShowTransformModal(true)} className="w-full py-2 bg-pink-600 hover:bg-pink-500 text-white rounded font-bold text-xs flex items-center justify-center gap-2 transition-colors">
                                 <RefreshCw size={12}/> TRANSFORMAR
                             </button>
                         </div>
                    )}

                    <button onClick={sendToMockup} className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg font-bold text-sm shadow-lg flex items-center justify-center gap-2">
                        <Shirt size={16}/> PROVAR
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
                                <span className="text-[9px] text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded uppercase">{l.type==='BACKGROUND'?'Base':'Recorte'}</span>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={(e)=>{e.stopPropagation(); updateLayer(l.id, {visible: !l.visible})}} className="p-1.5 text-gray-400 hover:text-white rounded">{l.visible?<Eye size={12}/>:<EyeOff size={12}/>}</button>
                                {!l.locked && <button onClick={(e)=>{e.stopPropagation(); setLayers(prev=>prev.filter(x=>x.id!==l.id))}} className="p-1.5 text-gray-400 hover:text-red-400 rounded"><Trash2 size={12}/></button>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
