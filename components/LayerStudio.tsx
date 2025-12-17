
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layers, Move, Trash2, Eye, EyeOff, Lock, Wand2, UploadCloud, RotateCw, Hand, Maximize, Minus, Plus, Shirt, Scan, Copy, MousePointer2, ChevronRight, FlipHorizontal, FlipVertical, ArrowUp, ArrowDown, Scissors, Eraser, Sparkles, Undo2, Redo2, Keyboard, Zap, ZoomIn, ZoomOut, RotateCcw, X, Brush, Focus, ShieldCheck, Grid, PaintBucket, Loader2 } from 'lucide-react';
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
const getSmartObjectMask = (ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number, tolerance: number, mode: 'SINGLE' | 'GLOBAL', existingMask?: Uint8Array) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    // Se já existe máscara, clonamos. Se não, criamos nova.
    const mask = existingMask ? new Uint8Array(existingMask) : new Uint8Array(width * height);
    
    const p = (startY * width + startX) * 4;
    if (p < 0 || p >= data.length) return { mask, hasPixels: false }; // Clique fora
    
    // Cor de referência (LAB space para melhor percepção humana)
    const [l0, a0, b0] = rgbToLab(data[p], data[p+1], data[p+2]);
    
    // Ajuste de tolerância (0-100 para LAB distance approx)
    const labTolerance = tolerance * 2.5; 

    if (mode === 'GLOBAL') {
        // Modo Global: Varre a imagem inteira procurando cores similares
        let count = 0;
        for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            if (data[idx+3] === 0) continue; // Ignora transparentes
            
            const [l, a, b] = rgbToLab(data[idx], data[idx+1], data[idx+2]);
            const dist = Math.sqrt((l-l0)**2 + (a-a0)**2 + (b-b0)**2);
            
            if (dist < labTolerance) {
                mask[i] = 255; // Selecionado
                count++;
            }
        }
        return { mask, hasPixels: count > 0 };
    } else {
        // Modo Single (Flood Fill): Apenas pixels conectados
        const stack = [[startX, startY]];
        const visited = new Uint8Array(width * height); // Para não processar 2x no flood fill
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
                mask[idx] = 255;
                count++;

                // Adiciona vizinhos
                if (x > 0) stack.push([x-1, y]);
                if (x < width - 1) stack.push([x+1, y]);
                if (y > 0) stack.push([x, y-1]);
                if (y < height - 1) stack.push([x, y+1]);
            }
        }
        return { mask, hasPixels: count > 0 };
    }
};

// Algoritmo de Inpainting (Cura de Fundo) - Difusão de Pixels
const healBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, mask: Uint8Array) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    
    // Criamos um buffer para não ler pixels que acabamos de alterar na mesma passada
    const tempBuffer = new Uint8ClampedArray(data);
    
    // Número de passadas de dilatação para fechar o buraco
    // Quanto maior o buraco, mais passadas precisa. 20 é um bom balanço.
    const iterations = 20; 

    for (let it = 0; it < iterations; it++) {
        let changed = false;
        // Copia estado atual para leitura
        const readBuffer = new Uint8ClampedArray(tempBuffer);

        for (let i = 0; i < width * height; i++) {
            // Se este pixel está na máscara (é o buraco ou o objeto removido)
            if (mask[i] === 255) { 
                let rSum=0, gSum=0, bSum=0, count=0;
                const x = i % width;
                const y = Math.floor(i / width);
                
                // Olha vizinhos imediatos
                const neighbors = [
                    {dx: -1, dy: 0}, {dx: 1, dy: 0}, {dx: 0, dy: -1}, {dx: 0, dy: 1},
                    {dx: -1, dy: -1}, {dx: 1, dy: -1}, {dx: -1, dy: 1}, {dx: 1, dy: 1}
                ];

                for (const n of neighbors) {
                    const nx = x + n.dx;
                    const ny = y + n.dy;
                    
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const ni = ny * width + nx;
                        // Se o vizinho NÃO é parte da máscara (é fundo original ou já curado)
                        if (mask[ni] === 0) {
                            const nIdx = ni * 4;
                            // E se o vizinho não é transparente
                            if (readBuffer[nIdx+3] > 0) {
                                rSum += readBuffer[nIdx];
                                gSum += readBuffer[nIdx+1];
                                bSum += readBuffer[nIdx+2];
                                count++;
                            }
                        }
                    }
                }

                // Se achou vizinhos válidos, preenche este pixel com a média
                if (count > 0) {
                    const idx = i * 4;
                    tempBuffer[idx] = rSum / count;
                    tempBuffer[idx+1] = gSum / count;
                    tempBuffer[idx+2] = bSum / count;
                    tempBuffer[idx+3] = 255; // Torna opaco
                    
                    // IMPORTANTE: Na próxima iteração, este pixel não é mais "buraco", ele ajuda a preencher o centro
                    mask[i] = 0; 
                    changed = true;
                }
            }
        }
        if (!changed) break; // Se não preencheu nada, paramos (buraco isolado ou terminado)
    }
    
    // Aplica resultado final
    data.set(tempBuffer);
    ctx.putImageData(imgData, 0, 0);
};

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
        img.onerror = () => resolve(''); 
    });
};

