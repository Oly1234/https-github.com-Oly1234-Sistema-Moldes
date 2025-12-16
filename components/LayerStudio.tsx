
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layers, Move, Trash2, Eye, EyeOff, Lock, Wand2, UploadCloud, RotateCw, Hand, Maximize, Minus, Plus, Shirt, Scan, Copy, MousePointer2, ChevronRight, FlipHorizontal, FlipVertical, ArrowUp, ArrowDown, Scissors, Eraser, Sparkles, Undo2, Redo2, Keyboard, Zap } from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleHeader, ModuleLandingPage } from './Shared';

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

// --- HELPER: SMART OBJECT EXTRACTION (Additive Support) ---
const getSmartObjectMask = (ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number, existingMask?: Uint8Array) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const mask = existingMask ? new Uint8Array(existingMask) : new Uint8Array(width * height);
    const visited = new Uint8Array(width * height);
    
    const p = (startY * width + startX) * 4;
    if (p < 0 || p >= data.length || data[p + 3] === 0) return { mask, bounds: null, hasPixels: false };
    
    const [l0, a0, b0] = rgbToLab(data[p], data[p+1], data[p+2]);
    const tolerance = 30;

    const stack = [[startX, startY]];
    let minX = width, maxX = 0, minY = height, maxY = 0;

    if (existingMask) {
        for(let i=0; i<width*height; i++) {
            if (existingMask[i]) {
                const ex = i % width; const ey = Math.floor(i/width);
                if(ex<minX) minX=ex; if(ex>maxX) maxX=ex;
                if(ey<minY) minY=ey; if(ey>maxY) maxY=ey;
            }
        }
    }

    while (stack.length) {
        const [x, y] = stack.pop()!;
        const idx = y * width + x;
        if (visited[idx]) continue;
        visited[idx] = 1;

        const pos = idx * 4;
        if (data[pos+3] === 0) continue; 

        const [l, a, b] = rgbToLab(data[pos], data[pos+1], data[pos+2]);
        const dist = Math.sqrt((l-l0)**2 + (a-a0)**2 + (b-b0)**2);

        if (dist < tolerance) {
            mask[idx] = 255;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;

            if (x>0) stack.push([x-1,y]); if (x<width-1) stack.push([x+1,y]);
            if (y>0) stack.push([x,y-1]); if (y<height-1) stack.push([x,y+1]);
        }
    }

    let hasPixels = maxX >= minX;
    return { 
        mask, 
        bounds: hasPixels ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null,
        hasPixels
    };
};

const healBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, mask: Uint8Array) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const tempBuffer = new Uint8ClampedArray(data);
    const iterations = 8; 

    for (let it = 0; it < iterations; it++) {
        for (let i = 0; i < width * height; i++) {
            if (mask[i] === 255) { 
                let rSum=0, gSum=0, bSum=0, count=0;
                const x = i % width;
                const y = Math.floor(i / width);
                const radius = it + 1;
                for(let dy = -1; dy <= 1; dy++) {
                    for(let dx = -1; dx <= 1; dx++) {
                        if (dx===0 && dy===0) continue;
                        const nx = x + dx * radius;
                        const ny = y + dy * radius;
                        if (nx>=0 && nx<width && ny>=0 && ny<height) {
                            const ni = ny * width + nx;
                            if (mask[ni] === 0 && data[ni*4+3] > 0) { 
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
                }
            }
        }
        data.set(tempBuffer);
    }
    ctx.putImageData(imgData, 0, 0);
};

// Helper to create texture pattern canvas
const createTextureLayerImage = async (url: string, width: number, height: number, opacity: number): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;
            const pat = ctx.createPattern(img, 'repeat');
            if (pat) {
                ctx.fillStyle = pat;
                ctx.globalAlpha = opacity;
                ctx.fillRect(0, 0, width, height);
            }
            resolve(canvas.toDataURL());
        };
        img.onerror = () => resolve(''); // Fail gracefully
    });
};

interface LayerStudioProps {
    onNavigateBack?: () => void;
    onNavigateToMockup?: () => void;
}

