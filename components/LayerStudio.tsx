
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Layers, Move, Trash2, Eye, EyeOff, Lock, Hand, Wand2, Brush, 
    X, Check, Loader2, LayoutGrid, Palette, Scissors, Sliders, 
    Download, Settings2, Eraser, Undo2, Redo2, MousePointer2, ChevronUp, 
    Combine, Target, Sparkles, Box, Pipette, Zap, MoreVertical, 
    Maximize, Minimize, ZoomIn, ZoomOut, RotateCcw, MousePointerClick, 
    Plus, Minus, Square, BoxSelect, Contrast
} from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleLandingPage } from './Shared';
import { LayerEnginePro, MaskSnapshot } from '../services/layerEnginePro';

export const LayerStudio: React.FC<{ onNavigateBack?: () => void, onNavigateToMockup?: () => void }> = ({ onNavigateBack, onNavigateToMockup }) => {
    // Core State
    const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    
    // Tools State
    const [tool, setTool] = useState<'WAND' | 'BRUSH' | 'ERASER' | 'HAND' | 'RECT' | 'PICKER'>('WAND');
    const [toolMode, setToolMode] = useState<'ADD' | 'SUB'>('ADD');
    
    // History State
    const [undoStack, setUndoStack] = useState<MaskSnapshot[]>([]);
    const [redoStack, setRedoStack] = useState<MaskSnapshot[]>([]);
    
    // Masking State
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [tolerance, setTolerance] = useState(45);
    const [contiguous, setContiguous] = useState(true);
    const [feather, setFeather] = useState(0);
    const [brushSize, setBrushSize] = useState(30);

    // Viewport State
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
    const [isMobile] = useState(window.innerWidth < 768);
    const [showSheet, setShowSheet] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const lastPinchDist = useRef<number>(0);
    const isPanning = useRef(false);

    // --- INITIALIZATION ---
    const initStudio = (src: string) => {
        setIsProcessing(true);
        const img = new Image(); img.src = src;
        img.onload = () => {
            setOriginalImg(img);
            const initialLayer: DesignLayer = {
                id: 'BG', type: 'BACKGROUND', name: 'Base Original', src,
                x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false,
                visible: true, locked: false, zIndex: 0, opacity: 1
            };
            setLayers([initialLayer]);
            setSelectedLayerId('BG');
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setView({ x: 0, y: 0, k: Math.min(rect.width/img.width, rect.height/img.height) * 0.8 });
            }
            setIsProcessing(false);
        };
    };

    // --- UNDO / REDO ---
    const handleUndo = useCallback(() => {
        if (undoStack.length === 0 || !activeMask) return;
        const prev = undoStack[undoStack.length - 1];
        setRedoStack(prevStack => [{ data: new Uint8Array(activeMask), timestamp: Date.now() }, ...prevStack]);
        setActiveMask(new Uint8Array(prev.data));
        setUndoStack(prevStack => prevStack.slice(0, -1));
    }, [undoStack, activeMask]);

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0 || !activeMask) return;
        const next = redoStack[0];
        setUndoStack(prevStack => [...prevStack, { data: new Uint8Array(activeMask), timestamp: Date.now() }]);
        setActiveMask(new Uint8Array(next.data));
        setRedoStack(prevStack => prevStack.slice(1));
    }, [redoStack, activeMask]);

    // Teclas de Atalho
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? handleRedo() : handleUndo(); }
            if (e.key === ' ') isPanning.current = true;
            if (e.key === '0') setView(v => ({...v, x: 0, y: 0, k: 0.8}));
        };
        const handleKeyUp = (e: KeyboardEvent) => { if (e.key === ' ') isPanning.current = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, [handleUndo, handleRedo]);

    // --- INTERACTION ---
    const handlePointerDown = (e: React.PointerEvent) => {
        if (!containerRef.current || !originalImg || isPanning.current || tool === 'HAND') return;
        
        const rect = containerRef.current.getBoundingClientRect();
        const px = (e.clientX - rect.left - rect.width/2 - view.x) / view.k + originalImg.width/2;
        const py = (e.clientY - rect.top - rect.height/2 - view.y) / view.k + originalImg.height/2;

        if (tool === 'WAND') {
            const canvas = document.createElement('canvas'); canvas.width = originalImg.width; canvas.height = originalImg.height;
            const ctx = canvas.getContext('2d')!; ctx.drawImage(originalImg, 0, 0);
            
            if (activeMask) setUndoStack(s => LayerEnginePro.pushHistory(s, activeMask));
            
            const newMask = LayerEnginePro.magicWand(ctx, originalImg.width, originalImg.height, px, py, {
                tolerance, contiguous, mode: toolMode, existingMask: activeMask || undefined
            });
            setActiveMask(newMask);
            setRedoStack([]);
            if (isMobile) setShowSheet(true);
        }
    };

    // Gestos Mobile (Zoom/Pan)
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dist = Math.sqrt(Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) + Math.pow(e.touches[0].clientY - e.touches[1].clientY, 2));
            if (lastPinchDist.current > 0) {
                const scale = dist / lastPinchDist.current;
                setView(v => ({ ...v, k: Math.min(Math.max(v.k * scale, 0.1), 10) }));
            }
            lastPinchDist.current = dist;
        }
    };

    // Render Overlay
    useEffect(() => {
        if (!overlayRef.current || !originalImg || !activeMask) return;
        const ctx = overlayRef.current.getContext('2d')!;
        ctx.clearRect(0, 0, originalImg.width, originalImg.height);
        
        const featheredMask = feather > 0 ? LayerEnginePro.applyFeather(activeMask, originalImg.width, originalImg.height, feather) : activeMask;
        const imgData = ctx.createImageData(originalImg.width, originalImg.height);
        
        for (let i = 0; i < featheredMask.length; i++) {
            const pos = i * 4;
            if (featheredMask[i] > 0) {
                imgData.data[pos] = 0; imgData.data[pos+1] = 255; imgData.data[pos+2] = 0; 
                imgData.data[pos+3] = (featheredMask[i] / 255) * 160; 
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }, [activeMask, originalImg, feather]);

    const confirmExtraction = () => {
        if (!activeMask || !originalImg) return;
        setIsProcessing(true);
        const finalMask = feather > 0 ? LayerEnginePro.applyFeather(activeMask, originalImg.width, originalImg.height, feather) : activeMask;
        const layerSrc = LayerEnginePro.extractLayer(originalImg, finalMask, originalImg.width, originalImg.height);
        
        const newLayer: DesignLayer = {
            id: 'L' + Date.now(), type: 'ELEMENT', name: `Recorte ${layers.length}`, src: layerSrc,
            x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: false, zIndex: layers.length, opacity: 1
        };
        setLayers([...layers, newLayer]);
        setSelectedLayerId(newLayer.id);
        setActiveMask(null); setUndoStack([]); setRedoStack([]);
        setIsProcessing(false);
        setShowSheet(false);
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden relative font-sans select-none touch-none">
            {/* CABEÇALHO */}
            <div className="h-14 bg-[#111] border-b border-white/5 px-4 flex items-center justify-between shrink-0 z-[100] shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="bg-vingi-900/40 p-2 rounded-xl border border-vingi-500/20 text-vingi-400"><Layers size={18}/></div>
                    <div>
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-vingi-400">Lab de Imagem</h2>
                        <p className="text-[9px] text-gray-500 uppercase font-bold tracking-tight">Separador de Camadas Pro</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="hidden md:flex bg-black/40 rounded-lg p-0.5 border border-white/5 mr-2">
                        <button onClick={handleUndo} disabled={undoStack.length===0} className="p-1.5 hover:bg-white/5 disabled:opacity-20"><Undo2 size={16}/></button>
                        <button onClick={handleRedo} disabled={redoStack.length===0} className="p-1.5 hover:bg-white/5 disabled:opacity-20"><Redo2 size={16}/></button>
                    </div>
                    <button onClick={() => onNavigateBack?.()} className="px-4 py-1.5 bg-white/5 rounded-lg text-[10px] font-black border border-white/10 uppercase tracking-widest">Sair</button>
                    <button onClick={confirmExtraction} disabled={!activeMask} className="px-4 py-1.5 bg-vingi-600 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-30">Confirmar</button>
                </div>
            </div>

            {!originalImg ? (
                <div className="flex-1 bg-white">
                    <input type="file" onChange={e => {const f=e.target.files?.[0]; if(f){const r=new FileReader(); r.onload=ev=>initStudio(ev.target?.result as string); r.readAsDataURL(f);}}} className="hidden" id="l-up" />
                    <ModuleLandingPage icon={Layers} title="Image Lab Pro" description="Ferramenta de separação técnica com motor SAM-X. Isole elementos com precisão cirúrgica para estamparia e produção têxtil." primaryActionLabel="Iniciar Estúdio" onPrimaryAction={() => document.getElementById('l-up')?.click()} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                    {/* BARRA DE FERRAMENTAS (SIDEBAR DESKTOP) */}
                    <div className="hidden md:flex w-16 bg-[#0a0a0a] border-r border-white/5 flex-col items-center py-6 gap-6 shrink-0 z-50">
                        <ToolBtn icon={Hand} active={tool==='HAND'} onClick={() => setTool('HAND')} tooltip="Mão / Pan (Espaço)" />
                        <ToolBtn icon={Wand2} active={tool==='WAND'} onClick={() => setTool('WAND')} tooltip="Varinha Mágica (W)" />
                        <ToolBtn icon={Brush} active={tool==='BRUSH'} onClick={() => setTool('BRUSH')} tooltip="Pincel de Máscara (B)" />
                        <div className="w-8 h-px bg-white/10"></div>
                        <ToolBtn icon={Eraser} active={tool==='ERASER'} onClick={() => setTool('ERASER')} tooltip="Borracha (E)" />
                        <ToolBtn icon={BoxSelect} active={tool==='RECT'} onClick={() => setTool('RECT')} tooltip="Seleção Retangular" />
                        <ToolBtn icon={Pipette} active={tool==='PICKER'} onClick={() => setTool('PICKER')} tooltip="Conta-gotas (I)" />
                    </div>

                    {/* CANVAS CENTRAL */}
                    <div 
                        ref={containerRef} 
                        className={`flex-1 relative flex items-center justify-center bg-[#050505] overflow-hidden ${isPanning.current || tool==='HAND' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
                        onPointerDown={handlePointerDown}
                        onPointerMove={(e) => {
                            if (isPanning.current || (tool === 'HAND' && e.buttons === 1)) {
                                setView(v => ({ ...v, x: v.x + e.movementX, y: v.y + e.movementY }));
                            }
                        }}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={() => { lastPinchDist.current = 0; }}
                    >
                        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        
                        <div className="relative shadow-2xl transition-transform duration-75 ease-out" style={{ width: originalImg.width, height: originalImg.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                            {layers.map(l => l.visible && (
                                <img key={l.id} src={l.src} className={`absolute inset-0 w-full h-full object-contain ${selectedLayerId===l.id ? 'filter drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]' : ''}`} draggable={false} />
                            ))}
                            <canvas ref={overlayRef} width={originalImg.width} height={originalImg.height} className="absolute inset-0 pointer-events-none z-[60] mix-blend-screen opacity-80" />
                        </div>

                        {/* INDICADOR DE ZOOM */}
                        <div className="absolute bottom-24 md:bottom-6 right-6 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-widest text-gray-400 z-50">
                            {Math.round(view.k * 100)}%
                        </div>
                    </div>

                    {/* PAINEL DE CONTROLE (DESKTOP) */}
                    <div className="hidden md:flex w-72 bg-[#0a0a0a] border-l border-white/5 flex-col z-50">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Parâmetros</span>
                            <Settings2 size={14} className="text-gray-600"/>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
                            {/* MODO OPERACIONAL */}
                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Modo de Operação</label>
                                <div className="flex bg-black rounded-xl p-1 border border-white/5">
                                    <button onClick={() => setToolMode('ADD')} className={`flex-1 py-2 rounded-lg text-[9px] font-black flex items-center justify-center gap-2 transition-all ${toolMode==='ADD' ? 'bg-vingi-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}><Plus size={12}/> Somar</button>
                                    <button onClick={() => setToolMode('SUB')} className={`flex-1 py-2 rounded-lg text-[9px] font-black flex items-center justify-center gap-2 transition-all ${toolMode==='SUB' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}><Minus size={12}/> Subtrair</button>
                                </div>
                            </div>

                            {/* TOLERÂNCIA */}
                            <div className="space-y-3">
                                <div className="flex justify-between text-[9px] font-black text-gray-500 uppercase tracking-widest"><span>Tolerância</span><span>{tolerance}</span></div>
                                <input type="range" min="1" max="150" value={tolerance} onChange={e => setTolerance(parseInt(e.target.value))} className="w-full h-1 bg-gray-800 rounded-full appearance-none accent-vingi-500"/>
                            </div>

                            {/* FEATHER */}
                            <div className="space-y-3">
                                <div className="flex justify-between text-[9px] font-black text-gray-500 uppercase tracking-widest"><span>Suavização (Feather)</span><span>{feather}px</span></div>
                                <input type="range" min="0" max="20" value={feather} onChange={e => setFeather(parseInt(e.target.value))} className="w-full h-1 bg-gray-800 rounded-full appearance-none accent-white"/>
                            </div>

                            {/* OPÇÕES ADICIONAIS */}
                            <div className="space-y-3 pt-4 border-t border-white/5">
                                <OptionToggle label="Contíguo" active={contiguous} onClick={() => setContiguous(!contiguous)} />
                                <OptionToggle label="Anti-alias" active={true} onClick={() => {}} />
                                <OptionToggle label="Seleção Inteligente" active={true} onClick={() => {}} />
                            </div>
                        </div>
                    </div>

                    {/* DOCK INFERIOR (ESTILO INSHOT - MOBILE) */}
                    <div className="md:hidden bg-[#0a0a0a] border-t border-white/5 shrink-0 z-[100] pb-[env(safe-area-inset-bottom)] flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-2 overflow-x-auto no-scrollbar gap-2">
                            <ToolBtn icon={Hand} label="Pan" active={tool==='HAND'} onClick={() => setTool('HAND')} />
                            <ToolBtn icon={Wand2} label="Varinha" active={tool==='WAND'} onClick={() => setTool('WAND')} />
                            <ToolBtn icon={Brush} label="Pincel" active={tool==='BRUSH'} onClick={() => setTool('BRUSH')} />
                            <ToolBtn icon={Pipette} label="Cor" active={tool==='PICKER'} onClick={() => setTool('PICKER')} />
                            <ToolBtn icon={Sliders} label="Ajustes" onClick={() => setShowSheet(true)} />
                        </div>
                    </div>

                    {/* BOTTOM SHEET (MOBILE SETTINGS) */}
                    {isMobile && showSheet && (
                        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowSheet(false)}>
                            <div className="absolute bottom-0 left-0 right-0 bg-[#0f0f0f] rounded-t-[32px] p-6 pb-12 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                                <div className="w-12 h-1.5 bg-gray-800 rounded-full mx-auto mb-8"></div>
                                <div className="space-y-8">
                                    <div className="flex items-center justify-between bg-black p-1 rounded-2xl border border-white/5">
                                        <button onClick={() => setToolMode('ADD')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${toolMode==='ADD' ? 'bg-vingi-600 text-white' : 'text-gray-500'}`}><Plus size={14}/> Somar</button>
                                        <button onClick={() => setToolMode('SUB')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${toolMode==='SUB' ? 'bg-red-600 text-white' : 'text-gray-500'}`}><Minus size={14}/> Subtrair</button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest"><span>Tolerância</span><span className="text-vingi-400">{tolerance}</span></div>
                                        <input type="range" min="1" max="150" value={tolerance} onChange={e => setTolerance(parseInt(e.target.value))} className="w-full h-2 bg-gray-800 rounded-full appearance-none accent-vingi-500"/>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest"><span>Suavização</span><span className="text-white">{feather}px</span></div>
                                        <input type="range" min="0" max="20" value={feather} onChange={e => setFeather(parseInt(e.target.value))} className="w-full h-2 bg-gray-800 rounded-full appearance-none accent-white"/>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button onClick={() => setContiguous(!contiguous)} className={`py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${contiguous ? 'bg-white text-black border-white' : 'bg-transparent border-white/10 text-gray-500'}`}>Contíguo</button>
                                        <button onClick={confirmExtraction} className="py-4 rounded-2xl bg-vingi-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl">Separar Agora</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isProcessing && (
                <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center animate-fade-in">
                    <Loader2 size={48} className="text-vingi-400 animate-spin mb-6" />
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-white animate-pulse">Processando Máscara Pro...</p>
                </div>
            )}
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick, tooltip }: any) => (
    <button onClick={onClick} title={tooltip} className={`flex flex-col items-center justify-center min-w-[64px] h-14 rounded-2xl gap-1 transition-all active:scale-90 ${active ? 'bg-vingi-900/40 text-white border border-vingi-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'text-gray-500 hover:text-white'}`}>
        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className={active ? 'drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]' : ''} />
        {label && <span className="text-[9px] font-black uppercase tracking-tight">{label}</span>}
    </button>
);

const OptionToggle = ({ label, active, onClick }: any) => (
    <div onClick={onClick} className="flex items-center justify-between cursor-pointer group">
        <span className="text-[10px] font-bold text-gray-500 group-hover:text-gray-300 transition-colors">{label}</span>
        <div className={`w-8 h-4 rounded-full transition-all relative ${active ? 'bg-vingi-600' : 'bg-gray-800'}`}>
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${active ? 'left-4.5' : 'left-0.5'}`}></div>
        </div>
    </div>
);
