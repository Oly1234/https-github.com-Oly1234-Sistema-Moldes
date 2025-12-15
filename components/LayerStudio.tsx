
import React, { useState, useRef, useEffect } from 'react';
import { Layers, Move, Trash2, Eye, EyeOff, Lock, Unlock, Wand2, Download, Image as ImageIcon, Sparkles, Loader2, RotateCw, ZoomIn, Info, UploadCloud, ArrowRight, Shirt, MousePointer2, Scissors, PaintBucket, Sliders, Scan, Copy, ChevronRight, Check } from 'lucide-react';
import { DesignLayer } from '../types';

// --- MODULE 1: THE COLORIST (LAB Color Space Conversion) ---
// Permite selecionar objetos inteiros ignorando sombras/luzes simples
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

// --- MODULE 2: THE SELECTOR (Smart Mask Generation) ---
const getSmartMask = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    startX: number, 
    startY: number, 
    tolerance: number,
    mode: 'CONTIGUOUS' | 'GLOBAL'
) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const visited = new Uint8Array(width * height); // 0=no, 1=yes
    const mask = new Uint8Array(width * height); // 0=bg, 255=fg
    
    // Pega cor alvo (LAB)
    const p = (startY * width + startX) * 4;
    if (data[p + 3] === 0) return { mask, bounds: null }; // Clique transparente
    const [l0, a0, b0] = rgbToLab(data[p], data[p+1], data[p+2]);

    // Stack para Flood Fill
    const stack = [[startX, startY]];
    
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let hasPixels = false;

    // Helper de Comparação LAB (Euclidiana)
    const isSimilar = (idx: number) => {
        const pos = idx * 4;
        if (data[pos+3] === 0) return false; // Ignora transparente
        const [l, a, b] = rgbToLab(data[pos], data[pos+1], data[pos+2]);
        // Delta E simples
        const dist = Math.sqrt((l-l0)**2 + (a-a0)**2 + (b-b0)**2);
        return dist < tolerance;
    };

    if (mode === 'GLOBAL') {
        for(let i=0; i<width*height; i++) {
            if (isSimilar(i)) {
                mask[i] = 255;
                const cx = i % width; const cy = Math.floor(i / width);
                if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
                hasPixels = true;
            }
        }
    } else {
        // Flood Fill Contíguo
        while (stack.length) {
            const [x, y] = stack.pop()!;
            const idx = y * width + x;
            if (visited[idx]) continue;
            visited[idx] = 1;

            if (isSimilar(idx)) {
                mask[idx] = 255;
                hasPixels = true;
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;

                if (x > 0) stack.push([x - 1, y]);
                if (x < width - 1) stack.push([x + 1, y]);
                if (y > 0) stack.push([x, y - 1]);
                if (y < height - 1) stack.push([x, y + 1]);
            }
        }
    }

    return hasPixels 
        ? { mask, bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } }
        : { mask, bounds: null };
};

// --- MODULE 3: THE REFINER (Edge Smoothing & Anti-aliasing) ---
const refineMask = (mask: Uint8Array, width: number, height: number, smoothing: number) => {
    if (smoothing <= 0) return mask;

    // 1. DILATE (Expandir levemente para garantir a borda)
    // Simulação simples: se um vizinho é 255, eu viro 255.
    const dilated = new Uint8Array(mask);
    const passes = 1; 
    for(let p=0; p<passes; p++) {
        const temp = new Uint8Array(dilated);
        for(let i=0; i<width*height; i++) {
            if (dilated[i] === 0) {
                // Checa vizinhos
                const x = i % width; const y = Math.floor(i / width);
                if ((x>0 && dilated[i-1]) || (x<width-1 && dilated[i+1]) || (y>0 && dilated[i-width]) || (y<height-1 && dilated[i+width])) {
                    temp[i] = 128; // Borda suave
                }
            }
        }
        dilated.set(temp);
    }
    return dilated;
};

