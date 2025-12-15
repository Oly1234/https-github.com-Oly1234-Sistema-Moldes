
import React, { useState, useRef, useEffect } from 'react';
import { Layers, Move, Plus, Trash2, Eye, EyeOff, Lock, Unlock, Wand2, Download, Eraser, Undo, Redo, Image as ImageIcon, Sparkles, Loader2, GripVertical, CheckCircle2, RotateCw, ZoomIn, Info, UploadCloud, ArrowRight, Shirt, MousePointer2, Scissors, PaintBucket, Sliders, Scan, Copy } from 'lucide-react';
import { DesignLayer } from '../types';

// --- HELPER: REMOVE WHITE BACKGROUND ---
const removeWhiteBackground = (imgSrc: string, tolerance: number = 30): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = imgSrc;
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
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

// --- HELPER: PIXEL DIFFUSION INPAINTING (Healing) ---
const healHole = (ctx: CanvasRenderingContext2D, width: number, height: number, maskIndices: Set<number>) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    
    // Configuração de Inpainting
    const dilation = 2; // Expande a máscara para cobrir bordas
    const iterations = 10; // Passadas de suavização
    
    // 1. Dilatação da Máscara (Para pegar bordas semi-transparentes)
    const expandedMask = new Set(maskIndices);
    if (dilation > 0) {
        maskIndices.forEach(idx => {
            const x = idx % width;
            const y = Math.floor(idx / width);
            for (let dy = -dilation; dy <= dilation; dy++) {
                for (let dx = -dilation; dx <= dilation; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        expandedMask.add(ny * width + nx);
                    }
                }
            }
        });
    }

    // 2. Apagar área expandida (Preparar buraco)
    expandedMask.forEach(idx => {
        data[idx * 4 + 3] = 0;
    });

    // 3. Difusão (Preencher buraco com média dos vizinhos)
    for (let i = 0; i < iterations; i++) {
        const newData = new Uint8ClampedArray(data);
        let changed = false;

        expandedMask.forEach(idx => {
            const pos = idx * 4;
            // Se o pixel atual está vazio
            if (data[pos + 3] === 0) {
                const x = idx % width;
                const y = Math.floor(idx / width);
                
                let rSum = 0, gSum = 0, bSum = 0, count = 0;
                
                // Vizinhos (8-way + distância maior para puxar textura)
                const range = i < 2 ? 1 : 2; // Aumenta alcance nas passadas finais
                
                for (let dy = -range; dy <= range; dy++) {
                    for (let dx = -range; dx <= range; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nPos = (ny * width + nx) * 4;
                            if (data[nPos + 3] > 0) { // Vizinho tem cor
                                rSum += data[nPos];
                                gSum += data[nPos + 1];
                                bSum += data[nPos + 2];
                                count++;
                            }
                        }
                    }
                }

                if (count > 0) {
                    newData[pos] = rSum / count;
                    newData[pos + 1] = gSum / count;
                    newData[pos + 2] = bSum / count;
                    newData[pos + 3] = 255; // Recupera opacidade total
                    changed = true;
                }
            }
        });
        
        if (!changed) break;
        imgData.data.set(newData);
        // Atualiza buffer para proxima iteração
        for (let j = 0; j < data.length; j++) data[j] = newData[j];
    }
    
    ctx.putImageData(imgData, 0, 0);
};

// --- HELPER: SMART WAND ALGORITHMS ---
const getSmartSelectionMask = (
    ctx: CanvasRenderingContext2D, 
    startX: number, 
    startY: number, 
    width: number, 
    height: number, 
    tolerance: number,
    mode: 'CONTIGUOUS' | 'GLOBAL'
): Set<number> => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const mask = new Set<number>();
    
    const startPos = (startY * width + startX) * 4;
    if (data[startPos + 3] === 0) return mask; // Clicou no vazio

    const sr = data[startPos];
    const sg = data[startPos + 1];
    const sb = data[startPos + 2];

    const isMatch = (r: number, g: number, b: number, a: number) => {
        if (a === 0) return false;
        // Distância Euclidiana de Cor (Mais precisa que soma simples)
        const dist = Math.sqrt((r - sr)**2 + (g - sg)**2 + (b - sb)**2);
        return dist <= tolerance; 
    };

    if (mode === 'GLOBAL') {
        // GLOBAL SCAN: Procura pixels similares na imagem inteira
        for (let i = 0; i < width * height; i++) {
            const pos = i * 4;
            if (isMatch(data[pos], data[pos+1], data[pos+2], data[pos+3])) {
                mask.add(i);
            }
        }
    } else {
        // CONTIGUOUS FILL: Apenas pixels conectados (Flood Fill)
        const stack = [[startX, startY]];
        const visited = new Uint8Array(width * height);

        while (stack.length) {
            const [x, y] = stack.pop()!;
            const idx = y * width + x;
            
            if (visited[idx]) continue;
            visited[idx] = 1;
            
            const pos = idx * 4;
            if (isMatch(data[pos], data[pos+1], data[pos+2], data[pos+3])) {
                mask.add(idx);
                // Checa vizinhos (4-way)
                if (x > 0) stack.push([x - 1, y]);
                if (x < width - 1) stack.push([x + 1, y]);
                if (y > 0) stack.push([x, y - 1]);
                if (y < height - 1) stack.push([x, y + 1]);
            }
        }
    }
    return mask;
};

