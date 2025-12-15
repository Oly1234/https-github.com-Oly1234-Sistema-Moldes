import React, { useState, useRef, useEffect } from 'react';
import { Layers, Move, Plus, Trash2, Eye, EyeOff, Lock, Unlock, Wand2, Download, Eraser, Undo, Redo, Image as ImageIcon, Sparkles, Loader2, GripVertical, CheckCircle2, RotateCw, ZoomIn, Info, UploadCloud, ArrowRight, Shirt, MousePointer2 } from 'lucide-react';
import { DesignLayer, PantoneColor } from '../types';

// --- HELPER: REMOVE WHITE BACKGROUND (Simple Alpha Matting) ---
const removeWhiteBackground = (imgSrc: string, tolerance: number = 30): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = imgSrc;
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
                if (r > 255 - tolerance && g > 255 - tolerance && b > 255 - tolerance) { data[i + 3] = 0; }
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL());
        };
    });
};

// --- HELPER: CONNECTED COMPONENT EXTRACTION (The Vingi Engine) ---
// Identifica ilhas de pixels não-transparentes e separa em camadas
const extractIslands = (sourceCanvas: HTMLCanvasElement, tolerance: number = 20): Promise<{ layers: DesignLayer[], cleanBackground: string | null }> => {
    return new Promise((resolve) => {
        const w = sourceCanvas.width;
        const h = sourceCanvas.height;
        const ctx = sourceCanvas.getContext('2d')!;
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const visited = new Uint8Array(w * h); // Map de pixels visitados
        const newLayers: DesignLayer[] = [];

        // Verifica se o pixel é "fundo" (aqui assumimos fundo claro/branco ou transparente da imagem processada pela IA)
        // Se a imagem for complexa, idealmente a IA já nos deu o background limpo, e aqui separamos o resto.
        const isContent = (idx: number) => data[idx + 3] > 0; // Alpha > 0

        let islandCount = 0;
        const minIslandSize = 400; // Ignora ruídos menores que ~20x20px

        for (let y = 0; y < h; y += 5) { // Step 5 para performance inicial
            for (let x = 0; x < w; x += 5) {
                const startIdx = (y * w + x) * 4;
                if (isContent(startIdx) && visited[y * w + x] === 0) {
                    
                    // FOUND NEW ISLAND -> FLOOD FILL TO EXTRACT
                    const stack = [[x, y]];
                    let minX = w, maxX = 0, minY = h, maxY = 0;
                    const islandPixels: number[] = []; // Indices

                    while (stack.length > 0) {
                        const [cx, cy] = stack.pop()!;
                        const pIdx = cy * w + cx;
                        
                        if (visited[pIdx] === 1) continue;
                        visited[pIdx] = 1;
                        
                        // Bounds
                        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
                        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
                        
                        islandPixels.push(pIdx);

                        // Check Neighbors (4-connectivity)
                        const neighbors = [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]];
                        for (const [nx, ny] of neighbors) {
                            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                                const nIdx = ny * w + nx;
                                const nPos = nIdx * 4;
                                if (visited[nIdx] === 0 && data[nPos+3] > 10) { // Threshold de alpha
                                    // Tolerancia de cor simples: se for muito diferente, pode ser outro objeto colado?
                                    // Para estampas, assumimos contiguidade espacial = mesmo objeto.
                                    stack.push([nx, ny]);
                                }
                            }
                        }
                    }

                    // Se a ilha for grande o suficiente, cria camada
                    if (islandPixels.length > minIslandSize) {
                        const lW = maxX - minX + 1;
                        const lH = maxY - minY + 1;
                        const layerCanvas = document.createElement('canvas');
                        layerCanvas.width = lW; layerCanvas.height = lH;
                        const lCtx = layerCanvas.getContext('2d')!;
                        const lImgData = lCtx.createImageData(lW, lH);
                        
                        for (const pIdx of islandPixels) {
                            const srcPos = pIdx * 4;
                            // Coordenadas locais na nova camada
                            const ly = Math.floor(pIdx / w) - minY;
                            const lx = (pIdx % w) - minX;
                            const dstPos = (ly * lW + lx) * 4;
                            
                            lImgData.data[dstPos] = data[srcPos];     // R
                            lImgData.data[dstPos+1] = data[srcPos+1]; // G
                            lImgData.data[dstPos+2] = data[srcPos+2]; // B
                            lImgData.data[dstPos+3] = data[srcPos+3]; // A
                            
                            // Opcional: Apagar da origem? Não, vamos deixar a "base" intacta por enquanto ou usar mask.
                        }
                        lCtx.putImageData(lImgData, 0, 0);

                        islandCount++;
                        newLayers.push({
                            id: `auto-${Date.now()}-${islandCount}`,
                            type: 'ELEMENT',
                            name: `Elemento ${islandCount}`,
                            src: layerCanvas.toDataURL(),
                            x: (minX + lW/2) - w/2, // Centralizado relativo ao centro do canvas (0,0)
                            y: (minY + lH/2) - h/2,
                            scale: 1, rotation: 0, visible: true, locked: false, zIndex: islandCount + 10
                        });
                    }
                }
            }
        }
        resolve({ layers: newLayers, cleanBackground: null });
    });
};