export const LayerStudio: React.FC<LayerStudioProps> = ({ onNavigateBack, onNavigateToMockup }) => {
    // History State
    const [history, setHistory] = useState<DesignLayer[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 1000, h: 1000 });
    const [tool, setTool] = useState<'MOVE' | 'SMART_EXTRACT' | 'HAND'>('MOVE');
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 }); 
    const containerRef = useRef<HTMLDivElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState('');
    const [incomingPayload, setIncomingPayload] = useState<any | null>(null);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Multi-select Mask State
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [maskPreviewSrc, setMaskPreviewSrc] = useState<string | null>(null);

    // Transformation Logic
    const [isTransforming, setIsTransforming] = useState<'NONE' | 'DRAG' | 'RESIZE' | 'ROTATE'>('NONE');
    const [transformMode, setTransformMode] = useState<'IDLE' | 'PAN'>('IDLE');
    const transformStartRef = useRef<{x: number, y: number, w: number, h: number, r: number, scale: number, angle: number}>({x:0, y:0, w:0, h:0, r:0, scale:1, angle:0});
    
    // --- TRANSFER LISTENER ---
    useEffect(() => {
        const checkStorage = () => {
            const stored = localStorage.getItem('vingi_layer_studio_data');
            // Legacy check
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

    const addToHistory = useCallback((newLayers: DesignLayer[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newLayers);
        if (newHistory.length > 20) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setLayers(newLayers);
    }, [history, historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
            setLayers(history[historyIndex - 1]);
        }
    }, [history, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(prev => prev + 1);
            setLayers(history[historyIndex + 1]);
        }
    }, [history, historyIndex]);

    useEffect(() => {
        if (history.length === 0 && layers.length > 0) {
            setHistory([layers]);
            setHistoryIndex(0);
        }
    }, []);

    const updateLayer = (id: string, updates: Partial<DesignLayer>) => {
        const newLayers = layers.map(l => l.id === id ? { ...l, ...updates } : l);
        if ('x' in updates || 'y' in updates || 'scale' in updates || 'rotation' in updates) {
            setLayers(newLayers);
        } else {
            addToHistory(newLayers);
        }
    };

    // --- TRANSFORM SELECTED HELPER ---
    const transformSelected = (action: string) => {
        if (!selectedLayerId) return;
        const layer = layers.find(l => l.id === selectedLayerId);
        if (!layer || layer.locked) return;

        let newLayers = [...layers];
        switch (action) {
            case 'FLIP_H': newLayers = layers.map(l => l.id === selectedLayerId ? { ...l, flipX: !l.flipX } : l); break;
            case 'FLIP_V': newLayers = layers.map(l => l.id === selectedLayerId ? { ...l, flipY: !l.flipY } : l); break;
            case 'ROT_90': newLayers = layers.map(l => l.id === selectedLayerId ? { ...l, rotation: (l.rotation + 90) % 360 } : l); break;
            case 'FRONT': 
                {
                   const maxZ = Math.max(...layers.map(l => l.zIndex));
                   newLayers = layers.map(l => l.id === selectedLayerId ? { ...l, zIndex: maxZ + 1 } : l);
                }
                break;
            case 'BACK':
                {
                   const minZ = Math.min(...layers.map(l => l.zIndex));
                   newLayers = layers.map(l => l.id === selectedLayerId ? { ...l, zIndex: minZ - 1 } : l);
                }
                break;
            case 'DUP':
                const dupLayer = { ...layer, id: `dup-${Date.now()}`, x: layer.x + 20, y: layer.y + 20, name: layer.name + ' (Copy)' };
                newLayers.push(dupLayer);
                setSelectedLayerId(dupLayer.id);
                break;
            case 'DEL':
                newLayers = layers.filter(l => l.id !== selectedLayerId);
                setSelectedLayerId(null);
                break;
        }
        setLayers(newLayers);
        addToHistory(newLayers);
    };

    // --- AI RECONSTRUCTION ---
    const handleSmartReconstruct = async () => {
        if (!selectedLayerId) return;
        const layer = layers.find(l => l.id === selectedLayerId);
        if (!layer) return;
        
        setIsProcessing(true);
        setProcessStatus('Analizando & Reconstruindo (IA)...');

        try {
            // Need to get base64 of the image without prefix
            let base64 = layer.src;
            if (base64.includes(',')) base64 = base64.split(',')[1];

            const res = await fetch('/api/analyze', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     action: 'RECONSTRUCT_ELEMENT',
                     cropBase64: base64
                 })
            });
            const data = await res.json();
            
            if (data.success && data.src) {
                const newLayer: DesignLayer = {
                    ...layer,
                    id: `reconst-${Date.now()}`,
                    name: `${data.name} (IA)`,
                    src: data.src,
                    x: layer.x + 20,
                    y: layer.y + 20
                };
                const newLayers = [...layers, newLayer];
                setLayers(newLayers);
                addToHistory(newLayers);
                setSelectedLayerId(newLayer.id);
            } else {
                alert("Não foi possível reconstruir o elemento.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro na conexão com a IA.");
        }
        setIsProcessing(false);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
            if (e.key.toLowerCase() === 'v') setTool('MOVE');
            if (e.key.toLowerCase() === 'w') setTool('SMART_EXTRACT');
            if (e.key.toLowerCase() === 'h') setTool('HAND');
            if (e.key === 'Delete' || e.key === 'Backspace') if (selectedLayerId) transformSelected('DEL');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [layers, selectedLayerId, history, historyIndex, undo, redo]);

    const startSession = async (payload: { mainImage: string, texture?: any }) => {
        const image = new Image(); image.src = payload.mainImage;
        image.onload = async () => {
            const maxDim = 1500;
            let finalW = image.width, finalH = image.height;
            if (image.width > maxDim || image.height > maxDim) {
                const ratio = image.width/image.height;
                if (image.width > image.height) { finalW = maxDim; finalH = maxDim / ratio; } else { finalH = maxDim; finalW = maxDim * ratio; }
            }
            setCanvasSize({ w: finalW, h: finalH });
            
            const initialLayers: DesignLayer[] = [
                { id: 'layer-base', type: 'BACKGROUND', name: 'Arte Original', src: payload.mainImage, x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: false, zIndex: 0 }
            ];

            // If texture exists, create a separate layer for it
            if (payload.texture && payload.texture.url) {
                const texImg = await createTextureLayerImage(payload.texture.url, finalW, finalH, payload.texture.opacity || 0.5);
                if (texImg) {
                    initialLayers.push({
                        id: 'layer-texture',
                        type: 'ELEMENT', // Treat as element but covers full screen
                        name: `Textura (${payload.texture.type})`,
                        src: texImg,
                        x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false,
                        visible: true, 
                        locked: true, // Lock by default so user doesn't drag it accidentally
                        zIndex: 999 // Top most
                    });
                }
            }

            setLayers(initialLayers);
            setHistory([initialLayers]);
            setHistoryIndex(0);
            setIncomingPayload(null); setTool('SMART_EXTRACT');
            setView({ x: 0, y: 0, k: 500 / finalW });
            setActiveMask(null); setMaskPreviewSrc(null);
        };
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => { if (ev.target?.result) startSession({ mainImage: ev.target.result as string }); };
            reader.readAsDataURL(file);
        }
    };

    const addToSelection = async (clickX: number, clickY: number) => {
        if (tool !== 'SMART_EXTRACT') return;
        
        // Find the artwork layer (ignore locked texture layer)
        const targetLayer = layers.find(l => !l.locked && l.visible && l.id !== 'layer-texture');
        if (!targetLayer) return;

        const img = new Image(); img.src = targetLayer.src; img.crossOrigin = "anonymous";
        await new Promise(r => img.onload = r);
        const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);

        const { mask, hasPixels } = getSmartObjectMask(ctx, canvas.width, canvas.height, Math.floor(clickX), Math.floor(clickY), activeMask || undefined);
        
        if (hasPixels) {
            setActiveMask(mask); 
            const prevC = document.createElement('canvas'); prevC.width = canvas.width; prevC.height = canvas.height;
            const pCtx = prevC.getContext('2d')!;
            const iData = pCtx.createImageData(canvas.width, canvas.height);
            for(let i=0; i<mask.length; i++) {
                if(mask[i]) { iData.data[i*4] = 59; iData.data[i*4+1] = 130; iData.data[i*4+2] = 246; iData.data[i*4+3] = 100; }
            }
            pCtx.putImageData(iData, 0, 0);
            setMaskPreviewSrc(prevC.toDataURL());
        }
    };

    const finishExtraction = async () => {
        if (!activeMask) return;
        const targetLayer = layers.find(l => !l.locked && l.visible && l.id !== 'layer-texture')!;
        
        setIsProcessing(true); setProcessStatus('Separando Objeto...');

        const img = new Image(); img.src = targetLayer.src; img.crossOrigin = "anonymous";
        await new Promise(r => img.onload = r);
        const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);

        let minX = canvas.width, maxX=0, minY=canvas.height, maxY=0;
        let count = 0;
        for(let i=0; i<activeMask.length; i++) {
            if (activeMask[i]) {
                const x = i % canvas.width; const y = Math.floor(i/canvas.width);
                if(x<minX) minX=x; if(x>maxX) maxX=x;
                if(y<minY) minY=y; if(y>maxY) maxY=y;
                count++;
            }
        }
        if (count === 0) { setIsProcessing(false); return; }

        const w = maxX - minX + 1; const h = maxY - minY + 1;
        const objCanvas = document.createElement('canvas'); objCanvas.width = w; objCanvas.height = h;
        const objCtx = objCanvas.getContext('2d')!;
        const srcData = ctx.getImageData(minX, minY, w, h);
        for (let i=0; i < w * h; i++) {
            const gIdx = (minY + Math.floor(i/w)) * canvas.width + (minX + (i%w));
            if (activeMask[gIdx] === 0) srcData.data[i*4+3] = 0; 
        }
        objCtx.putImageData(srcData, 0, 0);
        const newObjSrc = objCanvas.toDataURL();

        healBackground(ctx, canvas.width, canvas.height, activeMask);
        const healedSrc = canvas.toDataURL();

        const newLayerId = `element-${Date.now()}`;
        const centerX = minX + w / 2;
        const centerY = minY + h / 2;
        
        // Insert below texture if exists
        const zIndex = layers.length; 

        const newLayer: DesignLayer = {
            id: newLayerId,
            type: 'ELEMENT',
            name: 'Elemento Separado',
            src: newObjSrc,
            x: centerX - canvas.width / 2,
            y: centerY - canvas.height / 2,
            scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: false, zIndex
        };

        const updatedLayers = layers.map(l => l.id === targetLayer.id ? { ...l, src: healedSrc } : l);
        updatedLayers.push(newLayer);
        
        // Re-sort z-indices to keep Texture on top
        updatedLayers.sort((a,b) => {
            if (a.id === 'layer-texture') return 1;
            if (b.id === 'layer-texture') return -1;
            return a.zIndex - b.zIndex;
        });

        addToHistory(updatedLayers);
        setSelectedLayerId(newLayerId);
        setTool('MOVE');
        setActiveMask(null); setMaskPreviewSrc(null);
        setIsProcessing(false); setProcessStatus('');
    };

    // --- POINTER HANDLERS ---
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
        
        if (tool === 'HAND' || e.button === 1) {
            setTransformMode('PAN');
            return;
        }

        if (tool === 'SMART_EXTRACT') {
             if (!containerRef.current) return;
             const rect = containerRef.current.getBoundingClientRect();
             const centerX = rect.width / 2 + view.x;
             const centerY = rect.height / 2 + view.y;
             const relX = e.clientX - rect.left;
             const relY = e.clientY - rect.top;
             const rawX = (relX - centerX) / view.k;
             const rawY = (relY - centerY) / view.k;
             const finalX = rawX + canvasSize.w/2;
             const finalY = rawY + canvasSize.h/2;
             
             addToSelection(finalX, finalY);
             return;
        }

        if (tool === 'MOVE' && selectedLayerId) {
             setIsTransforming('DRAG');
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!lastPointerPos.current) return;
        const dx = e.clientX - lastPointerPos.current.x;
        const dy = e.clientY - lastPointerPos.current.y;
        lastPointerPos.current = { x: e.clientX, y: e.clientY };

        if (transformMode === 'PAN') {
            setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
            return;
        }

        if (isTransforming === 'DRAG' && selectedLayerId) {
             const layer = layers.find(l => l.id === selectedLayerId);
             if (layer && !layer.locked) {
                 const scaleK = view.k;
                 updateLayer(selectedLayerId, { x: layer.x + dx/scaleK, y: layer.y + dy/scaleK });
             }
        }
    };

    const handlePointerUp = () => {
        lastPointerPos.current = null;
        setTransformMode('IDLE');
        setIsTransforming('NONE');
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const s = Math.exp(-e.deltaY * 0.001);
            setView(v => ({ ...v, k: Math.min(Math.max(0.1, v.k * s), 5) }));
        } else {
            if (tool === 'HAND') {
                 setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
            }
        }
    };

    const sendToMockup = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvasSize.w;
        canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const sorted = [...layers].sort((a,b) => a.zIndex - b.zIndex);
        for(const l of sorted) {
             if (!l.visible) continue;
             const img = new Image();
             img.src = l.src;
             await new Promise(r => { 
                 if(img.complete) r(true); 
                 img.onload = () => r(true);
                 img.onerror = () => r(false);
             });
             
             ctx.save();
             ctx.translate(canvas.width/2 + l.x, canvas.height/2 + l.y);
             ctx.rotate(l.rotation * Math.PI/180);
             ctx.scale(l.flipX ? -l.scale : l.scale, l.flipY ? -l.scale : l.scale);
             ctx.drawImage(img, -img.width/2, -img.height/2);
             ctx.restore();
        }
        
        const data = canvas.toDataURL();
        localStorage.setItem('vingi_mockup_pattern', data);
        window.dispatchEvent(new CustomEvent('vingi_transfer', { detail: { module: 'MOCKUP' } }));
        if (onNavigateToMockup) onNavigateToMockup();
    };

    if (incomingPayload) {
        return (
            <div className="flex flex-col h-full items-center justify-center p-8 bg-gray-50">
                 <div className="bg-white p-8 rounded-2xl shadow-xl max-w-4xl w-full flex gap-8 items-center">
                    <img src={incomingPayload.mainImage} className="w-1/2 h-80 object-contain bg-gray-100 rounded-lg border" />
                    <div className="space-y-6">
                        <h1 className="text-3xl font-bold text-gray-800">Layer Lab</h1>
                        <p className="text-gray-500">Imagem recebida. {incomingPayload.texture ? 'Textura separada detectada.' : 'Pronto para edição.'}</p>
                        <button onClick={() => startSession(incomingPayload)} className="w-full py-4 bg-vingi-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-105 transition-transform"><Wand2 size={20}/> INICIAR SESSÃO</button>
                    </div>
                </div>
            </div>
        );
    }

    // --- MAIN RENDER ---
    return (
        <div className="flex flex-col h-full w-full bg-[#1e293b] text-white overflow-hidden" 
             onPointerMove={handlePointerMove} 
             onPointerUp={handlePointerUp}
             onWheel={handleWheel}>
            
            <ModuleHeader icon={Layers} title="Layer Studio" subtitle="Composição & Edição" />
            
            {!layers.length && !incomingPayload ? (
                // LANDING STATE
                <div className="flex-1 bg-white">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                    <ModuleLandingPage 
                        icon={Layers}
                        title="Layer Lab Studio"
                        description="Ferramenta profissional de separação de elementos. Remova fundos, isole motivos e use IA Generativa para reconstruir partes ocultas de uma estampa."
                        primaryActionLabel="Iniciar Projeto"
                        onPrimaryAction={() => fileInputRef.current?.click()}
                        features={["Smart Mask", "Inpainting", "Compositing", "Alpha Channel"]}
                        secondaryAction={
                            <div className="h-full flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-2 h-2 rounded-full bg-vingi-500"></span>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dica Profissional</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-left">
                                        <h4 className="text-sm font-bold text-gray-800 mb-1">Smart Extract</h4>
                                        <p className="text-xs text-gray-500">Clique em uma cor ou objeto para criar uma máscara de recorte instantânea.</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-left">
                                        <h4 className="text-sm font-bold text-gray-800 mb-1">Inpainting</h4>
                                        <p className="text-xs text-gray-500">A IA pode redesenhar partes que foram cortadas ou estão faltando na imagem original.</p>
                                    </div>
                                </div>
                            </div>
                        }
                    />
                </div>
            ) : (
                // WORKSPACE STATE
                <>
                    <div className="h-14 bg-[#0f172a] border-b border-gray-700 flex items-center px-4 gap-3 z-30 justify-between overflow-x-auto">
                        <div className="flex items-center gap-3">
                            <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
                                <button onClick={() => setTool('MOVE')} className={`p-2 rounded-md ${tool==='MOVE' ? 'bg-vingi-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}><Move size={18}/></button>
                                <button onClick={() => setTool('SMART_EXTRACT')} className={`p-2 rounded-md ${tool==='SMART_EXTRACT' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}><Scissors size={18}/></button>
                                <button onClick={() => setTool('HAND')} className={`p-2 rounded-md ${tool==='HAND' ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}><Hand size={18}/></button>
                            </div>
                            <div className="w-px h-8 bg-gray-700"></div>
                            <div className="flex items-center gap-1">
                                <button onClick={undo} disabled={historyIndex <= 0} className="p-2 hover:bg-gray-700 rounded-md text-gray-300 disabled:opacity-30"><Undo2 size={18}/></button>
                                <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 hover:bg-gray-700 rounded-md text-gray-300 disabled:opacity-30"><Redo2 size={18}/></button>
                            </div>
                            {selectedLayerId && (
                                <div className="flex items-center gap-1 animate-fade-in">
                                    <button onClick={handleSmartReconstruct} className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-md text-[10px] font-bold flex items-center gap-1 shadow-md hover:brightness-110 mr-2"><Zap size={12}/> RECONSTRUIR</button>
                                    <div className="w-px h-6 bg-gray-700 mr-2"></div>
                                    <button onClick={() => transformSelected('FLIP_H')} className="p-2 hover:bg-gray-700 rounded-md text-gray-300"><FlipHorizontal size={18}/></button>
                                    <button onClick={() => transformSelected('FLIP_V')} className="p-2 hover:bg-gray-700 rounded-md text-gray-300"><FlipVertical size={18}/></button>
                                    <button onClick={() => transformSelected('ROT_90')} className="p-2 hover:bg-gray-700 rounded-md text-gray-300"><RotateCw size={18}/></button>
                                    <button onClick={() => transformSelected('FRONT')} className="p-2 hover:bg-gray-700 rounded-md text-gray-300"><ArrowUp size={18}/></button>
                                    <button onClick={() => transformSelected('BACK')} className="p-2 hover:bg-gray-700 rounded-md text-gray-300"><ArrowDown size={18}/></button>
                                    <button onClick={() => transformSelected('DUP')} className="p-2 hover:bg-gray-700 rounded-md text-gray-300"><Copy size={18}/></button>
                                    <button onClick={() => transformSelected('DEL')} className="p-2 hover:bg-red-900/50 text-red-400 rounded-md"><Trash2 size={18}/></button>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { setView({x:0, y:0, k: 500/canvasSize.w}); }} className="p-2 text-gray-400 hover:text-white"><Maximize size={18}/></button>
                        </div>
                    </div>

                    {/* CONFIRM SELECTION DIALOG */}
                    {activeMask && tool === 'SMART_EXTRACT' && (
                        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-vingi-600 text-white px-4 py-2 rounded-full shadow-xl z-50 flex items-center gap-3 animate-fade-in">
                            <span className="text-xs font-bold">Seleção Ativa</span>
                            <button onClick={finishExtraction} className="bg-white text-vingi-900 px-3 py-1 rounded-full text-xs font-bold hover:bg-gray-100">EXTRAIR AGORA</button>
                            <button onClick={() => { setActiveMask(null); setMaskPreviewSrc(null); }} className="p-1 hover:bg-vingi-700 rounded-full"><Trash2 size={12}/></button>
                        </div>
                    )}

                    <div className="flex flex-1 overflow-hidden">
                        {/* CANVAS */}
                        <div ref={containerRef} className={`flex-1 relative overflow-hidden flex items-center justify-center bg-[#1e1e1e] ${tool==='HAND'?'cursor-grab': tool==='SMART_EXTRACT'?'cursor-crosshair':'cursor-default'}`} onPointerDown={handlePointerDown} style={{ touchAction: 'none' }}>
                            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,#808080_25%,transparent_25%,transparent_75%,#808080_75%,#808080),linear-gradient(45deg,#808080_25%,transparent_25%,transparent_75%,#808080_75%,#808080)]" style={{ backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px' }} />

                            <div className="relative shadow-2xl" style={{ width: canvasSize.w, height: canvasSize.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: 'center center', transition: 'transform 0.05s linear' }}>
                                <div className="absolute inset-0 bg-white" />
                                {layers.map(l => l.visible && (
                                    <div key={l.id} 
                                        className={`absolute select-none pointer-events-none ${selectedLayerId===l.id ? 'z-[999]' : ''}`} 
                                        style={{ 
                                            left: '50%', top: '50%', width: (l.id.includes('base') || l.id.includes('texture')) ? '100%' : 'auto', height: (l.id.includes('base') || l.id.includes('texture')) ? '100%' : 'auto',
                                            transform: `translate(calc(-50% + ${l.x}px), calc(-50% + ${l.y}px)) rotate(${l.rotation}deg) scale(${l.flipX?-l.scale:l.scale}, ${l.flipY?-l.scale:l.scale})`, 
                                            zIndex: l.zIndex,
                                            mixBlendMode: l.id === 'layer-texture' ? 'multiply' : 'normal' // Simple blend for texture
                                        }}>
                                        <img src={l.src} className={`max-w-none ${l.id.includes('base') || l.id.includes('texture') ? 'w-full h-full' : ''} ${selectedLayerId===l.id ? 'drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]' : ''}`} draggable={false} />
                                        {selectedLayerId === l.id && tool === 'MOVE' && (
                                            <div className="absolute -inset-1 border border-blue-500 pointer-events-none">
                                                <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-blue-500 rounded-full"></div>
                                                <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-blue-500 rounded-full"></div>
                                                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-blue-500 rounded-full"></div>
                                                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-blue-500 rounded-full"></div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {maskPreviewSrc && <div className="absolute inset-0 pointer-events-none z-[1000] opacity-50 mix-blend-screen"><img src={maskPreviewSrc} className="w-full h-full" /></div>}
                            </div>
                            {isProcessing && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[1000]"><div className="text-xl font-bold text-white animate-pulse">{processStatus}</div></div>}
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
                                        className={`p-2 rounded-lg flex items-center gap-2 cursor-pointer border transition-all ${selectedLayerId===l.id ? 'bg-blue-900/30 border-blue-500/50' : 'bg-transparent border-transparent hover:bg-gray-800'} ${l.locked ? 'opacity-70' : ''}`}>
                                        <button onClick={(e)=>{e.stopPropagation(); if(!l.locked || l.id==='layer-texture') updateLayer(l.id, {visible: !l.visible})}} className={`p-1 rounded ${l.visible?'text-gray-400':'text-gray-600'}`}>{l.visible?<Eye size={12}/>:<EyeOff size={12}/>}</button>
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
                </>
            )}
        </div>
    );
};