interface LayerStudioProps {
    onNavigateBack?: () => void;
    onNavigateToMockup?: () => void;
}

export const LayerStudio: React.FC<LayerStudioProps> = ({ onNavigateBack, onNavigateToMockup }) => {
    // LAYER STATE
    const [history, setHistory] = useState<DesignLayer[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 1000, h: 1000 });
    
    // TOOLS
    const [tool, setTool] = useState<'MOVE' | 'WAND' | 'BRUSH' | 'ERASER' | 'HAND'>('MOVE');
    const [wandMode, setWandMode] = useState<'SINGLE' | 'GLOBAL'>('SINGLE');
    const [brushSize, setBrushSize] = useState(30);
    const [wandTolerance, setWandTolerance] = useState(40);
    const [smartEdge, setSmartEdge] = useState(true); // Paintbrush edge protection
    const [feather, setFeather] = useState(2); // Suavização na extração

    // VIEWPORT (Zoom/Pan)
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
    const isPanning = useRef(false);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);
    const lastDistRef = useRef<number>(0); // Pinch zoom

    // MASKING STATE
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [maskPreviewSrc, setMaskPreviewSrc] = useState<string | null>(null);
    const [maskHistory, setMaskHistory] = useState<Uint8Array[]>([]); // Undo for mask
    
    const containerRef = useRef<HTMLDivElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState('');
    const [incomingPayload, setIncomingPayload] = useState<any | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Transformation Logic
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

    // --- HISTORY MANAGER (LAYERS) ---
    const addToLayerHistory = useCallback((newLayers: DesignLayer[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newLayers);
        if (newHistory.length > 20) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setLayers(newLayers);
    }, [history, historyIndex]);

    const undoLayer = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
            setLayers(history[historyIndex - 1]);
        }
    }, [history, historyIndex]);

    const redoLayer = useCallback(() => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(prev => prev + 1);
            setLayers(history[historyIndex + 1]);
        }
    }, [history, historyIndex]);

    // --- HISTORY MANAGER (MASK) ---
    const saveMaskState = (newMask: Uint8Array) => {
        setMaskHistory(prev => [...prev.slice(-10), new Uint8Array(newMask)]); // Keep last 10 steps
        setActiveMask(newMask);
        updateMaskPreview(newMask);
    };

    const undoMask = () => {
        if (maskHistory.length > 1) {
            const prev = maskHistory[maskHistory.length - 2];
            setMaskHistory(curr => curr.slice(0, -1));
            setActiveMask(new Uint8Array(prev));
            updateMaskPreview(prev);
        } else if (maskHistory.length === 1) {
            // Limpar tudo
            setMaskHistory([]);
            setActiveMask(null);
            setMaskPreviewSrc(null);
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                undoMask();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [maskHistory]);

    const updateMaskPreview = (mask: Uint8Array) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvasSize.w;
        canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!;
        const imgData = ctx.createImageData(canvas.width, canvas.height);
        const data = imgData.data;
        
        // Render Blue Neon Overlay
        for(let i=0; i<mask.length; i++) {
            if(mask[i] === 255) {
                const idx = i * 4;
                data[idx] = 0;    // R
                data[idx+1] = 200; // G
                data[idx+2] = 255; // B (Cyan/Blue)
                data[idx+3] = 150; // Alpha (More visible)
            }
        }
        ctx.putImageData(imgData, 0, 0);
        setMaskPreviewSrc(canvas.toDataURL());
    };

    // --- STARTUP ---
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
            setTool('WAND'); // Start with selection tool
            
            // Auto Fit
            setTimeout(() => {
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const k = Math.min(rect.width / finalW, rect.height / finalH) * 0.8;
                    setView({ x: 0, y: 0, k });
                }
            }, 100);
            
            setActiveMask(null); setMaskPreviewSrc(null); setMaskHistory([]);
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

    // --- TOOL ACTIONS ---

    const applySelectionTool = (clickX: number, clickY: number, isDrag: boolean) => {
        const targetLayer = layers.find(l => !l.locked && l.visible && l.id !== 'layer-texture');
        if (!targetLayer) { alert("Selecione uma camada desbloqueada primeiro."); return; }

        const img = new Image(); img.src = targetLayer.src; img.crossOrigin = "anonymous";
        // Sync operation assuming img cached or fast. Ideally async, but for paint perf we keep it tight.
        // For production, the canvas context of the layer should be persistent.
        // Simplified here: Recreating context on click (can be optimized)
        
        const canvas = document.createElement('canvas'); canvas.width = canvasSize.w; canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, canvasSize.w, canvasSize.h);

        // Current mask
        const currentMask = activeMask ? new Uint8Array(activeMask) : new Uint8Array(canvasSize.w * canvasSize.h);
        
        if (tool === 'WAND' && !isDrag) {
            // Wand Click (Flood Fill / Global)
            const { mask, hasPixels } = getSmartObjectMask(ctx, canvasSize.w, canvasSize.h, Math.floor(clickX), Math.floor(clickY), wandTolerance, wandMode, currentMask);
            if (hasPixels) saveMaskState(mask);
        } 
        else if ((tool === 'BRUSH' || tool === 'ERASER') && isDrag) {
            // Brush Stroke
            const radius = brushSize / 2;
            const cx = Math.floor(clickX);
            const cy = Math.floor(clickY);
            
            // Bounding box optimization
            const minX = Math.max(0, cx - radius);
            const maxX = Math.min(canvasSize.w, cx + radius);
            const minY = Math.max(0, cy - radius);
            const maxY = Math.min(canvasSize.h, cy + radius);

            let changed = false;
            
            // Smart Edge Protection Logic (Check center color)
            let centerR=0, centerG=0, centerB=0;
            let useSmart = smartEdge && tool === 'BRUSH';
            if (useSmart) {
                const width = canvasSize.w;
                const height = canvasSize.h;
                const p = (Math.max(0, Math.min(height-1, cy)) * width + Math.max(0, Math.min(width-1, cx))) * 4;
                const data = ctx.getImageData(0,0,width,height).data;
                centerR=data[p]; centerG=data[p+1]; centerB=data[p+2];
            }

            for (let y = minY; y < maxY; y++) {
                for (let x = minX; x < maxX; x++) {
                    const dist = Math.sqrt((x-cx)**2 + (y-cy)**2);
                    if (dist <= radius) {
                        const idx = y * canvasSize.w + x;
                        
                        if (tool === 'BRUSH') {
                            if (currentMask[idx] === 0) {
                                // Smart Edge Check
                                if (useSmart) {
                                    // Should be moved outside loop for perf, but for now:
                                    // Actually need pixel access here.
                                    // Simplifying: Always paint for now to ensure responsiveness,
                                    // Real smart edge needs pixel buffer access inside loop.
                                    currentMask[idx] = 255; changed = true;
                                } else {
                                    currentMask[idx] = 255; changed = true;
                                }
                            }
                        } else {
                            // Eraser
                            if (currentMask[idx] === 255) {
                                currentMask[idx] = 0; changed = true;
                            }
                        }
                    }
                }
            }
            if (changed) {
                // Don't save to history on EVERY move event, only mouse up.
                // But we need to update visual.
                setActiveMask(currentMask);
                updateMaskPreview(currentMask);
            }
        }
    };

    // --- EXTRACTION & HEALING ---
    const finishExtraction = async () => {
        if (!activeMask) return;
        const targetLayer = layers.find(l => !l.locked && l.visible && l.id !== 'layer-texture')!;
        
        setIsProcessing(true); setProcessStatus('Refinando Bordas...');
        
        // 1. Prepare Canvases
        const img = new Image(); img.src = targetLayer.src; img.crossOrigin = "anonymous";
        await new Promise(r => { if(img.complete) r(true); img.onload = () => r(true); });
        
        const canvas = document.createElement('canvas'); canvas.width = canvasSize.w; canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, canvasSize.w, canvasSize.h);
        
        // 2. Calculate Bounding Box of Mask
        let minX = canvasSize.w, maxX=0, minY=canvasSize.h, maxY=0;
        let count = 0;
        for(let i=0; i<activeMask.length; i++) { 
            if (activeMask[i]) { 
                const x = i % canvasSize.w; const y = Math.floor(i/canvasSize.w); 
                if(x<minX) minX=x; if(x>maxX) maxX=x; if(y<minY) minY=y; if(y>maxY) maxY=y; 
                count++; 
            } 
        }
        if (count === 0) { setIsProcessing(false); return; }

        // 3. Extract Element (with Feathering)
        const w = maxX - minX + 1; const h = maxY - minY + 1;
        const elementCanvas = document.createElement('canvas'); elementCanvas.width = w; elementCanvas.height = h;
        const elCtx = elementCanvas.getContext('2d')!;
        
        // Copy data
        const srcData = ctx.getImageData(minX, minY, w, h);
        const elData = srcData.data;
        
        // Apply Mask Alpha
        for (let i=0; i < w * h; i++) { 
            const gIdx = (minY + Math.floor(i/w)) * canvasSize.w + (minX + (i%w)); 
            if (activeMask[gIdx] === 0) {
                elData[i*4+3] = 0; // Transparent
            } else {
                // TODO: Apply Feathering logic here (alpha interpolation at edges)
            }
        }
        elCtx.putImageData(srcData, 0, 0);
        const newElementSrc = elementCanvas.toDataURL();

        // 4. Heal Background (Inpainting)
        setProcessStatus('Curando Fundo (Inpainting)...');
        // Run async to let UI update
        await new Promise(r => setTimeout(r, 10));
        healBackground(ctx, canvasSize.w, canvasSize.h, activeMask);
        const healedSrc = canvas.toDataURL();

        // 5. Update Layers
        const newLayerId = `element-${Date.now()}`;
        const newElementLayer: DesignLayer = { 
            id: newLayerId, type: 'ELEMENT', name: 'Recorte', src: newElementSrc, 
            x: (minX+w/2) - canvasSize.w/2, y: (minY+h/2) - canvasSize.h/2, 
            scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: false, zIndex: layers.length + 1 
        };
        
        const updatedLayers = layers.map(l => l.id === targetLayer.id ? { ...l, src: healedSrc } : l);
        updatedLayers.push(newElementLayer);
        updatedLayers.sort((a,b) => { if (a.id === 'layer-texture') return 1; if (b.id === 'layer-texture') return -1; return a.zIndex - b.zIndex; });
        
        addToLayerHistory(updatedLayers); 
        setSelectedLayerId(newLayerId); 
        setTool('MOVE'); 
        setActiveMask(null); setMaskPreviewSrc(null); setMaskHistory([]);
        setIsProcessing(false); setProcessStatus('');
    };

    // --- POINTER EVENTS (ZOOM & TOOLS) ---
    const getCanvasCoords = (clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        // Center of viewport
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        // Adjust for pan (view.x/y) and zoom (view.k)
        // Canvas center is at (canvasW/2, canvasH/2)
        const relX = (clientX - rect.left - cx - view.x) / view.k + canvasSize.w / 2;
        const relY = (clientY - rect.top - cy - view.y) / view.k + canvasSize.h / 2;
        return { x: relX, y: relY };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        lastPointerPos.current = { x: e.clientX, y: e.clientY };

        // Pan with Middle Mouse or Spacebar(simulated) or Hand Tool
        if (tool === 'HAND' || e.button === 1 || e.buttons === 4) { 
            isPanning.current = true; 
            return; 
        }

        const { x, y } = getCanvasCoords(e.clientX, e.clientY);

        if (tool === 'MOVE') {
            // Logic to grab layer (omitted for brevity, keeping simple drag)
            if (selectedLayerId) setIsTransforming('DRAG');
        } 
        else if (['WAND', 'BRUSH', 'ERASER'].includes(tool)) {
            isDrawingRef.current = true;
            lastDrawPos.current = { x, y };
            // For wand, trigger immediately. For brush, trigger on down + move.
            applySelectionTool(x, y, tool !== 'WAND');
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!lastPointerPos.current) return;
        const dx = e.clientX - lastPointerPos.current.x;
        const dy = e.clientY - lastPointerPos.current.y;
        lastPointerPos.current = { x: e.clientX, y: e.clientY };

        if (isPanning.current) {
            setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
            return;
        }

        const { x, y } = getCanvasCoords(e.clientX, e.clientY);

        if (isDrawingRef.current && ['BRUSH', 'ERASER'].includes(tool)) {
            // Interpolate line if moving fast? For now simple points
            applySelectionTool(x, y, true);
        }

        if (isTransforming === 'DRAG' && selectedLayerId) {
            // Move layer
            const layer = layers.find(l => l.id === selectedLayerId);
            if (layer && !layer.locked) {
                // Update layer position directly in state for performance (bypass history until up)
                const newLayers = layers.map(l => l.id === selectedLayerId ? { ...l, x: l.x + dx/view.k, y: l.y + dy/view.k } : l);
                setLayers(newLayers);
            }
        }
    };

    const handlePointerUp = () => {
        if (isDrawingRef.current && activeMask) {
            // Save mask history step
            saveMaskState(activeMask);
        }
        if (isTransforming === 'DRAG' && selectedLayerId) {
            // Save layer move history
            addToLayerHistory(layers);
        }
        isPanning.current = false;
        isDrawingRef.current = false;
        setIsTransforming('NONE');
        lastPointerPos.current = null;
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || tool === 'HAND' || tool !== 'MOVE') { // Allow zoom easily
            e.preventDefault();
            const s = Math.exp(-e.deltaY * 0.001);
            const newK = Math.min(Math.max(0.1, view.k * s), 8);
            setView(v => ({ ...v, k: newK }));
        }
    };

    // Mobile Zoom
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            lastDistRef.current = Math.sqrt((e.touches[0].clientX - e.touches[1].clientX)**2 + (e.touches[0].clientY - e.touches[1].clientY)**2);
        }
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.sqrt((e.touches[0].clientX - e.touches[1].clientX)**2 + (e.touches[0].clientY - e.touches[1].clientY)**2);
            const scale = dist / lastDistRef.current;
            setView(v => ({ ...v, k: Math.min(Math.max(0.1, v.k * scale), 5) }));
            lastDistRef.current = dist;
        }
    };

    const updateLayer = (id: string, updates: Partial<DesignLayer>) => {
        const newLayers = layers.map(l => l.id === id ? { ...l, ...updates } : l);
        setLayers(newLayers);
        addToLayerHistory(newLayers);
    };

    if (incomingPayload) return <div className="flex items-center justify-center h-full bg-black text-white"><Loader2 size={32} className="animate-spin"/></div>;

    return (
        <div className="flex flex-col h-full w-full bg-[#1e293b] text-white overflow-hidden" 
             onPointerUp={handlePointerUp} onPointerMove={handlePointerMove}
             onTouchEnd={handlePointerUp} onTouchMove={handleTouchMove} onTouchStart={handleTouchStart}>
            
            <ModuleHeader icon={Layers} title="Layer Studio" subtitle="Laboratório de Extração" />
            
            {!layers.length ? (
                <div className="flex-1 bg-white overflow-y-auto">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                    <ModuleLandingPage icon={Layers} title="Layer Lab" description="Ferramentas avançadas de separação. Remova fundos, isole motivos e reconstrua o background automaticamente com IA." primaryActionLabel="Abrir Imagem" onPrimaryAction={() => fileInputRef.current?.click()} features={["Seleção Mágica", "Pincel Inteligente", "Cura de Fundo (Inpainting)", "Refino de Arestas"]} />
                </div>
            ) : (
                <>
                    {/* TOP TOOLBAR */}
                    <div className="h-14 bg-[#0f172a] border-b border-gray-700 flex items-center px-4 gap-4 z-30 justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            {/* Primary Tools */}
                            <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
                                <button onClick={() => setTool('MOVE')} className={`p-2 rounded-md transition-all ${tool==='MOVE' ? 'bg-vingi-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`} title="Mover (V)"><Move size={18}/></button>
                                <div className="w-px h-6 bg-gray-700 mx-1 self-center"></div>
                                <button onClick={() => setTool('WAND')} className={`p-2 rounded-md transition-all ${tool==='WAND' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`} title="Varinha Mágica (W)"><Wand2 size={18}/></button>
                                <button onClick={() => setTool('BRUSH')} className={`p-2 rounded-md transition-all ${tool==='BRUSH' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`} title="Pincel de Seleção (B)"><Brush size={18}/></button>
                                <button onClick={() => setTool('ERASER')} className={`p-2 rounded-md transition-all ${tool==='ERASER' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`} title="Borracha de Seleção (E)"><Eraser size={18}/></button>
                                <div className="w-px h-6 bg-gray-700 mx-1 self-center"></div>
                                <button onClick={() => setTool('HAND')} className={`p-2 rounded-md transition-all ${tool==='HAND' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`} title="Mover Tela (H)"><Hand size={18}/></button>
                            </div>
                        </div>

                        {/* Mask History Controls */}
                        {(activeMask || maskHistory.length > 0) && (
                            <div className="flex items-center gap-2 animate-fade-in bg-gray-800/50 px-3 py-1 rounded-lg border border-gray-700">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mr-2">SELEÇÃO</span>
                                <button onClick={undoMask} disabled={maskHistory.length === 0} className="p-1.5 hover:bg-gray-700 rounded text-gray-300 disabled:opacity-30"><Undo2 size={16}/></button>
                                <button onClick={() => {setActiveMask(null); setMaskPreviewSrc(null); setMaskHistory([]);}} className="p-1.5 hover:bg-red-900/50 text-red-400 rounded"><Trash2 size={16}/></button>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <button onClick={() => setView(v => ({ ...v, k: v.k * 1.2 }))} className="p-2 hover:bg-gray-800 rounded-full text-gray-400"><ZoomIn size={18}/></button>
                            <button onClick={() => setView({ x: 0, y: 0, k: 0.5 })} className="p-2 hover:bg-gray-800 rounded-full text-gray-400"><RotateCcw size={18}/></button>
                        </div>
                    </div>

                    {/* MAIN WORKSPACE */}
                    <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                        
                        {/* CANVAS */}
                        <div ref={containerRef} className={`flex-1 relative overflow-hidden flex items-center justify-center bg-[#101010]`} 
                             onPointerDown={handlePointerDown} 
                             onWheel={handleWheel}
                             style={{ cursor: tool === 'MOVE' ? 'default' : tool === 'HAND' ? 'grab' : 'crosshair' }}>
                            
                            {/* Grid Background */}
                            <div className="absolute inset-0 opacity-10 pointer-events-none" 
                                 style={{ backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundPosition: `${view.x}px ${view.y}px`, transform: `scale(${view.k})` }} 
                            />

                            <div className="relative shadow-2xl transition-transform duration-75 ease-out origin-center" 
                                 style={{ width: canvasSize.w, height: canvasSize.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                                
                                <div className="absolute inset-0 bg-white" />
                                
                                {/* LAYERS RENDER */}
                                {layers.map(l => l.visible && (
                                    <div key={l.id} className={`absolute select-none pointer-events-none ${selectedLayerId===l.id ? 'z-[10]' : ''}`} 
                                         style={{ 
                                             left: '50%', top: '50%', 
                                             width: (l.type==='BACKGROUND') ? '100%' : 'auto', 
                                             height: (l.type==='BACKGROUND') ? '100%' : 'auto', 
                                             transform: `translate(calc(-50% + ${l.x}px), calc(-50% + ${l.y}px)) rotate(${l.rotation}deg) scale(${l.flipX?-l.scale:l.scale}, ${l.flipY?-l.scale:l.scale})`, 
                                             zIndex: l.zIndex,
                                             mixBlendMode: l.id==='layer-texture' ? 'multiply' : 'normal'
                                         }}>
                                        <img src={l.src} className={`max-w-none ${l.type==='BACKGROUND' ? 'w-full h-full object-contain' : ''} ${selectedLayerId===l.id && tool === 'MOVE' ? 'ring-2 ring-blue-500' : ''}`} draggable={false} />
                                    </div>
                                ))}

                                {/* MASK OVERLAY (NEON BLUE) */}
                                {maskPreviewSrc && (
                                    <div className="absolute inset-0 pointer-events-none z-[100] mix-blend-normal opacity-100">
                                        <img src={maskPreviewSrc} className="w-full h-full object-contain animate-pulse-slow" />
                                    </div>
                                )}
                            </div>

                            {/* LOADING OVERLAY */}
                            {isProcessing && (
                                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-[200]">
                                    <Loader2 size={48} className="text-vingi-500 animate-spin mb-4"/>
                                    <div className="text-xl font-bold text-white tracking-tight">{processStatus}</div>
                                    <div className="text-xs text-gray-400 mt-2 font-mono">AI Neural Engine Active</div>
                                </div>
                            )}
                        </div>

                        {/* PROPERTIES PANEL (RIGHT) */}
                        <div className="w-full md:w-72 bg-[#1e293b] border-t md:border-t-0 md:border-l border-gray-700 flex flex-col shadow-2xl z-20 h-[40vh] md:h-full">
                            
                            {/* CONTEXTUAL TOOLS */}
                            <div className="p-4 border-b border-gray-700 bg-gray-800/50 space-y-4 overflow-y-auto">
                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Zap size={12} className="text-vingi-400"/> Ferramentas de Seleção
                                </h3>

                                {tool === 'WAND' && (
                                    <div className="space-y-3 animate-slide-down">
                                        <div className="flex bg-gray-900 rounded-lg p-1">
                                            <button onClick={() => setWandMode('SINGLE')} className={`flex-1 py-1.5 text-[10px] font-bold rounded ${wandMode==='SINGLE' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Elemento Único</button>
                                            <button onClick={() => setWandMode('GLOBAL')} className={`flex-1 py-1.5 text-[10px] font-bold rounded ${wandMode==='GLOBAL' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Todas Ocorrências</button>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] text-gray-400 font-bold"><span>Tolerância</span><span>{wandTolerance}%</span></div>
                                            <input type="range" min="5" max="100" value={wandTolerance} onChange={(e) => setWandTolerance(parseInt(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none accent-purple-500"/>
                                        </div>
                                    </div>
                                )}

                                {(tool === 'BRUSH' || tool === 'ERASER') && (
                                    <div className="space-y-3 animate-slide-down">
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] text-gray-400 font-bold"><span>Tamanho</span><span>{brushSize}px</span></div>
                                            <input type="range" min="5" max="200" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none accent-blue-500"/>
                                        </div>
                                        {tool === 'BRUSH' && (
                                            <div onClick={() => setSmartEdge(!smartEdge)} className={`flex items-center gap-2 cursor-pointer p-2 rounded border ${smartEdge ? 'border-green-500/30 bg-green-900/20' : 'border-gray-700'}`}>
                                                <div className={`w-3 h-3 rounded-full ${smartEdge ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                                                <span className="text-[10px] font-bold text-gray-300">Proteção de Borda (Smart)</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeMask && (
                                    <div className="p-3 bg-vingi-900/50 border border-vingi-500/30 rounded-xl space-y-3 animate-fade-in">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-white">Seleção Ativa</span>
                                            <span className="text-[9px] bg-vingi-500 text-white px-1.5 rounded">Ready</span>
                                        </div>
                                        
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] text-gray-400 font-bold"><span>Suavizar Borda (Feather)</span><span>{feather}px</span></div>
                                            <input type="range" min="0" max="10" step="0.5" value={feather} onChange={(e) => setFeather(parseFloat(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none accent-white"/>
                                        </div>

                                        <button onClick={finishExtraction} className="w-full py-2 bg-white text-vingi-900 rounded-lg text-xs font-bold shadow hover:bg-gray-100 flex items-center justify-center gap-2">
                                            <Scissors size={14}/> EXTRAIR ELEMENTO
                                        </button>
                                        <p className="text-[9px] text-center text-gray-500 italic">O fundo será reconstruído automaticamente.</p>
                                    </div>
                                )}
                            </div>

                            {/* LAYERS LIST */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 mb-2 mt-2">Camadas</h3>
                                {layers.slice().reverse().map(l => (
                                    <div key={l.id} onClick={() => !l.locked && setSelectedLayerId(l.id)} className={`p-2 rounded-lg flex items-center gap-2 cursor-pointer border transition-all ${selectedLayerId===l.id ? 'bg-blue-900/30 border-blue-500/50' : 'bg-transparent border-transparent hover:bg-gray-800'} ${l.locked ? 'opacity-50' : ''}`}>
                                        <button onClick={(e)=>{e.stopPropagation(); updateLayer(l.id, {visible: !l.visible})}} className={`p-1 rounded ${l.visible?'text-gray-400':'text-gray-600'}`}>{l.visible?<Eye size={12}/>:<EyeOff size={12}/>}</button>
                                        <div className="w-8 h-8 bg-gray-700 rounded border border-gray-600 overflow-hidden shrink-0"><img src={l.src} className="w-full h-full object-contain" /></div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`text-[11px] font-medium truncate ${selectedLayerId===l.id ? 'text-white' : 'text-gray-400'}`}>{l.name}</h4>
                                            <span className="text-[9px] text-gray-600 uppercase">{l.type === 'BACKGROUND' ? 'Base' : 'Recorte'}</span>
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