// --- MODULE 4: THE HEALER (Inpainting Background) ---
const healBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, mask: Uint8Array) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    
    // Inpainting Simples: Iterative Diffusion
    // Expande a máscara de "dano" para garantir que a borda antiga suma
    const damageMask = new Uint8Array(mask); // 255 onde estava o objeto
    
    // Iterações de preenchimento
    const iterations = 20;
    for (let it = 0; it < iterations; it++) {
        const nextData = new Uint8ClampedArray(data);
        let filledCount = 0;

        for (let i = 0; i < width * height; i++) {
            if (damageMask[i] > 0 || data[i * 4 + 3] === 0) { // Se é área de dano ou transparente
                let r=0, g=0, b=0, count=0;
                
                // Sampling de vizinhos distantes para textura
                const dist = (it % 3) + 1; // 1, 2, 3 pixels
                const x = i % width; const y = Math.floor(i / width);

                const neighbors = [
                    [x-dist, y], [x+dist, y], [x, y-dist], [x, y+dist],
                    [x-dist, y-dist], [x+dist, y+dist]
                ];

                for (const [nx, ny] of neighbors) {
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const ni = ny * width + nx;
                        if (damageMask[ni] === 0 && data[ni*4+3] > 0) { // Vizinho SAUDÁVEL
                            r += data[ni*4]; g += data[ni*4+1]; b += data[ni*4+2];
                            count++;
                        }
                    }
                }

                if (count > 0) {
                    nextData[i*4] = r/count; nextData[i*4+1] = g/count; nextData[i*4+2] = b/count; nextData[i*4+3] = 255;
                    damageMask[i] = 0; // Heal
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
    const [wandMode, setWandMode] = useState<'CONTIGUOUS' | 'GLOBAL'>('CONTIGUOUS');
    const [wandTolerance, setWandTolerance] = useState(25); // LAB Tolerance
    const [edgeSmoothing, setEdgeSmoothing] = useState(1); // Anti-alias level
    
    const [magicPrompt, setMagicPrompt] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState('');
    const [incomingImage, setIncomingImage] = useState<string | null>(null);

    const [transformMode, setTransformMode] = useState<'IDLE' | 'DRAG' | 'ROTATE' | 'SCALE'>('IDLE');
    const [startInteraction, setStartInteraction] = useState<{x: number, y: number, val: number} | null>(null);

    const workspaceRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const sourceImage = localStorage.getItem('vingi_layer_studio_source');
        if (sourceImage) {
            setIncomingImage(sourceImage);
            localStorage.removeItem('vingi_layer_studio_source');
        }
    }, []);

    // --- MAIN ACTION: MAGIC EXTRACTION ---
    const handleMagicWandClick = async (e: React.MouseEvent, layerId: string) => {
        const targetLayer = layers.find(l => l.id === layerId);
        if (!targetLayer) return;

        setIsProcessing(true);
        // Coords Mapping
        const layerEl = document.getElementById(`layer-visual-${layerId}`);
        if (!layerEl) { setIsProcessing(false); return; }
        const rect = layerEl.getBoundingClientRect();
        
        // Carga da Imagem
        const img = new Image();
        img.src = targetLayer.src;
        await new Promise(r => img.onload = r);

        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        const relX = (e.clientX - rect.left) / rect.width;
        const relY = (e.clientY - rect.top) / rect.height;
        const startX = Math.floor(relX * img.width);
        const startY = Math.floor(relY * img.height);

        // PIPELINE EXECUTION
        const executePipeline = async () => {
            // STEP 1: SELECTOR
            setProcessStatus('Varredura: Identificando Objeto (LAB)...');
            await new Promise(r => setTimeout(r, 10)); // UI Refresh
            const { mask, bounds } = getSmartMask(ctx, canvas.width, canvas.height, startX, startY, wandTolerance, wandMode);
            
            if (!bounds || bounds.w < 5 || bounds.h < 5) {
                setProcessStatus('Seleção vazia ou muito pequena.');
                setTimeout(() => { setIsProcessing(false); setProcessStatus(''); }, 1000);
                return;
            }

            // STEP 2: REFINER
            setProcessStatus('Refinador: Suavizando Arestas...');
            await new Promise(r => setTimeout(r, 10));
            const refinedMask = refineMask(mask, canvas.width, canvas.height, edgeSmoothing);

            // STEP 3: EXTRACTOR (CROP & POSITION)
            setProcessStatus('Extrator: Recortando Elemento...');
            // Cria canvas apenas do tamanho do objeto (BOUNDS)
            const objCanvas = document.createElement('canvas');
            objCanvas.width = bounds.w; objCanvas.height = bounds.h;
            const objCtx = objCanvas.getContext('2d')!;
            
            // Desenha imagem original no canvas pequeno, deslocada
            // Mas precisamos aplicar a máscara.
            const srcData = ctx.getImageData(bounds.x, bounds.y, bounds.w, bounds.h);
            const maskSlice = new Uint8Array(bounds.w * bounds.h);
            
            // Copia máscara local
            for(let y=0; y<bounds.h; y++) {
                for(let x=0; x<bounds.w; x++) {
                    const globalIdx = (bounds.y + y) * canvas.width + (bounds.x + x);
                    maskSlice[y*bounds.w + x] = refinedMask[globalIdx];
                }
            }

            // Aplica máscara aos pixels
            for(let i=0; i<maskSlice.length; i++) {
                if (maskSlice[i] === 0) srcData.data[i*4+3] = 0; // Transparente
                else if (maskSlice[i] < 255) srcData.data[i*4+3] = Math.min(srcData.data[i*4+3], maskSlice[i]); // Anti-alias alpha
            }
            objCtx.putImageData(srcData, 0, 0);

            // CALCULAR NOVA POSIÇÃO (Reposicionar visualmente no mesmo lugar)
            // Centro do objeto original relativo ao centro da imagem original
            const origCenterX = img.width / 2;
            const origCenterY = img.height / 2;
            const objCenterX = bounds.x + bounds.w / 2;
            const objCenterY = bounds.y + bounds.h / 2;
            
            const deltaX = objCenterX - origCenterX;
            const deltaY = objCenterY - origCenterY;

            // Vetor rotacionado (para acompanhar rotação do pai)
            const rad = (targetLayer.rotation * Math.PI) / 180;
            const rotX = deltaX * Math.cos(rad) - deltaY * Math.sin(rad);
            const rotY = deltaX * Math.sin(rad) + deltaY * Math.cos(rad);

            // STEP 4: HEALER (Only if source is background or locked base)
            let newBaseSrc = targetLayer.src;
            if (targetLayer.type === 'BACKGROUND' || targetLayer.locked) {
                setProcessStatus('Restaurador: Preenchendo Fundo...');
                await new Promise(r => setTimeout(r, 10));
                healBackground(ctx, canvas.width, canvas.height, refinedMask);
                newBaseSrc = canvas.toDataURL();
            }

            // FINAL COMMIT
            const newLayerId = `smart-obj-${Date.now()}`;
            const newLayer: DesignLayer = {
                id: newLayerId,
                type: 'ELEMENT',
                name: 'Elemento Extraído',
                src: objCanvas.toDataURL(),
                x: targetLayer.x + (rotX * targetLayer.scale),
                y: targetLayer.y + (rotY * targetLayer.scale),
                scale: targetLayer.scale,
                rotation: targetLayer.rotation,
                visible: true, locked: false, zIndex: layers.length + 10
            };

            setLayers(prev => prev.map(l => l.id === layerId ? { ...l, src: newBaseSrc } : l).concat(newLayer));
            setSelectedLayerId(newLayerId);
            setTool('MOVE');
            setIsProcessing(false);
            setProcessStatus('');
        };

        executePipeline();
    };

    // --- STANDARD HANDLERS ---
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

    const handleMouseDown = (e: React.MouseEvent, type: 'CANVAS' | 'HANDLE', layerId?: string) => {
        if (tool === 'MAGIC_WAND') {
            if (layerId) handleMagicWandClick(e, layerId);
            return;
        }
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
            // Handle Rot/Scale logic simplified for brevity in this update
            // Assuming corner handle is scale
            setTransformMode('SCALE');
            setStartInteraction({ x: e.clientX, y: e.clientY, val: layer.scale });
        }
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
                        <h1 className="text-3xl font-bold text-gray-800">Layer Studio</h1>
                        <p className="text-gray-500">
                            A nova "Varinha Inteligente" usa espaço de cor LAB e algoritmos de difusão para extrair objetos complexos com um clique.
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
                            
                            {/* Handlers (Visible only on Move Tool) */}
                            {selectedLayerId===l.id && tool==='MOVE' && !l.locked && (
                                <div className="absolute inset-0 border border-blue-500">
                                    <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 cursor-nwse-resize" onMouseDown={(e) => handleMouseDown(e, 'HANDLE', l.id)} />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Loading Overlay */}
                    {isProcessing && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-[100]">
                            <Loader2 size={48} className="text-vingi-500 animate-spin mb-4"/>
                            <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-vingi-400 to-purple-400 animate-pulse">{processStatus}</div>
                            <div className="mt-2 text-xs text-gray-500 font-mono">LAB Color Space Processing</div>
                        </div>
                    )}
                 </div>
            </div>

            {/* SIDEBAR */}
            <div className="w-80 bg-[#1e293b] border-l border-gray-700 flex flex-col shadow-2xl z-20">
                <div className="p-4 bg-[#0f172a] border-b border-gray-700 space-y-4">
                    <h2 className="font-bold flex items-center gap-2"><Layers size={18} className="text-vingi-500"/> Camadas</h2>
                    
                    {/* Botão de Upload na Sidebar */}
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-gray-800 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 hover:text-white transition-colors text-xs font-bold flex items-center justify-center gap-2">
                        <UploadCloud size={14}/> CARREGAR IMAGEM
                    </button>
                    
                    <div className="flex bg-gray-800 p-1 rounded-lg">
                        <button onClick={() => setTool('MOVE')} className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 ${tool==='MOVE' ? 'bg-vingi-600 shadow' : 'text-gray-400'}`}><Move size={14}/> Mover</button>
                        <button onClick={() => setTool('MAGIC_WAND')} className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 ${tool==='MAGIC_WAND' ? 'bg-purple-600 shadow' : 'text-gray-400'}`}><Wand2 size={14}/> Varinha</button>
                    </div>

                    {tool === 'MAGIC_WAND' && (
                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 space-y-4 animate-fade-in">
                            <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase">
                                <span>Configuração de IA</span>
                                <Info size={10}/>
                            </div>
                            
                            <div className="space-y-1">
                                <label className="flex justify-between text-[10px] text-gray-300"><span>Alcance de Cor (LAB)</span> <span>{wandTolerance}</span></label>
                                <input type="range" min="5" max="100" value={wandTolerance} onChange={(e) => setWandTolerance(Number(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"/>
                            </div>

                            <div className="space-y-1">
                                <label className="flex justify-between text-[10px] text-gray-300"><span>Suavização (Anti-alias)</span> <span>{edgeSmoothing}px</span></label>
                                <input type="range" min="0" max="5" step="0.5" value={edgeSmoothing} onChange={(e) => setEdgeSmoothing(Number(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"/>
                            </div>

                            <div className="flex gap-2 pt-1">
                                <button onClick={() => setWandMode('CONTIGUOUS')} className={`flex-1 py-1.5 rounded text-[9px] font-bold border ${wandMode==='CONTIGUOUS'?'border-purple-500 text-purple-300 bg-purple-500/20':'border-gray-600 text-gray-500'}`}>OBJETO ÚNICO</button>
                                <button onClick={() => setWandMode('GLOBAL')} className={`flex-1 py-1.5 rounded text-[9px] font-bold border ${wandMode==='GLOBAL'?'border-purple-500 text-purple-300 bg-purple-500/20':'border-gray-600 text-gray-500'}`}>TODOS IGUAIS</button>
                            </div>
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
