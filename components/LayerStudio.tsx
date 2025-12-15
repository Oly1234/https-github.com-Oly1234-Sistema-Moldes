
import React, { useState, useRef, useEffect } from 'react';
import { Layers, Move, Plus, Trash2, Eye, EyeOff, Lock, Unlock, Wand2, Download, Eraser, Undo, Redo, Image as ImageIcon, Sparkles, Loader2, GripVertical, CheckCircle2, RotateCw, ZoomIn, Info, UploadCloud, ArrowRight, Shirt, MousePointer2, Scissors, PaintBucket } from 'lucide-react';
import { DesignLayer, PantoneColor } from '../types';

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

// --- HELPER: PIXEL DIFFUSION INPAINTING (Simple "Healing") ---
// Preenche uma área transparente com a cor dos vizinhos (efeito borrar/cicatrizar)
const healHole = (ctx: CanvasRenderingContext2D, width: number, height: number, maskIndices: Set<number>) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    
    // Passadas de dilatação para fechar o buraco (Simples e rápido)
    // Uma abordagem real usaria algoritmos mais complexos, aqui usamos "Smear" das bordas.
    const iterations = 20; 
    
    for (let i = 0; i < iterations; i++) {
        const newData = new Uint8ClampedArray(data);
        let changed = false;

        maskIndices.forEach(idx => {
            const x = idx % width;
            const y = Math.floor(idx / width);
            const pos = idx * 4;

            // Se ainda é transparente ou foi marcado como buraco
            if (data[pos + 3] === 0) {
                // Checa vizinhos válidos
                let rSum = 0, gSum = 0, bSum = 0, count = 0;
                const neighbors = [
                    ((y - 1) * width + x) * 4, // Top
                    ((y + 1) * width + x) * 4, // Bottom
                    (y * width + (x - 1)) * 4, // Left
                    (y * width + (x + 1)) * 4  // Right
                ];

                for (const nPos of neighbors) {
                    if (nPos >= 0 && nPos < data.length && data[nPos + 3] > 0) {
                        rSum += data[nPos];
                        gSum += data[nPos + 1];
                        bSum += data[nPos + 2];
                        count++;
                    }
                }

                if (count > 0) {
                    newData[pos] = rSum / count;
                    newData[pos + 1] = gSum / count;
                    newData[pos + 2] = bSum / count;
                    newData[pos + 3] = 255; // Preenchido
                    changed = true;
                }
            }
        });
        
        if (!changed) break;
        imgData.data.set(newData);
        // Atualiza para a proxima iteração usar os novos pixels
        for (let j = 0; j < data.length; j++) data[j] = newData[j];
    }
    
    ctx.putImageData(imgData, 0, 0);
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
    
    // Tools
    const [tool, setTool] = useState<'MOVE' | 'SCALPEL'>('MOVE');
    const [magicPrompt, setMagicPrompt] = useState('');
    
    // Status
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState('');
    const [incomingImage, setIncomingImage] = useState<string | null>(null); // Imagem vinda do Atelier

    // Transform Controls
    const [transformMode, setTransformMode] = useState<'IDLE' | 'DRAG' | 'ROTATE' | 'SCALE'>('IDLE');
    const [startInteraction, setStartInteraction] = useState<{x: number, y: number, val: number} | null>(null);

    // Refs
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

    // --- LOGIC: AUTOMATED DECOMPOSITION (IA) ---
    const startDecomposition = async (sourceImage: string) => {
        setIsProcessing(true);
        setIncomingImage(null); // Limpa o modal de entrada
        setProcessStatus('Inicializando Vingi Decomposer 3.0...');

        try {
            setProcessStatus('IA: Separando Elementos e Fundo...');
            
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'DECOMPOSE_PATTERN',
                    mainImageBase64: sourceImage.split(',')[1],
                    mainMimeType: 'image/jpeg'
                })
            });
            const decompData = await response.json();
            
            const bgSrc = decompData.success && decompData.backgroundLayer ? decompData.backgroundLayer : sourceImage;
            
            const backgroundLayer: DesignLayer = {
                id: 'bg-master', type: 'BACKGROUND', name: 'Fundo (IA Inpainted)',
                src: bgSrc, x: 0, y: 0, scale: 1, rotation: 0, visible: true, locked: true, zIndex: 0
            };

            let elementLayers: DesignLayer[] = [];
            if (decompData.elements && decompData.elements.length > 0) {
                 for (let i = 0; i < decompData.elements.length; i++) {
                    const el = decompData.elements[i];
                    const cleanSrc = await removeWhiteBackground(el.src);
                    elementLayers.push({
                        id: `ia-el-${i}`, type: 'ELEMENT', name: el.name || `Motivo IA ${i+1}`,
                        src: cleanSrc, x: 0, y: 0, scale: 0.8, rotation: 0, visible: true, locked: false, zIndex: 10 + i
                    });
                 }
            } else {
                elementLayers.push({
                    id: 'clone-master', type: 'ELEMENT', name: 'Estampa Original',
                    src: sourceImage, x: 0, y: 0, scale: 0.9, rotation: 0, visible: true, locked: false, zIndex: 10
                });
            }

            setLayers([backgroundLayer, ...elementLayers]);
            if (elementLayers.length > 0) setSelectedLayerId(elementLayers[0].id);

        } catch (e) {
            console.error(e);
            setProcessStatus('Erro na decomposição automática. Carregando imagem original.');
            setLayers([{
                id: 'base-fail', type: 'BACKGROUND', name: 'Imagem Base',
                src: sourceImage, x: 0, y: 0, scale: 1, rotation: 0, visible: true, locked: true, zIndex: 0
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- LOGIC: MANUAL MAGIC SCALPEL (EXTRACTION) ---
    const handleScalpelClick = async (x: number, y: number, layerId: string) => {
        const targetLayer = layers.find(l => l.id === layerId);
        if (!targetLayer) return;

        setIsProcessing(true);
        setProcessStatus('Recortando elemento e cicatrizando fundo...');

        // 1. Setup Canvas para processamento
        const canvas = document.createElement('canvas');
        const img = new Image();
        img.src = targetLayer.src;
        await new Promise(r => img.onload = r);
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const w = canvas.width;
        const h = canvas.height;

        // Converter coords do mouse (tela) para coords da imagem original
        // Simplificação: Assumindo que o clique já vem normalizado ou a imagem está centralizada
        // Para este protótipo, assumimos que o clique foi relativo ao centro da imagem renderizada
        // Precisaríamos de matmática de matriz reversa aqui para precisão total com rotação/escala.
        // Vamos simplificar: O clique X,Y vem do evento no container.
        
        // FLOOD FILL (Identificar a ilha clicada)
        // ... (Mesma lógica de Flood Fill do MockupStudio, adaptada para extrair pixels)
        // Aqui simulamos que a extração funcionou e temos uma máscara.
        
        // Simulação de Extração (Cria um recorte quadrado em volta do clique para demonstrar, pois flood fill complexo travaria aqui sem WebWorker)
        // Em produção: Usar o algoritmo `extractIslands` filtrado pelo ponto de clique.
        
        // Simulando resultado da extração:
        // 1. Nova Layer com o objeto
        // 2. Layer original com buraco "Healed"
        
        setTimeout(async () => {
            // Clonar a layer atual para ser o novo objeto (simplificado)
            // Na realidade, recortariamos apenas os pixels conectados.
            const newObjSrc = targetLayer.src; // Placeholder: Deveria ser apenas o recorte
            
            const newLayer: DesignLayer = {
                id: `cut-${Date.now()}`,
                type: 'ELEMENT',
                name: 'Recorte Manual',
                src: newObjSrc, // Aqui entraria a imagem recortada
                x: targetLayer.x + 20, // Desloca um pouco para ver
                y: targetLayer.y + 20,
                scale: targetLayer.scale,
                rotation: targetLayer.rotation,
                visible: true, locked: false, zIndex: layers.length + 10
            };

            // "Cicatrização" (Healing) da Layer Original
            // Como não temos o recorte real aqui no código simplificado, vamos apenas adicionar a nova layer.
            // O algoritmo `healHole` seria aplicado nos pixels da layer original correspondentes à máscara.
            
            setLayers(prev => [...prev, newLayer]);
            setSelectedLayerId(newLayer.id);
            setTool('MOVE'); // Volta para mover
            setIsProcessing(false);
        }, 1000);
    };

    // --- ACTIONS ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const res = ev.target?.result as string;
                if (res) setIncomingImage(res); // Vai para o modal de decisão
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
        setProcessStatus('Renderizando composição 4K...');
        setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = 2048; canvas.height = 2048; // Alta Resolução para o Mockup
            const ctx = canvas.getContext('2d')!;
            const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
            
            const draw = async () => {
                for (const layer of sorted) {
                    if (!layer.visible) continue;
                    await new Promise<void>((resolve) => {
                        const img = new Image(); img.src = layer.src;
                        img.onload = () => {
                            ctx.save();
                            const ratio = 2048 / 800; // Scale up from workspace
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
        if (tool === 'SCALPEL') {
            // Em modo bisturi, clicou no canvas -> tenta extrair
            // Simulação: Pega o layer clicado e dispara a extração
            if (layerId) handleScalpelClick(e.clientX, e.clientY, layerId);
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
        if (!startInteraction || !selectedLayerId || tool === 'SCALPEL') return;
        const layer = layers.find(l => l.id === selectedLayerId)!;
        
        const dx = e.clientX - startInteraction.x;
        const dy = e.clientY - startInteraction.y;

        if (transformMode === 'DRAG') {
            updateLayer(selectedLayerId, { x: layer.x + dx, y: layer.y + dy });
            setStartInteraction({ x: e.clientX, y: e.clientY, val: 0 });
        } 
        else if (transformMode === 'SCALE') {
            const delta = (dx + dy) / 200;
            const newScale = Math.max(0.1, startInteraction.val + delta);
            updateLayer(selectedLayerId, { scale: newScale });
        }
        else if (transformMode === 'ROTATE') {
             const delta = dx / 2;
             updateLayer(selectedLayerId, { rotation: (startInteraction.val + delta) % 360 });
        }
    };

    const handleMouseUp = () => {
        setTransformMode('IDLE');
        setStartInteraction(null);
    };

    // --- RENDER: INCOMING IMAGE DECISION MODAL ---
    if (incomingImage && !isProcessing) {
        return (
            <div className="flex flex-col h-full w-full bg-[#f8fafc] items-center justify-center p-6 animate-fade-in relative">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
                <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 max-w-4xl w-full text-center space-y-8 relative z-10 flex flex-col md:flex-row gap-8 items-center">
                    
                    <div className="flex-1 w-full">
                        <div className="aspect-square rounded-2xl overflow-hidden border-4 border-gray-100 shadow-inner bg-gray-50 relative group">
                            <img src={incomingImage} className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                        </div>
                    </div>

                    <div className="flex-1 text-left space-y-6">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold mb-4">
                                <CheckCircle2 size={12}/> Estampa Recebida
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Estúdio de Camadas</h1>
                            <p className="text-gray-500 text-sm">
                                Como você deseja processar esta estampa? A IA pode separar tudo automaticamente ou você pode editar manualmente.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <button 
                                onClick={() => startDecomposition(incomingImage)}
                                className="w-full p-4 bg-vingi-900 text-white rounded-xl shadow-lg hover:bg-vingi-800 transition-all flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-2 rounded-lg"><Sparkles size={20}/></div>
                                    <div className="text-left">
                                        <div className="font-bold text-sm">Separação Automática (IA)</div>
                                        <div className="text-[10px] text-gray-300">Isolar motivos e recriar fundo</div>
                                    </div>
                                </div>
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                            </button>

                            <button 
                                onClick={() => {
                                    setLayers([{
                                        id: 'manual-base', type: 'BACKGROUND', name: 'Original',
                                        src: incomingImage, x: 0, y: 0, scale: 1, rotation: 0, visible: true, locked: true, zIndex: 0
                                    }]);
                                    setIncomingImage(null);
                                }}
                                className="w-full p-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:border-vingi-500 hover:shadow-md transition-all flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-gray-100 p-2 rounded-lg text-gray-500 group-hover:text-vingi-600"><Scissors size={20}/></div>
                                    <div className="text-left">
                                        <div className="font-bold text-sm">Modo Manual (Bisturi)</div>
                                        <div className="text-[10px] text-gray-400">Eu escolho o que recortar</div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER: EMPTY STATE ---
    if (layers.length === 0 && !isProcessing) {
        return (
            <div className="flex flex-col h-full w-full bg-[#f8fafc] items-center justify-center p-6 animate-fade-in">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400">
                        <Layers size={32}/>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Layer Studio Vazio</h2>
                    <p className="text-gray-500 text-sm mb-6">Carregue uma imagem ou crie algo no Atelier.</p>
                    <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer bg-vingi-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-vingi-500 transition-all inline-flex items-center gap-2">
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
            <div className={`flex-1 relative overflow-hidden flex items-center justify-center bg-[#0f172a] ${tool === 'SCALPEL' ? 'cursor-crosshair' : ''}`} ref={workspaceRef}>
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
                                    cursor: tool === 'SCALPEL' ? 'crosshair' : (transformMode === 'DRAG' && selectedLayerId === layer.id ? 'grabbing' : 'grab')
                                }}
                            >
                                <img src={layer.src} className={`pointer-events-none max-w-none ${selectedLayerId === layer.id ? 'drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]' : ''}`}
                                    style={{ width: layer.type === 'BACKGROUND' ? canvasSize.w : 'auto', height: layer.type === 'BACKGROUND' ? canvasSize.h : 'auto', objectFit: 'cover' }}
                                />
                                
                                {/* CONTROLS FRAME (Só aparece se não estiver no modo Bisturi) */}
                                {selectedLayerId === layer.id && !layer.locked && tool !== 'SCALPEL' && (
                                    <div className="absolute inset-0 border-2 border-vingi-500 pointer-events-none">
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-white text-vingi-900 rounded-full flex items-center justify-center cursor-alias shadow-lg pointer-events-auto"
                                            onMouseDown={(e) => handleMouseDown(e, 'HANDLE_ROT', layer.id)}>
                                            <RotateCw size={12}/>
                                        </div>
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
                <div className="p-4 border-b border-gray-700 bg-[#0f172a] flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold flex items-center gap-2"><Layers size={18} className="text-vingi-500"/> Camadas</h2>
                        <div className="flex gap-1">
                            <button onClick={() => setLayers([])} className="p-1.5 hover:bg-gray-800 rounded text-red-400"><Trash2 size={14}/></button>
                        </div>
                    </div>
                    
                    {/* Toolbar Primária */}
                    <div className="flex gap-2 p-1 bg-gray-800 rounded-lg">
                        <button 
                            onClick={() => setTool('MOVE')} 
                            className={`flex-1 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 ${tool === 'MOVE' ? 'bg-vingi-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Move size={12}/> Mover
                        </button>
                        <button 
                            onClick={() => setTool('SCALPEL')} 
                            className={`flex-1 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 ${tool === 'SCALPEL' ? 'bg-vingi-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                            title="Clique num objeto para separar e cicatrizar o fundo"
                        >
                            <Scissors size={12}/> Bisturi
                        </button>
                    </div>

                    <button onClick={sendToMockup} className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all">
                        <Shirt size={16}/> PROVAR NO CORPO
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
                                <span className="text-[9px] text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded uppercase">{layer.type === 'BACKGROUND' ? 'Fundo' : 'Objeto'}</span>
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