interface LayerStudioProps {
    onNavigateBack?: () => void;
    onNavigateToMockup?: () => void; // Nova Prop
}

export const LayerStudio: React.FC<LayerStudioProps> = ({ onNavigateBack, onNavigateToMockup }) => {
    // --- STATE ---
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 800, h: 800 });
    
    // Magic Edit State
    const [magicPrompt, setMagicPrompt] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState('');

    // Transform Controls
    const [transformMode, setTransformMode] = useState<'IDLE' | 'DRAG' | 'ROTATE' | 'SCALE'>('IDLE');
    const [startInteraction, setStartInteraction] = useState<{x: number, y: number, val: number} | null>(null);

    // Refs
    const workspaceRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- LOGIC: WORKFLOW AUTOMATION ---
    const startDecomposition = async (sourceImage: string) => {
        setIsProcessing(true);
        setProcessStatus('Inicializando Vingi Decomposer 2.0...');

        try {
            // Passo 1: Obter "Clean Background" da IA (Inpainting do fundo total)
            // Isso garante que quando movermos as camadas, o fundo exista.
            setProcessStatus('IA: Regenerando Fundo Infinito...');
            
            const decompositionRes = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'DECOMPOSE_PATTERN',
                    mainImageBase64: sourceImage.split(',')[1],
                    mainMimeType: 'image/jpeg'
                })
            });
            const decompData = await decompositionRes.json();
            
            // Camada 0: Background Regenerado (Ou a imagem original se falhar)
            const bgSrc = decompData.success && decompData.backgroundLayer ? decompData.backgroundLayer : sourceImage;
            
            const backgroundLayer: DesignLayer = {
                id: 'bg-master',
                type: 'BACKGROUND',
                name: 'Fundo (IA Inpainted)',
                src: bgSrc,
                x: 0, y: 0, scale: 1, rotation: 0,
                visible: true, locked: true, zIndex: 0
            };

            // Passo 2: Extração de Elementos (Client-Side Logic)
            // Se a IA retornou elementos isolados, usamos. Se não, usamos nosso motor de recorte.
            let elementLayers: DesignLayer[] = [];

            if (decompData.elements && decompData.elements.length > 0) {
                 // IA conseguiu separar
                 setProcessStatus('Processando Elementos da IA...');
                 for (let i = 0; i < decompData.elements.length; i++) {
                    const el = decompData.elements[i];
                    const cleanSrc = await removeWhiteBackground(el.src);
                    elementLayers.push({
                        id: `ia-el-${i}`, type: 'ELEMENT', name: el.name || `Motivo IA ${i+1}`,
                        src: cleanSrc, x: 0, y: 0, scale: 0.8, rotation: 0, visible: true, locked: false, zIndex: 10 + i
                    });
                 }
            } else {
                 // Fallback: Usar motor de recorte local na imagem original
                 // Para isso, precisamos remover o fundo da imagem original primeiro
                 setProcessStatus('Motor Visual: Recortando Camadas...');
                 
                 // Carrega imagem em canvas offscreen
                 const tempImg = new Image();
                 tempImg.src = sourceImage;
                 await new Promise(r => tempImg.onload = r);
                 const tempCanvas = document.createElement('canvas');
                 tempCanvas.width = tempImg.width; tempCanvas.height = tempImg.height;
                 const tCtx = tempCanvas.getContext('2d')!;
                 tCtx.drawImage(tempImg, 0, 0);
                 
                 // Tenta extrair ilhas (Assumindo que a imagem original tem fundo distinto ou transparente)
                 // Se for JPG chapado, é difícil. O ideal é usar o resultado da IA "elements" se possível.
                 // Mas vamos tentar extrair da imagem original mesmo assim.
                 const extracted = await extractIslands(tempCanvas);
                 elementLayers = extracted.layers;
            }

            // Fallback final: Se nada foi separado, cria um elemento "Clone" móvel da imagem original
            if (elementLayers.length === 0) {
                elementLayers.push({
                    id: 'clone-master', type: 'ELEMENT', name: 'Estampa Original',
                    src: sourceImage, x: 0, y: 0, scale: 0.9, rotation: 0, visible: true, locked: false, zIndex: 10
                });
            }

            setLayers([backgroundLayer, ...elementLayers]);
            if (elementLayers.length > 0) setSelectedLayerId(elementLayers[0].id);

        } catch (e) {
            console.error(e);
            setProcessStatus('Erro na decomposição automática.');
            // Fallback seguro
            setLayers([{
                id: 'fallback', type: 'BACKGROUND', name: 'Imagem Original',
                src: sourceImage, x: 0, y: 0, scale: 1, rotation: 0, visible: true, locked: true, zIndex: 0
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- INITIALIZATION ---
    useEffect(() => {
        const sourceImage = localStorage.getItem('vingi_layer_studio_source');
        if (sourceImage && layers.length === 0) {
            startDecomposition(sourceImage);
            localStorage.removeItem('vingi_layer_studio_source');
        }
    }, []);

    // --- ACTIONS ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const res = ev.target?.result as string;
                if (res) startDecomposition(res);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleMagicCreate = async () => {
        if (!magicPrompt) return;
        setIsProcessing(true);
        setProcessStatus('Gerando novo elemento...');
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'GENERATE_ELEMENT', prompt: magicPrompt })
            });
            const data = await response.json();
            if (data.success && data.element) {
                const transparentSrc = await removeWhiteBackground(data.element);
                const newLayer: DesignLayer = {
                    id: `gen-${Date.now()}`, type: 'ELEMENT', name: magicPrompt.slice(0, 15),
                    src: transparentSrc, x: 0, y: 0, scale: 0.5, rotation: 0, visible: true, locked: false, zIndex: layers.length + 10
                };
                setLayers(prev => [...prev, newLayer]);
                setSelectedLayerId(newLayer.id);
                setMagicPrompt('');
            }
        } catch (e) { console.error(e); } finally { setIsProcessing(false); }
    };

    const updateLayer = (id: string, updates: Partial<DesignLayer>) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    };

    const deleteLayer = (id: string) => {
        setLayers(prev => prev.filter(l => l.id !== id));
        if (selectedLayerId === id) setSelectedLayerId(null);
    };

    const sendToMockup = async () => {
        setIsProcessing(true);
        setProcessStatus('Renderizando composição...');
        setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = 1024; canvas.height = 1024;
            const ctx = canvas.getContext('2d')!;
            const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
            
            const draw = async () => {
                for (const layer of sorted) {
                    if (!layer.visible) continue;
                    await new Promise<void>((resolve) => {
                        const img = new Image(); img.src = layer.src;
                        img.onload = () => {
                            ctx.save();
                            const ratio = 1024 / 800;
                            const cx = 512 + (layer.x * ratio);
                            const cy = 512 + (layer.y * ratio);
                            ctx.translate(cx, cy);
                            ctx.rotate((layer.rotation * Math.PI) / 180);
                            ctx.scale(layer.scale * ratio, layer.scale * ratio);
                            ctx.drawImage(img, -img.width/2, -img.height/2);
                            ctx.restore();
                            resolve();
                        };
                    });
                }
                const finalImage = canvas.toDataURL('image/jpeg', 0.9);
                localStorage.setItem('vingi_mockup_pattern', finalImage);
                setIsProcessing(false);
                if (onNavigateToMockup) onNavigateToMockup();
            };
            draw();
        }, 100);
    };

    // --- INTERACTION CONTROLS ---
    const handleMouseDown = (e: React.MouseEvent, type: 'CANVAS' | 'HANDLE_ROT' | 'HANDLE_SCALE', layerId?: string) => {
        if (!layerId && !selectedLayerId) return;
        const targetId = layerId || selectedLayerId!;
        const layer = layers.find(l => l.id === targetId);
        if (!layer || layer.locked) return;

        e.stopPropagation();
        setSelectedLayerId(targetId);

        if (type === 'CANVAS') {
            setTransformMode('DRAG');
            setStartInteraction({ x: e.clientX, y: e.clientY, val: 0 }); // Val not used for drag
        } else if (type === 'HANDLE_ROT') {
            setTransformMode('ROTATE');
            setStartInteraction({ x: e.clientX, y: e.clientY, val: layer.rotation });
        } else if (type === 'HANDLE_SCALE') {
            setTransformMode('SCALE');
            setStartInteraction({ x: e.clientX, y: e.clientY, val: layer.scale });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!startInteraction || !selectedLayerId) return;
        const layer = layers.find(l => l.id === selectedLayerId)!;
        
        const dx = e.clientX - startInteraction.x;
        const dy = e.clientY - startInteraction.y;

        if (transformMode === 'DRAG') {
            updateLayer(selectedLayerId, { x: layer.x + dx, y: layer.y + dy });
            setStartInteraction({ x: e.clientX, y: e.clientY, val: 0 });
        } 
        else if (transformMode === 'SCALE') {
            // Simple logic: Dragging right/down increases scale
            const delta = (dx + dy) / 200; // sensitivity
            const newScale = Math.max(0.1, startInteraction.val + delta);
            updateLayer(selectedLayerId, { scale: newScale });
        }
        else if (transformMode === 'ROTATE') {
             // Rotation logic relative to center could be complex, simplifying to linear drag
             const delta = dx / 2;
             updateLayer(selectedLayerId, { rotation: (startInteraction.val + delta) % 360 });
        }
    };

    const handleMouseUp = () => {
        setTransformMode('IDLE');
        setStartInteraction(null);
    };

    // --- RENDER ---
    if (layers.length === 0 && !isProcessing) {
        return (
            <div className="flex flex-col h-full w-full bg-[#f8fafc] items-center justify-center p-6 animate-fade-in">
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-2xl w-full text-center space-y-8">
                    <div className="mx-auto w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 mb-4">
                        <Layers size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Layer Studio AI</h1>
                        <p className="text-gray-500 text-lg">
                            Decomposição inteligente de estampas. Envie uma imagem para a IA separar o fundo dos elementos, permitindo edição completa.
                        </p>
                    </div>
                    <div onClick={() => fileInputRef.current?.click()} className="border-3 border-dashed border-gray-300 rounded-2xl p-12 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer group">
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                        <UploadCloud size={48} className="mx-auto text-gray-400 group-hover:text-indigo-500 mb-4 transition-colors" />
                        <h3 className="text-xl font-bold text-gray-700 group-hover:text-indigo-600">Carregar Estampa para Separar</h3>
                        <p className="text-sm text-gray-400 mt-2">IA: Inpainting de Fundo + Extração de Motivos</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-[#1e293b] text-white overflow-hidden" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            {/* WORKSPACE */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#0f172a]" ref={workspaceRef}>
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}/>
                
                <div className="relative bg-white/5 shadow-2xl overflow-hidden" style={{ width: canvasSize.w, height: canvasSize.h }}>
                    {layers.sort((a,b) => a.zIndex - b.zIndex).map(layer => (
                        layer.visible && (
                            <div key={layer.id}
                                onMouseDown={(e) => handleMouseDown(e, 'CANVAS', layer.id)}
                                className={`absolute select-none group ${selectedLayerId === layer.id ? 'z-50' : ''}`}
                                style={{
                                    transform: `translate(calc(-50% + ${layer.x}px), calc(-50% + ${layer.y}px)) rotate(${layer.rotation}deg) scale(${layer.scale})`,
                                    left: '50%', top: '50%', zIndex: layer.zIndex,
                                    cursor: transformMode === 'DRAG' && selectedLayerId === layer.id ? 'grabbing' : 'grab'
                                }}
                            >
                                <img src={layer.src} className={`pointer-events-none max-w-none ${selectedLayerId === layer.id ? 'drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]' : ''}`}
                                    style={{ width: layer.type === 'BACKGROUND' ? canvasSize.w : 'auto', height: layer.type === 'BACKGROUND' ? canvasSize.h : 'auto', objectFit: 'cover' }}
                                />
                                
                                {/* CONTROLS FRAME */}
                                {selectedLayerId === layer.id && !layer.locked && (
                                    <div className="absolute inset-0 border-2 border-vingi-500 pointer-events-none">
                                        {/* Rotate Handle */}
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-white text-vingi-900 rounded-full flex items-center justify-center cursor-alias shadow-lg pointer-events-auto"
                                            onMouseDown={(e) => handleMouseDown(e, 'HANDLE_ROT', layer.id)}>
                                            <RotateCw size={12}/>
                                        </div>
                                        {/* Scale Handle */}
                                        <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-vingi-500 rounded-full flex items-center justify-center cursor-nwse-resize shadow-lg pointer-events-auto"
                                            onMouseDown={(e) => handleMouseDown(e, 'HANDLE_SCALE', layer.id)}>
                                            <Move size={12} className="text-white"/>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    ))}
                    {isProcessing && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-[100]">
                            <Loader2 size={48} className="text-vingi-500 animate-spin mb-4"/>
                            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-vingi-400 to-purple-400 animate-pulse">{processStatus}</h3>
                        </div>
                    )}
                </div>
            </div>

            {/* SIDEBAR PANEL */}
            <div className="w-80 bg-[#1e293b] border-l border-gray-700 flex flex-col shadow-2xl z-20">
                <div className="p-4 border-b border-gray-700 bg-[#0f172a] flex justify-between items-center">
                    <h2 className="font-bold flex items-center gap-2"><Layers size={18} className="text-vingi-500"/> Camadas</h2>
                    <button onClick={sendToMockup} className="text-xs bg-vingi-600 hover:bg-vingi-500 px-3 py-1.5 rounded flex items-center gap-1 transition-colors font-bold">
                        <Shirt size={12}/> Provar
                    </button>
                </div>

                {/* MAGIC EDIT */}
                <div className="p-4 bg-gray-800/50 border-b border-gray-700">
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-vingi-400 uppercase tracking-widest">
                        <Sparkles size={12}/> Gerar Elemento
                    </div>
                    <div className="flex gap-2">
                        <input type="text" value={magicPrompt} onChange={(e) => setMagicPrompt(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && handleMagicCreate()} placeholder="Ex: Borboleta azul..." 
                            className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-vingi-500 outline-none text-white" />
                        <button onClick={handleMagicCreate} disabled={!magicPrompt || isProcessing} className="bg-gradient-to-br from-vingi-600 to-purple-600 p-2 rounded-lg hover:brightness-110 disabled:opacity-50">
                            <Wand2 size={18} className="text-white"/>
                        </button>
                    </div>
                </div>

                {/* LAYER LIST */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {layers.slice().reverse().map(layer => (
                        <div key={layer.id} onClick={() => setSelectedLayerId(layer.id)}
                            className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer border transition-all ${selectedLayerId === layer.id ? 'bg-vingi-900/50 border-vingi-500/50' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
                            <div className="w-10 h-10 bg-gray-900 rounded overflow-hidden shrink-0 border border-gray-600 relative">
                                <img src={layer.src} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/checkerboard-crosshairs.png')] opacity-30"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-gray-200 truncate">{layer.name}</h4>
                                <span className="text-[9px] text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded uppercase">{layer.type === 'BACKGROUND' ? 'Fundo IA' : 'Motivo'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }) }} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-600">
                                    {layer.visible ? <Eye size={12}/> : <EyeOff size={12}/>}
                                </button>
                                {!layer.locked && <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id) }} className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-gray-600"><Trash2 size={12}/></button>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};