interface LayerStudioProps {
    onNavigateBack?: () => void;
    onNavigateToMockup?: () => void;
}

export const LayerStudio: React.FC<LayerStudioProps> = ({ onNavigateBack, onNavigateToMockup }) => {
    // --- STATE ---
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 800, h: 800 });
    
    // Tools State
    const [tool, setTool] = useState<'MOVE' | 'MAGIC_WAND'>('MOVE');
    const [wandMode, setWandMode] = useState<'CONTIGUOUS' | 'GLOBAL'>('CONTIGUOUS');
    const [wandTolerance, setWandTolerance] = useState(40); // 0-255
    
    const [magicPrompt, setMagicPrompt] = useState('');
    
    // Status
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState('');
    const [incomingImage, setIncomingImage] = useState<string | null>(null);

    // Transform Controls
    const [transformMode, setTransformMode] = useState<'IDLE' | 'DRAG' | 'ROTATE' | 'SCALE'>('IDLE');
    const [startInteraction, setStartInteraction] = useState<{x: number, y: number, val: number} | null>(null);

    const workspaceRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- INITIALIZATION ---
    useEffect(() => {
        const sourceImage = localStorage.getItem('vingi_layer_studio_source');
        if (sourceImage) {
            setIncomingImage(sourceImage);
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
                if (res) setIncomingImage(res);
            };
            reader.readAsDataURL(file);
        }
    };

    const startDecomposition = async (sourceImage: string) => {
        // Modo "Auto" agora é uma simplificação que isola fundo + objeto principal via IA
        // Mas a UI principal foca na Varinha Mágica para precisão.
        setIsProcessing(true);
        setIncomingImage(null);
        setProcessStatus('Preparando imagem para edição...');
        
        setTimeout(() => {
            // Inicializa como Fundo para ser editado
            setLayers([{
                id: 'base-master', type: 'BACKGROUND', name: 'Estampa Original',
                src: sourceImage, x: 0, y: 0, scale: 1, rotation: 0, visible: true, locked: true, zIndex: 0
            }]);
            setTool('MAGIC_WAND'); // Ativa a ferramenta automaticamente
            setIsProcessing(false);
        }, 500);
    };

    // --- CORE LOGIC: SMART WAND ---
    const handleMagicWandClick = async (e: React.MouseEvent, layerId: string) => {
        const targetLayer = layers.find(l => l.id === layerId);
        if (!targetLayer) return;

        setIsProcessing(true);
        setProcessStatus(wandMode === 'GLOBAL' ? 'Detectando elementos repetidos...' : 'Isolando objeto...');

        setTimeout(async () => {
            const img = new Image();
            img.src = targetLayer.src;
            await new Promise(r => img.onload = r);

            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);

            // Mapeamento de Coordenadas
            const layerEl = document.getElementById(`layer-visual-${layerId}`);
            if (!layerEl) { setIsProcessing(false); return; }
            const rect = layerEl.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width;
            const relY = (e.clientY - rect.top) / rect.height;
            const x = Math.floor(relX * img.width);
            const y = Math.floor(relY * img.height);

            // 1. SMART MASK GENERATION
            const mask = getSmartSelectionMask(ctx, x, y, canvas.width, canvas.height, wandTolerance, wandMode);
            
            if (mask.size < 50) {
                setIsProcessing(false);
                return; // Ignora cliques inválidos
            }

            // 2. EXTRACT ELEMENT
            const newLayerCanvas = document.createElement('canvas');
            newLayerCanvas.width = canvas.width; newLayerCanvas.height = canvas.height;
            const newCtx = newLayerCanvas.getContext('2d')!;
            const newImgData = newCtx.createImageData(canvas.width, canvas.height);
            const originalData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

            mask.forEach(idx => {
                const pos = idx * 4;
                newImgData.data[pos] = originalData[pos];
                newImgData.data[pos+1] = originalData[pos+1];
                newImgData.data[pos+2] = originalData[pos+2];
                newImgData.data[pos+3] = originalData[pos+3];
            });
            newCtx.putImageData(newImgData, 0, 0);

            // 3. HEAL BACKGROUND (Somente se for o background ou layer trancada que queremos editar)
            // Se estivermos tirando de um elemento flutuante, apenas recortamos.
            // Se for background, precisamos cicatrizar.
            setProcessStatus('Recriando o fundo...');
            healHole(ctx, canvas.width, canvas.height, mask);

            // 4. UPDATE STATE
            const newLayerSrc = newLayerCanvas.toDataURL();
            const healedBaseSrc = canvas.toDataURL();

            const newLayerId = `ext-${Date.now()}`;
            const newLayer: DesignLayer = {
                ...targetLayer,
                id: newLayerId,
                type: 'ELEMENT',
                name: wandMode === 'GLOBAL' ? 'Grupo Extraído' : 'Elemento Extraído',
                src: newLayerSrc,
                zIndex: layers.length + 10,
                locked: false,
                // Leve deslocamento e feedback
                x: targetLayer.x + (wandMode === 'GLOBAL' ? 0 : 20), 
                y: targetLayer.y - (wandMode === 'GLOBAL' ? 0 : 20),
                scale: targetLayer.scale, // Mantém escala original para bater
            };

            setLayers(prev => prev.map(l => l.id === layerId ? { ...l, src: healedBaseSrc } : l).concat(newLayer));
            setSelectedLayerId(newLayerId);
            setTool('MOVE'); // Auto-switch to move to let user drag result
            setIsProcessing(false);
            setProcessStatus('');

        }, 50);
    };

    // --- OTHER HELPERS ---
    const updateLayer = (id: string, updates: Partial<DesignLayer>) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    };

    const deleteLayer = (id: string) => {
        setLayers(prev => prev.filter(l => l.id !== id));
        if (selectedLayerId === id) setSelectedLayerId(null);
    };

    const handleMagicCreate = async () => {
        if (!magicPrompt) return;
        setIsProcessing(true);
        setProcessStatus('IA: Gerando elemento...');
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

    const sendToMockup = async () => {
        setIsProcessing(true);
        setProcessStatus('Exportando Alta Resolução (2K)...');
        
        setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = 2048; canvas.height = 2048; 
            const ctx = canvas.getContext('2d')!;
            
            const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
            
            const draw = async () => {
                for (const layer of sorted) {
                    if (!layer.visible) continue;
                    await new Promise<void>((resolve) => {
                        const img = new Image(); img.src = layer.src;
                        img.onload = () => {
                            ctx.save();
                            const ratio = 2048 / 800; // Escala do workspace para output
                            const cx = 1024 + (layer.x * ratio);
                            const cy = 1024 + (layer.y * ratio);
                            ctx.translate(cx, cy);
                            ctx.rotate((layer.rotation * Math.PI) / 180);
                            ctx.scale(layer.scale * ratio, layer.scale * ratio);
                            ctx.drawImage(img, -img.width/2, -img.height/2);
                            ctx.restore();
                            resolve();
                        };
                    });
                }
                const finalImage = canvas.toDataURL('image/jpeg', 0.95);
                
                // Salva no LocalStorage para transferência instantânea
                localStorage.setItem('vingi_mockup_pattern', finalImage);
                
                // Opcional: Download automático como backup
                const link = document.createElement('a');
                link.download = `vingi-layer-export-${Date.now()}.jpg`;
                link.href = finalImage;
                link.click();

                setIsProcessing(false);
                if (onNavigateToMockup) onNavigateToMockup();
            };
            draw();
        }, 100);
    };

    // --- INTERACTION ---
    const handleMouseDown = (e: React.MouseEvent, type: 'CANVAS' | 'HANDLE_ROT' | 'HANDLE_SCALE', layerId?: string) => {
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
        } else if (type === 'HANDLE_ROT') {
            setTransformMode('ROTATE');
            setStartInteraction({ x: e.clientX, y: e.clientY, val: layer.rotation });
        } else if (type === 'HANDLE_SCALE') {
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
            const delta = (dx + dy) / 200;
            const newScale = Math.max(0.1, startInteraction.val + delta);
            updateLayer(selectedLayerId, { scale: newScale });
        } else if (transformMode === 'ROTATE') {
             const delta = dx / 2;
             updateLayer(selectedLayerId, { rotation: (startInteraction.val + delta) % 360 });
        }
    };

    const handleMouseUp = () => {
        setTransformMode('IDLE');
        setStartInteraction(null);
    };

    // --- RENDER ---
    if (incomingImage && !isProcessing) {
        return (
            <div className="flex flex-col h-full w-full bg-[#f8fafc] items-center justify-center p-6 animate-fade-in relative">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
                <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 max-w-4xl w-full text-center space-y-8 relative z-10 flex flex-col md:flex-row gap-8 items-center">
                    <div className="flex-1 w-full">
                        <div className="aspect-square rounded-2xl overflow-hidden border-4 border-gray-100 shadow-inner bg-gray-50 relative group">
                            <img src={incomingImage} className="w-full h-full object-contain" />
                        </div>
                    </div>
                    <div className="flex-1 text-left space-y-6">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold mb-4">
                                <CheckCircle2 size={12}/> Estampa Recebida
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Estúdio de Camadas</h1>
                            <p className="text-gray-500 text-sm">
                                Sua imagem foi carregada com sucesso. Clique abaixo para iniciar a edição usando nossa Varinha Mágica de separação.
                            </p>
                        </div>
                        <button 
                            onClick={() => startDecomposition(incomingImage)}
                            className="w-full p-4 bg-vingi-900 text-white rounded-xl shadow-lg hover:bg-vingi-800 transition-all flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-lg"><Wand2 size={20}/></div>
                                <div className="text-left">
                                    <div className="font-bold text-sm">Iniciar Edição Inteligente</div>
                                    <div className="text-[10px] text-gray-300">Separar elementos, clonar e recompor</div>
                                </div>
                            </div>
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (layers.length === 0 && !isProcessing) {
        return (
            <div className="flex flex-col h-full w-full bg-[#f8fafc] items-center justify-center p-6 animate-fade-in">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400">
                        <Layers size={32}/>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Layer Studio Vazio</h2>
                    <div onClick={() => fileInputRef.current?.click()} className="mt-6 cursor-pointer bg-vingi-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-vingi-500 transition-all inline-flex items-center gap-2">
                        <UploadCloud size={18}/> Carregar Arquivo
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-[#1e293b] text-white overflow-hidden" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            {/* WORKSPACE */}
            <div className={`flex-1 relative overflow-hidden flex items-center justify-center bg-[#0f172a] ${tool === 'MAGIC_WAND' ? 'cursor-crosshair' : ''}`} ref={workspaceRef}>
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}/>
                
                <div className="relative bg-white/5 shadow-2xl overflow-hidden" style={{ width: canvasSize.w, height: canvasSize.h }}>
                    {layers.sort((a,b) => a.zIndex - b.zIndex).map(layer => (
                        layer.visible && (
                            <div key={layer.id}
                                id={`layer-visual-${layer.id}`} 
                                onMouseDown={(e) => handleMouseDown(e, 'CANVAS', layer.id)}
                                className={`absolute select-none group ${selectedLayerId === layer.id ? 'z-50' : ''}`}
                                style={{
                                    transform: `translate(calc(-50% + ${layer.x}px), calc(-50% + ${layer.y}px)) rotate(${layer.rotation}deg) scale(${layer.scale})`,
                                    left: '50%', top: '50%', zIndex: layer.zIndex,
                                    cursor: tool === 'MAGIC_WAND' ? `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-dasharray="4 4"/></svg>') 12 12, crosshair` : (transformMode === 'DRAG' && selectedLayerId === layer.id ? 'grabbing' : 'grab')
                                }}
                            >
                                <img src={layer.src} className={`pointer-events-none max-w-none ${selectedLayerId === layer.id ? 'drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]' : ''}`}
                                    style={{ width: layer.type === 'BACKGROUND' ? canvasSize.w : 'auto', height: layer.type === 'BACKGROUND' ? canvasSize.h : 'auto', objectFit: 'cover' }}
                                />
                                {/* Controls Frame hidden in wand mode for cleaner selection */}
                                {selectedLayerId === layer.id && !layer.locked && tool !== 'MAGIC_WAND' && (
                                    <div className="absolute inset-0 border-2 border-vingi-500 pointer-events-none">
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-white text-vingi-900 rounded-full flex items-center justify-center cursor-alias shadow-lg pointer-events-auto"
                                            onMouseDown={(e) => handleMouseDown(e, 'HANDLE_ROT', layer.id)}><RotateCw size={12}/></div>
                                        <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-vingi-500 rounded-full flex items-center justify-center cursor-nwse-resize shadow-lg pointer-events-auto"
                                            onMouseDown={(e) => handleMouseDown(e, 'HANDLE_SCALE', layer.id)}><Move size={12} className="text-white"/></div>
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
                <div className="p-4 border-b border-gray-700 bg-[#0f172a] flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold flex items-center gap-2"><Layers size={18} className="text-vingi-500"/> Camadas</h2>
                        <div className="flex gap-1">
                            <button onClick={() => setLayers([])} className="p-1.5 hover:bg-gray-800 rounded text-red-400"><Trash2 size={14}/></button>
                        </div>
                    </div>
                    
                    {/* TOOLBAR */}
                    <div className="flex gap-2 p-1 bg-gray-800 rounded-lg">
                        <button onClick={() => setTool('MOVE')} className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-1 ${tool === 'MOVE' ? 'bg-vingi-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                            <Move size={14}/> Mover
                        </button>
                        <button onClick={() => setTool('MAGIC_WAND')} className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-1 ${tool === 'MAGIC_WAND' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                            <Wand2 size={14}/> Varinha
                        </button>
                    </div>

                    {/* WAND SETTINGS */}
                    {tool === 'MAGIC_WAND' && (
                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 space-y-3 animate-fade-in">
                            <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase">
                                <span>Modo de Seleção</span>
                                <Info size={10}/>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setWandMode('CONTIGUOUS')} className={`flex-1 py-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 border ${wandMode === 'CONTIGUOUS' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'border-gray-600 text-gray-500'}`}>
                                    <Scan size={12}/> Objeto
                                </button>
                                <button onClick={() => setWandMode('GLOBAL')} className={`flex-1 py-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 border ${wandMode === 'GLOBAL' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'border-gray-600 text-gray-500'}`}>
                                    <Copy size={12}/> Global
                                </button>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>Tolerância</span>
                                    <span>{wandTolerance}</span>
                                </div>
                                <input type="range" min="5" max="100" value={wandTolerance} onChange={(e) => setWandTolerance(parseInt(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"/>
                            </div>
                        </div>
                    )}

                    <button onClick={sendToMockup} className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all">
                        <Shirt size={16}/> PROVAR NO CORPO
                    </button>
                </div>

                {/* GENERATE */}
                <div className="p-4 bg-gray-800/50 border-b border-gray-700">
                    <div className="flex gap-2">
                        <input type="text" value={magicPrompt} onChange={(e) => setMagicPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleMagicCreate()} placeholder="Gerar elemento (Ex: Rosa)" className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-vingi-500 outline-none text-white" />
                        <button onClick={handleMagicCreate} disabled={!magicPrompt || isProcessing} className="bg-gradient-to-br from-vingi-600 to-purple-600 p-2 rounded-lg hover:brightness-110 disabled:opacity-50"><Sparkles size={18} className="text-white"/></button>
                    </div>
                </div>

                {/* LIST */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {layers.slice().reverse().map(layer => (
                        <div key={layer.id} onClick={() => setSelectedLayerId(layer.id)} className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer border transition-all ${selectedLayerId === layer.id ? 'bg-vingi-900/50 border-vingi-500/50' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
                            <div className="w-10 h-10 bg-gray-900 rounded overflow-hidden shrink-0 border border-gray-600 relative">
                                <img src={layer.src} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/checkerboard-crosshairs.png')] opacity-30"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-gray-200 truncate">{layer.name}</h4>
                                <span className="text-[9px] text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded uppercase">{layer.type === 'BACKGROUND' ? 'Fundo' : 'Objeto'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }) }} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-600">{layer.visible ? <Eye size={12}/> : <EyeOff size={12}/>}</button>
                                {!layer.locked && <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id) }} className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-gray-600"><Trash2 size={12}/></button>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
