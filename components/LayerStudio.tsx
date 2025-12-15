
import React, { useState, useRef, useEffect } from 'react';
import { Layers, Move, Plus, Trash2, Eye, EyeOff, Lock, Unlock, Wand2, Download, Eraser, Undo, Redo, Image as ImageIcon, Sparkles, Loader2, GripVertical, CheckCircle2, RotateCw, ZoomIn, Info, UploadCloud, ArrowRight } from 'lucide-react';
import { DesignLayer, PantoneColor } from '../types';

// Função auxiliar para remover fundo branco (Client-side Alpha Matting simples)
// Mantida aqui para garantir isolamento do módulo
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
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                // Se for próximo de branco
                if (r > 255 - tolerance && g > 255 - tolerance && b > 255 - tolerance) {
                    data[i + 3] = 0; // Alpha 0
                }
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL());
        };
    });
};

interface LayerStudioProps {
    onNavigateBack?: () => void;
}

export const LayerStudio: React.FC<LayerStudioProps> = ({ onNavigateBack }) => {
    // --- STATE ---
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 800, h: 800 });
    
    // Magic Edit State
    const [magicPrompt, setMagicPrompt] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState('');

    // Refs
    const workspaceRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);

    // --- CORE LOGIC: DECOMPOSITION ENGINE ---
    const startDecomposition = async (sourceImage: string) => {
        setIsProcessing(true);
        setProcessStatus('Analisando estrutura da imagem...');

        try {
            // 1. Criar Camada Original (Referência) temporária
            const baseLayer: DesignLayer = {
                id: 'base-ref',
                type: 'BACKGROUND',
                name: 'Imagem Original',
                src: sourceImage,
                x: 0, y: 0, scale: 1, rotation: 0,
                visible: true, locked: true, zIndex: 0
            };
            setLayers([baseLayer]);

            // 2. Disparar Decomposição Inteligente via API
            setProcessStatus('Separando Fundo e Elementos (IA)...');
            
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'DECOMPOSE_PATTERN',
                    mainImageBase64: sourceImage.split(',')[1],
                    mainMimeType: 'image/jpeg'
                })
            });

            const data = await response.json();
            if (data.success) {
                const newLayers: DesignLayer[] = [];

                // Camada 1: Fundo Limpo (Regenerado)
                if (data.backgroundLayer) {
                    newLayers.push({
                        id: 'bg-' + Date.now(),
                        type: 'BACKGROUND',
                        name: 'Fundo (Regenerado)',
                        src: data.backgroundLayer,
                        x: 0, y: 0, scale: 1, rotation: 0,
                        visible: true, locked: true, zIndex: 0
                    });
                }

                // Camada 2+: Elementos Isolados
                if (data.elements && data.elements.length > 0) {
                    // Processar transparência
                    for (let i = 0; i < data.elements.length; i++) {
                        const elem = data.elements[i];
                        // Remove fundo branco do elemento gerado pela IA
                        const transparentSrc = await removeWhiteBackground(elem.src);
                        
                        newLayers.push({
                            id: `el-${Date.now()}-${i}`,
                            type: 'ELEMENT',
                            name: elem.name || `Elemento ${i+1}`,
                            src: transparentSrc,
                            x: 0, 
                            y: 0,
                            scale: 0.8, 
                            rotation: 0,
                            visible: true, locked: false, zIndex: i + 1
                        });
                    }
                } else {
                    // Fallback se a IA não retornou elementos separados
                    newLayers.push(baseLayer);
                }

                // Substitui a camada base pelas novas
                setLayers(newLayers);
                if (newLayers.length > 1) setSelectedLayerId(newLayers[1].id); // Seleciona o primeiro elemento
            } else {
                 throw new Error("Falha na resposta da IA");
            }

        } catch (e) {
            console.error("Decomposition failed", e);
            setProcessStatus("Erro ao decompor. Usando modo manual.");
            // Mantém a imagem original se falhar
        } finally {
            setIsProcessing(false);
        }
    };

    // --- INITIALIZATION (AUTO-DECOMPOSE FROM ATELIER) ---
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
        setProcessStatus('Gerando novo elemento exclusivo...');

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'GENERATE_ELEMENT',
                    prompt: magicPrompt,
                })
            });
            const data = await response.json();
            
            if (data.success && data.element) {
                const transparentSrc = await removeWhiteBackground(data.element);
                const newLayer: DesignLayer = {
                    id: `gen-${Date.now()}`,
                    type: 'ELEMENT',
                    name: magicPrompt.slice(0, 15),
                    src: transparentSrc,
                    x: 0, y: 0, scale: 0.5, rotation: 0,
                    visible: true, locked: false, zIndex: layers.length + 1
                };
                setLayers(prev => [...prev, newLayer]);
                setSelectedLayerId(newLayer.id);
                setMagicPrompt('');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    const updateLayer = (id: string, updates: Partial<DesignLayer>) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    };

    const deleteLayer = (id: string) => {
        setLayers(prev => prev.filter(l => l.id !== id));
        if (selectedLayerId === id) setSelectedLayerId(null);
    };

    const downloadComposition = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d')!;
        
        const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
        
        const draw = async () => {
            for (const layer of sorted) {
                if (!layer.visible) continue;
                await new Promise<void>((resolve) => {
                    const img = new Image();
                    img.src = layer.src;
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
            const link = document.createElement('a');
            link.download = 'vingi-studio-composition.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        draw();
    };

    // --- INTERACTION ---

    const handleMouseDown = (e: React.MouseEvent, layerId: string) => {
        if (layers.find(l => l.id === layerId)?.locked) return;
        e.stopPropagation();
        setSelectedLayerId(layerId);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragStart || !selectedLayerId) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        updateLayer(selectedLayerId, {
            x: layers.find(l => l.id === selectedLayerId)!.x + dx,
            y: layers.find(l => l.id === selectedLayerId)!.y + dy
        });
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => setDragStart(null);

    // --- RENDER: EMPTY STATE VS WORKSPACE ---

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

                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-3 border-dashed border-gray-300 rounded-2xl p-12 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                    >
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                        <UploadCloud size={48} className="mx-auto text-gray-400 group-hover:text-indigo-500 mb-4 transition-colors" />
                        <h3 className="text-xl font-bold text-gray-700 group-hover:text-indigo-600">Carregar Estampa ou Imagem</h3>
                        <p className="text-sm text-gray-400 mt-2">JPG ou PNG • Alta Resolução Recomendada</p>
                    </div>

                    {onNavigateBack && (
                         <button onClick={onNavigateBack} className="text-gray-400 hover:text-gray-600 text-sm font-bold flex items-center justify-center gap-1">
                             Voltar para o Atelier
                         </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-[#1e293b] text-white overflow-hidden" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            
            {/* LEFT: WORKSPACE */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#0f172a]" ref={workspaceRef}>
                {/* Background Grid */}
                <div className="absolute inset-0 opacity-20" 
                     style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}
                />

                {/* Canvas Area */}
                <div 
                    className="relative bg-white/5 shadow-2xl overflow-hidden"
                    style={{ width: canvasSize.w, height: canvasSize.h }}
                >
                    {layers.sort((a,b) => a.zIndex - b.zIndex).map(layer => (
                        layer.visible && (
                            <div
                                key={layer.id}
                                onMouseDown={(e) => handleMouseDown(e, layer.id)}
                                className={`absolute select-none cursor-move group ${selectedLayerId === layer.id ? 'z-50' : ''}`}
                                style={{
                                    transform: `translate(calc(-50% + ${layer.x}px), calc(-50% + ${layer.y}px)) rotate(${layer.rotation}deg) scale(${layer.scale})`,
                                    left: '50%', top: '50%',
                                    zIndex: layer.zIndex
                                }}
                            >
                                <img 
                                    src={layer.src} 
                                    className={`pointer-events-none max-w-none ${selectedLayerId === layer.id ? 'drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]' : ''}`}
                                    style={{ width: layer.type === 'BACKGROUND' ? canvasSize.w : 'auto', height: layer.type === 'BACKGROUND' ? canvasSize.h : 'auto', objectFit: 'cover' }}
                                />
                                
                                {/* Bounding Box (Only if Selected & Not Background) */}
                                {selectedLayerId === layer.id && !layer.locked && (
                                    <div className="absolute inset-0 border-2 border-vingi-500 rounded-lg pointer-events-none">
                                        <div className="absolute -top-3 -right-3 w-6 h-6 bg-vingi-500 rounded-full flex items-center justify-center cursor-alias shadow-lg">
                                            <RotateCw size={12} className="text-white"/>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    ))}

                    {/* Loading Overlay */}
                    {isProcessing && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-[100] animate-fade-in">
                            <Loader2 size={48} className="text-vingi-500 animate-spin mb-4"/>
                            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-vingi-400 to-purple-400 animate-pulse">{processStatus}</h3>
                            <p className="text-gray-400 text-sm mt-2 max-w-md text-center">A IA está reconstruindo os pixels ocultos para permitir a separação...</p>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: STUDIO PANEL */}
            <div className="w-80 bg-[#1e293b] border-l border-gray-700 flex flex-col shadow-2xl z-20">
                <div className="p-4 border-b border-gray-700 bg-[#0f172a] flex justify-between items-center">
                    <h2 className="font-bold flex items-center gap-2"><Layers size={18} className="text-vingi-500"/> Layer Studio</h2>
                    <div className="flex gap-2">
                        <button onClick={() => setLayers([])} className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded flex items-center gap-1 transition-colors">
                            <Trash2 size={12}/>
                        </button>
                        <button onClick={downloadComposition} className="text-xs bg-vingi-600 hover:bg-vingi-500 px-3 py-1.5 rounded flex items-center gap-1 transition-colors">
                            <Download size={12}/> Exportar
                        </button>
                    </div>
                </div>

                {/* MAGIC EDIT SECTION */}
                <div className="p-4 bg-gray-800/50 border-b border-gray-700">
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-vingi-400 uppercase tracking-widest">
                        <Sparkles size={12}/> Magic Element
                    </div>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={magicPrompt}
                            onChange={(e) => setMagicPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleMagicCreate()}
                            placeholder="Ex: Rosa vermelha aquarela..." 
                            className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-vingi-500 outline-none text-white"
                        />
                        <button 
                            onClick={handleMagicCreate}
                            disabled={!magicPrompt || isProcessing}
                            className="bg-gradient-to-br from-vingi-600 to-purple-600 p-2 rounded-lg hover:brightness-110 disabled:opacity-50"
                        >
                            <Wand2 size={18} className="text-white"/>
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2 leading-tight">
                        A IA irá gerar um novo elemento com fundo transparente que se encaixa na harmonia da estampa.
                    </p>
                </div>

                {/* CONTROLS (SELECTED LAYER) */}
                {selectedLayerId && (
                    <div className="p-4 border-b border-gray-700 bg-gray-800/30">
                        <div className="grid grid-cols-2 gap-3 mb-2">
                            <div>
                                <label className="text-[9px] text-gray-400 uppercase font-bold">Escala</label>
                                <input 
                                    type="range" min="0.1" max="3" step="0.1"
                                    value={layers.find(l => l.id === selectedLayerId)?.scale || 1}
                                    onChange={(e) => updateLayer(selectedLayerId, { scale: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none accent-vingi-500"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] text-gray-400 uppercase font-bold">Rotação</label>
                                <input 
                                    type="range" min="0" max="360" step="1"
                                    value={layers.find(l => l.id === selectedLayerId)?.rotation || 0}
                                    onChange={(e) => updateLayer(selectedLayerId, { rotation: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none accent-vingi-500"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* LAYER LIST */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {layers.slice().reverse().map(layer => (
                        <div 
                            key={layer.id}
                            onClick={() => setSelectedLayerId(layer.id)}
                            className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer border transition-all ${selectedLayerId === layer.id ? 'bg-vingi-900/50 border-vingi-500/50' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}
                        >
                            <div className="w-10 h-10 bg-gray-900 rounded overflow-hidden shrink-0 border border-gray-600">
                                <img src={layer.src} className="w-full h-full object-cover" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-gray-200 truncate">{layer.name}</h4>
                                <span className="text-[9px] text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded uppercase">{layer.type === 'BACKGROUND' ? 'Fundo' : 'Objeto'}</span>
                            </div>

                            <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }) }} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-600">
                                    {layer.visible ? <Eye size={12}/> : <EyeOff size={12}/>}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }) }} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-600">
                                    {layer.locked ? <Lock size={12}/> : <Unlock size={12}/>}
                                </button>
                                {!layer.locked && (
                                    <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id) }} className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-gray-600">
                                        <Trash2 size={12}/>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {layers.length === 0 && (
                        <div className="text-center p-8 text-gray-500">
                            <Layers size={32} className="mx-auto mb-2 opacity-20"/>
                            <p className="text-xs">Nenhuma camada ativa</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
