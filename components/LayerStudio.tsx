
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
    Layers, Trash2, Eye, EyeOff, Lock, Hand, Wand2, Brush, 
    X, Check, Loader2, LayoutGrid, Sliders, Eraser, 
    Undo2, Redo2, Plus, Minus, Zap, Info, PenTool, ChevronUp, ChevronDown, MousePointer2,
    Activity, Brain, Crosshair, Target, MoreVertical, Copy, MoveDown, Edit2, FlipHorizontal2, FlipVertical2,
    GripVertical, FolderPlus, Link as LinkIcon, Folder, ChevronRight, FolderOpen, Combine, Ungroup, LogOut,
    PlusCircle, Maximize2, MousePointerClick, Settings, Save, ArrowLeft, SlidersHorizontal, Shirt, PlusSquare,
    SearchCode, MessageSquare, Sparkles, BrainCircuit
} from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleLandingPage } from './Shared';
import { LayerEnginePro, MaskSnapshot } from '../services/layerEnginePro';

interface StudioLayer extends DesignLayer {
    parentId?: string;
    isGroup?: boolean;
    expanded?: boolean;
}

// Auxiliar para compressão de imagem antes de enviar para IA
const compressForAI = (img: HTMLImageElement, maxSize = 1024): Promise<string> => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        if (width > maxSize || height > maxSize) {
            if (width > height) {
                height = Math.round((height * maxSize) / width);
                width = maxSize;
            } else {
                width = Math.round((width * maxSize) / height);
                height = maxSize;
            }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
    });
};

export const LayerStudio: React.FC<{ onNavigateBack?: () => void, onNavigateToMockup?: () => void }> = ({ onNavigateBack, onNavigateToMockup }) => {
    // --- ESTADO CORE ---
    const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
    const [originalData, setOriginalData] = useState<Uint8ClampedArray | null>(null);
    const [layers, setLayers] = useState<StudioLayer[]>([]);
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
    const [mobileMenuLayerId, setMobileMenuLayerId] = useState<string | null>(null);
    
    // Ferramentas
    const [tool, setTool] = useState<'WAND' | 'LASSO' | 'BRUSH' | 'ERASER' | 'HAND'>('WAND');
    const [toolMode, setToolMode] = useState<'ADD' | 'SUB'>('ADD');
    const [wandParams, setWandParams] = useState({ tolerance: 45, contiguous: true });
    const [brushParams, setBrushParams] = useState({ size: 50, eraserSize: 50, hardness: 80, opacity: 100, smart: true });
    
    // IA & Segmentação Semântica
    const [wandClickCount, setWandClickCount] = useState(0);
    const [semanticPrompt, setSemanticPrompt] = useState('');
    const [isSemanticLoading, setIsSemanticLoading] = useState(false);
    const [lastClickCoords, setLastClickCoords] = useState<{x: number, y: number} | null>(null);

    // Máscara & Seleção
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [suggestedMask, setSuggestedMask] = useState<Uint8Array | null>(null);
    const [lassoPoints, setLassoPoints] = useState<{x: number, y: number}[]>([]);
    const [undoStack, setUndoStack] = useState<MaskSnapshot[]>([]);

    // Viewport (Centralização e Escala)
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const cursorRef = useRef<HTMLCanvasElement>(null);
    const isInteracting = useRef(false);
    const lastPointerPos = useRef({ x: 0, y: 0 });

    // --- MOTOR ANTI-DISTORÇÃO (ASPECT RATIO LOCK) ---
    const fitImageToContainer = useCallback(() => {
        if (!containerRef.current || !originalImg) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const padding = isMobile ? 30 : 80;
        const availableW = rect.width - padding;
        const availableH = rect.height - padding;
        
        const k = Math.min(availableW / originalImg.naturalWidth, availableH / originalImg.naturalHeight);
        
        setView({ x: 0, y: 0, k: k || 0.8 });
    }, [originalImg, isMobile]);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(() => {
            setIsMobile(window.innerWidth < 768);
            requestAnimationFrame(fitImageToContainer);
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [fitImageToContainer]);

    // --- INICIALIZAÇÃO ---
    const initStudio = (src: string) => {
        setIsProcessing(true);
        const img = new Image();
        img.src = src;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth; 
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            setOriginalData(ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data);
            setOriginalImg(img);
            setLayers([{ id: 'BG', type: 'BACKGROUND', name: 'Original', src, x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: true, zIndex: 0, opacity: 1 }]);
            setSelectedLayerIds(['BG']);
            setIsProcessing(false);
        };
    };

    const getPreciseCoords = (e: React.PointerEvent | PointerEvent) => {
        if (!containerRef.current || !originalImg) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const x = (e.clientX - centerX - view.x) / view.k + originalImg.naturalWidth / 2;
        const y = (e.clientY - centerY - view.y) / view.k + originalImg.naturalHeight / 2;
        return { x, y };
    };

    // --- IA SEMÂNTICA ---
    const handleSemanticWand = async (promptOverride?: string) => {
        if (!originalImg || (!lastClickCoords && !promptOverride)) return;
        setIsSemanticLoading(true);
        try {
            // COMPRESSÃO CRUCIAL: Impede estouro de limite de requisição e timeout
            const compressedDataUrl = await compressForAI(originalImg);
            const cleanBase64 = compressedDataUrl.split(',')[1];
            
            const contextData = lastClickCoords ? { x: lastClickCoords.x / originalImg.naturalWidth, y: lastClickCoords.y / originalImg.naturalHeight } : null;
            
            const res = await fetch('/api/layer-studio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'SEMANTIC_SEGMENTATION', imageBase64: cleanBase64, userPrompt: promptOverride || semanticPrompt, contextData })
            });

            if (!res.ok) throw new Error("API Offline ou Limite Excedido");
            
            const data = await res.json();
            
            if (data.bbox) {
                const { ymin, xmin, ymax, xmax } = data.bbox;
                const canvas = document.createElement('canvas');
                canvas.width = originalImg.naturalWidth; canvas.height = originalImg.naturalHeight;
                const ctx = canvas.getContext('2d')!; ctx.drawImage(originalImg, 0, 0);
                
                const focalX = (xmin + xmax) / 2 * originalImg.naturalWidth / 1000;
                const focalY = (ymin + ymax) / 2 * originalImg.naturalHeight / 1000;
                
                const { suggested } = LayerEnginePro.magicWandPro(ctx, originalImg.naturalWidth, originalImg.naturalHeight, focalX, focalY, { tolerance: 60, contiguous: false, mode: 'ADD' });
                
                // Otimização de loop para imagens gigantes
                const w = originalImg.naturalWidth;
                for(let i=0; i < suggested.length; i++) {
                    if (suggested[i] === 0) continue;
                    const ix = i % w;
                    const iy = (i / w) | 0;
                    const normX = (ix / w) * 1000;
                    const normY = (iy / originalImg.naturalHeight) * 1000;
                    if (normX < xmin || normX > xmax || normY < ymin || normY > ymax) {
                        suggested[i] = 0;
                    }
                }
                setSuggestedMask(suggested);
                setSemanticPrompt('');
            }
        } catch (e) { 
            console.error("Semantic Wand Fail", e); 
            alert("O motor semântico está ocupado ou a imagem é complexa demais. Tente novamente.");
        }
        finally { setIsSemanticLoading(false); }
    };

    // --- HANDLERS ---
    const confirmExtraction = () => {
        if (!activeMask || !originalImg) return;
        setIsProcessing(true);
        const layerSrc = LayerEnginePro.extractLayer(originalImg, activeMask, originalImg.naturalWidth, originalImg.naturalHeight);
        const newId = 'L' + Date.now();
        const newLayer: StudioLayer = { id: newId, type: 'ELEMENT', name: `Recorte ${layers.length}`, src: layerSrc, x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: false, zIndex: layers.length, opacity: 1 };
        setLayers(ls => [...ls, newLayer]);
        setActiveMask(null); setSuggestedMask(null); setIsProcessing(false);
        setSelectedLayerIds([newId]);
        setWandClickCount(0);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!originalImg || !originalData) return;
        isInteracting.current = true;
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
        const { x, y } = getPreciseCoords(e);
        if (tool === 'WAND') {
            setWandClickCount(prev => prev + 1);
            setLastClickCoords({x, y});
            if (activeMask) setUndoStack(prev => LayerEnginePro.pushHistory(prev, activeMask));
            const canvas = document.createElement('canvas'); 
            canvas.width = originalImg.naturalWidth; canvas.height = originalImg.naturalHeight;
            const ctx = canvas.getContext('2d')!; ctx.drawImage(originalImg, 0, 0);
            const { confirmed, suggested } = LayerEnginePro.magicWandPro(ctx, originalImg.naturalWidth, originalImg.naturalHeight, x, y, { ...wandParams, mode: toolMode, existingMask: activeMask || undefined });
            setActiveMask(confirmed); setSuggestedMask(suggested);
        } else if (tool === 'LASSO') setLassoPoints([{x, y}]);
        else if (tool === 'BRUSH' || tool === 'ERASER') {
            if (activeMask) setUndoStack(prev => LayerEnginePro.pushHistory(prev, activeMask));
            const m = tool === 'ERASER' ? 'SUB' : toolMode;
            const currentSize = tool === 'ERASER' ? brushParams.eraserSize : brushParams.size;
            setActiveMask(prev => LayerEnginePro.paintSmartMask(prev || new Uint8Array(originalImg.naturalWidth * originalImg.naturalHeight), originalData, originalImg.naturalWidth, originalImg.naturalHeight, x, y, { ...brushParams, size: currentSize, mode: m, smartEnabled: brushParams.smart }));
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!originalImg || !originalData) return;
        const { x, y } = getPreciseCoords(e);
        setMousePos({ x, y });
        if (isInteracting.current) {
            if (tool === 'LASSO') setLassoPoints(prev => [...prev, {x, y}]);
            else if (tool === 'BRUSH' || tool === 'ERASER') {
                const m = tool === 'ERASER' ? 'SUB' : toolMode;
                const currentSize = tool === 'ERASER' ? brushParams.eraserSize : brushParams.size;
                setActiveMask(prev => LayerEnginePro.paintSmartMask(prev!, originalData, originalImg.naturalWidth, originalImg.naturalHeight, x, y, { ...brushParams, size: currentSize, mode: m, smartEnabled: brushParams.smart }));
            } else if (tool === 'HAND' || (e.buttons === 4) || (isMobile && tool === 'HAND')) {
                const dx = e.clientX - lastPointerPos.current.x;
                const dy = e.clientY - lastPointerPos.current.y;
                setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
            }
        }
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = () => {
        if (!isInteracting.current || !originalImg) return;
        isInteracting.current = false;
        if (tool === 'LASSO' && lassoPoints.length > 3) {
            setIsProcessing(true);
            const mask = LayerEnginePro.createPolygonMask(originalImg.naturalWidth, originalImg.naturalHeight, lassoPoints);
            const src = LayerEnginePro.extractLayer(originalImg, mask, originalImg.naturalWidth, originalImg.naturalHeight);
            setLayers(ls => [...ls, { id: 'L'+Date.now(), type: 'ELEMENT', name: `Laço ${ls.length}`, src, x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: false, zIndex: ls.length, opacity: 1 }]);
            setLassoPoints([]); setIsProcessing(false);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const delta = e.deltaY;
        const scaleChange = delta > 0 ? 0.9 : 1.1;
        const newK = Math.min(Math.max(0.05, view.k * scaleChange), 20);
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;
        const dx = (mouseX - view.x) * (newK / view.k - 1);
        const dy = (mouseY - view.y) * (newK / view.k - 1);
        setView(v => ({ x: v.x - dx, y: v.y - dy, k: newK }));
    };

    useEffect(() => {
        if (!overlayRef.current || !originalImg) return;
        const ctx = overlayRef.current.getContext('2d')!;
        ctx.clearRect(0, 0, originalImg.naturalWidth, originalImg.naturalHeight);
        if (activeMask || suggestedMask) {
            const imgData = ctx.createImageData(originalImg.naturalWidth, originalImg.naturalHeight);
            for (let i = 0; i < (originalImg.naturalWidth * originalImg.naturalHeight); i++) {
                const pos = i * 4;
                if (activeMask && activeMask[i] > 0) { 
                    imgData.data[pos] = 0; imgData.data[pos+1] = 130; imgData.data[pos+2] = 255; imgData.data[pos+3] = 200; 
                } else if (suggestedMask && suggestedMask[i] > 0) {
                    imgData.data[pos] = 255; imgData.data[pos+1] = 40; imgData.data[pos+2] = 40; imgData.data[pos+3] = 180;
                }
            }
            ctx.putImageData(imgData, 0, 0);
        }
    }, [activeMask, suggestedMask, originalImg, toolMode]);

    useEffect(() => {
        if (!cursorRef.current || !originalImg) return;
        const ctx = cursorRef.current.getContext('2d')!;
        const { x, y } = mousePos;
        const k = view.k;
        ctx.clearRect(0, 0, originalImg.naturalWidth, originalImg.naturalHeight);
        if (tool === 'LASSO' && lassoPoints.length > 0) {
            ctx.beginPath(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2/k;
            ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
            lassoPoints.forEach(p => ctx.lineTo(p.x, p.y));
            if (isInteracting.current) ctx.lineTo(x, y);
            ctx.stroke();
        }
        if (tool === 'WAND') {
            ctx.strokeStyle = toolMode === 'ADD' ? '#3b82f6' : '#ef4444';
            ctx.lineWidth = 2 / k;
            const s = 15 / k;
            ctx.beginPath(); ctx.moveTo(x-s, y); ctx.lineTo(x+s, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, y-s); ctx.lineTo(x, y+s); ctx.stroke();
            
            ctx.font = `black ${16/k}px sans-serif`;
            ctx.fillStyle = ctx.strokeStyle;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(toolMode === 'ADD' ? '+' : '-', x + 15/k, y - 15/k);
        }
        if (tool === 'BRUSH' || tool === 'ERASER') {
            const currentSize = tool === 'ERASER' ? brushParams.eraserSize : brushParams.size;
            ctx.beginPath(); ctx.arc(x, y, currentSize/2, 0, Math.PI * 2);
            ctx.strokeStyle = tool === 'ERASER' ? '#ef4444' : '#3b82f6';
            ctx.lineWidth = 2/k;
            ctx.stroke();
        }
    }, [mousePos, lassoPoints, tool, brushParams, toolMode, view.k, originalImg, isInteracting.current]);

    const handleDeleteLayer = (id: string) => {
        if (id === 'BG') return;
        setLayers(ls => ls.filter(l => l.id !== id));
        setSelectedLayerIds(prev => prev.filter(i => i !== id));
        setMobileMenuLayerId(null);
    };

    const handleToggleVisibility = useCallback((id: string) => {
        setLayers(current => current.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
    }, []);

    const handleSelectLayer = (id: string, multi: boolean) => {
        if (multi) {
            setSelectedLayerIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
        } else {
            setSelectedLayerIds([id]);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden relative font-sans touch-none select-none">
            <div className="h-14 bg-black border-b border-white/5 px-4 flex items-center justify-between z-[100] shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => onNavigateBack?.()} className="p-2 -ml-2 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 leading-none">VINGI STUDIO</span>
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">Nexus Pro v10.7</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { if(undoStack.length>0) { const last=undoStack[undoStack.length-1]; setActiveMask(last.data); setUndoStack(undoStack.slice(0,-1)); }}} disabled={undoStack.length===0} className="p-2 text-gray-500 disabled:opacity-20"><Undo2 size={18}/></button>
                    <button onClick={confirmExtraction} disabled={!activeMask} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${activeMask ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-white/5 text-gray-700'}`}>Extrair</button>
                </div>
            </div>

            {!originalImg ? (
                <div className="flex-1 bg-white">
                    <input type="file" onChange={e => {const f=e.target.files?.[0]; if(f){const r=new FileReader(); r.onload=ev=>initStudio(ev.target?.result as string); r.readAsDataURL(f);}}} className="hidden" id="l-up" />
                    <ModuleLandingPage icon={Layers} title="Layer Studio" description="Motor neural v10.7. Alinhamento de ferramentas corrigido para mobile e desktop com preservação de proporção." primaryActionLabel="Selecionar Foto" onPrimaryAction={() => document.getElementById('l-up')?.click()} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <div ref={containerRef} className="flex-1 relative bg-[#050505] overflow-hidden cursor-none touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onWheel={handleWheel}>
                        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        
                        <div 
                            className="absolute shadow-[0_0_80px_rgba(0,0,0,1)] transition-transform duration-75 will-change-transform" 
                            style={{ 
                                width: originalImg.naturalWidth, 
                                height: originalImg.naturalHeight, 
                                left: '50%', top: '50%',
                                marginLeft: -originalImg.naturalWidth / 2,
                                marginTop: -originalImg.naturalHeight / 2,
                                maxWidth: 'none', maxHeight: 'none',
                                transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
                                transformOrigin: 'center center'
                            }}
                        >
                            {layers.map(l => ( 
                                <img 
                                    key={l.id} 
                                    src={l.src} 
                                    className={`absolute inset-0 w-full h-full pointer-events-none ${selectedLayerIds.includes(l.id) ? 'filter drop-shadow-[0_0_10px_rgba(59,130,246,0.4)] z-10' : ''}`} 
                                    draggable={false} 
                                    style={{ 
                                        imageRendering: 'auto', 
                                        objectFit: 'contain', 
                                        display: l.visible ? 'block' : 'none',
                                        opacity: l.opacity ?? 1
                                    }} 
                                /> 
                            ))}
                            <canvas ref={overlayRef} width={originalImg.naturalWidth} height={originalImg.naturalHeight} className="absolute inset-0 pointer-events-none z-[60]" />
                            <canvas ref={cursorRef} width={originalImg.naturalWidth} height={originalImg.naturalHeight} className="absolute inset-0 pointer-events-none z-[70] mix-blend-difference" />
                        </div>
                        
                        {/* SEMANTIC FLOATING BUTTON */}
                        {tool === 'WAND' && wandClickCount >= 3 && !isSemanticLoading && (
                            <button 
                                onClick={() => handleSemanticWand()}
                                className="absolute bottom-1/4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full font-black text-xs shadow-[0_0_30px_rgba(59,130,246,0.8)] animate-bounce-subtle flex items-center gap-2 border-2 border-white/20 z-[200] active:scale-95 transition-transform"
                            >
                                <BrainCircuit size={18}/> LOCALIZAR ELEMENTO INTEIRO
                            </button>
                        )}
                        {isSemanticLoading && (
                            <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full font-black text-xs border border-blue-500/50 z-[200] flex items-center gap-3">
                                <Loader2 size={18} className="animate-spin text-blue-400"/> ANALISANDO ESTRUTURA...
                            </div>
                        )}
                    </div>

                    {isMobile ? (
                        <div className="bg-black border-t border-white/10 z-[150] shadow-2xl safe-area-bottom flex flex-col shrink-0">
                            <div className="h-16 px-4 py-2 flex items-center gap-3 overflow-x-auto no-scrollbar border-b border-white/5 bg-[#0a0a0a]">
                                <button onClick={() => document.getElementById('l-up')?.click()} className="min-w-[48px] h-[48px] rounded-lg bg-white/5 border border-dashed border-white/20 flex items-center justify-center text-gray-500"><PlusSquare size={20}/></button>
                                {[...layers].reverse().map(l => (
                                    <div 
                                        key={l.id} 
                                        onClick={() => handleSelectLayer(l.id, false)}
                                        onContextMenu={(e) => { e.preventDefault(); setMobileMenuLayerId(l.id); }}
                                        className={`min-w-[48px] h-[48px] rounded-lg border-2 transition-all relative overflow-hidden bg-black shrink-0 ${selectedLayerIds.includes(l.id) ? 'border-blue-500 scale-110 shadow-lg' : 'border-white/10 opacity-60'}`}
                                    >
                                        <img src={l.src} className="w-full h-full object-contain" />
                                        {!l.visible && <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center"><EyeOff size={12}/></div>}
                                    </div>
                                ))}
                            </div>
                            <div className="h-12 px-4 flex items-center gap-4 overflow-x-auto no-scrollbar border-b border-white/5 animate-in slide-in-from-bottom-2">
                                 {(tool === 'BRUSH' || tool === 'ERASER') && (
                                    <div className="flex items-center gap-4 w-full">
                                        <div className="min-w-[120px] flex-1">
                                            <MobileSlider 
                                                label={tool === 'ERASER' ? "Tamanho Borracha" : "Tamanho Pincel"} 
                                                value={tool === 'ERASER' ? brushParams.eraserSize : brushParams.size} 
                                                onChange={v => setBrushParams(p=>({...p, [tool === 'ERASER' ? 'eraserSize' : 'size']:v}))} 
                                                min={5} max={400} 
                                            />
                                        </div>
                                        <button onClick={() => setBrushParams(p=>({...p, smart:!p.smart}))} className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 border transition-all ${brushParams.smart ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-transparent text-gray-500'}`}><Brain size={10}/> Neural</button>
                                    </div>
                                 )}
                                 {tool === 'WAND' && (
                                    <div className="w-full flex items-center gap-2">
                                        <div className="flex-1"><MobileSlider label="Mira" value={wandParams.tolerance} onChange={v => setWandParams(p=>({...p, tolerance:v}))} min={1} max={180} /></div>
                                        <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10 shrink-0">
                                            <button onClick={() => setToolMode('ADD')} className={`p-1.5 rounded-md transition-all ${toolMode==='ADD' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500'}`}><Plus size={14}/></button>
                                            <button onClick={() => setToolMode('SUB')} className={`p-1.5 rounded-md transition-all ${toolMode==='SUB' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500'}`}><Minus size={14}/></button>
                                        </div>
                                        <button onClick={() => setWandParams(p=>({...p, contiguous:!p.contiguous}))} className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase border transition-all ${wandParams.contiguous ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-transparent text-gray-500'}`}>Contínuo</button>
                                    </div>
                                 )}
                                 {tool === 'HAND' && (
                                    <button onClick={fitImageToContainer} className="px-3 py-1.5 bg-white/5 rounded-lg text-[9px] font-black text-gray-400 flex items-center gap-1 uppercase tracking-widest"><Maximize2 size={10}/> Centralizar</button>
                                 )}
                            </div>
                            <div className="h-16 px-2 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-1">
                                <div className="flex flex-1 justify-around items-center">
                                    <ToolBtn icon={Hand} label="Pan" active={tool==='HAND'} onClick={() => setTool('HAND')} />
                                    <ToolBtn icon={Wand2} label="Vara" active={tool==='WAND'} onClick={() => setTool('WAND')} />
                                    <ToolBtn icon={PenTool} label="Laço" active={tool==='LASSO'} onClick={() => setTool('LASSO')} />
                                    <ToolBtn icon={Brush} label="Pincel" active={tool==='BRUSH'} onClick={() => setTool('BRUSH')} />
                                    <ToolBtn icon={Eraser} label="Borracha" active={tool==='ERASER'} onClick={() => setTool('ERASER')} />
                                </div>
                                <div className="w-px h-8 bg-white/10 mx-2"></div>
                                <div className="flex gap-2 mr-2">
                                    <button onClick={() => setToolMode(toolMode==='ADD'?'SUB':'ADD')} className={`flex flex-col items-center justify-center min-w-[50px] h-12 rounded-xl transition-all ${toolMode==='ADD' ? 'text-blue-500 bg-blue-500/5' : 'text-red-500 bg-red-500/5'}`}>
                                        {toolMode==='ADD' ? <PlusCircle size={18}/> : <MinusCircle size={18}/>}
                                        <span className="text-[7px] font-black mt-0.5 uppercase">{toolMode==='ADD'?'Somar':'Sub'}</span>
                                    </button>
                                    <button onClick={() => setMobileMenuLayerId(selectedLayerIds[0])} disabled={selectedLayerIds.length === 0} className="flex flex-col items-center justify-center min-w-[50px] h-12 rounded-xl text-gray-400 bg-white/5">
                                        <Settings size={18}/>
                                        <span className="text-[7px] font-black mt-0.5 uppercase">Ação</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="absolute top-0 left-0 bottom-0 w-16 bg-black border-r border-white/5 flex flex-col items-center py-6 gap-5 z-50 shadow-2xl">
                                <ToolBtn icon={Hand} label="Pan" active={tool==='HAND'} onClick={() => setTool('HAND')} />
                                <div className="w-8 h-px bg-white/10"></div>
                                <ToolBtn icon={Wand2} label="Mira" active={tool==='WAND'} onClick={() => setTool('WAND')} />
                                <ToolBtn icon={PenTool} label="Laço" active={tool==='LASSO'} onClick={() => setTool('LASSO')} />
                                <ToolBtn icon={Brush} label="Pincel" active={tool==='BRUSH'} onClick={() => setTool('BRUSH')} />
                                <ToolBtn icon={Eraser} label="Borracha" active={tool==='ERASER'} onClick={() => setTool('ERASER')} />
                                <div className="mt-auto flex flex-col gap-4 mb-4">
                                    <button onClick={() => setToolMode(toolMode==='ADD'?'SUB':'ADD')} className={`p-2 rounded-xl transition-all ${toolMode==='ADD' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                                        {toolMode==='ADD' ? <Plus size={20}/> : <Minus size={20}/>}
                                    </button>
                                </div>
                            </div>

                            <div className="absolute top-0 right-0 bottom-0 w-80 bg-[#080808] border-l border-white/5 flex flex-col z-[100] shadow-2xl">
                                <LayerList 
                                    layers={layers} selectedIds={selectedLayerIds} 
                                    onSelect={(id:string, m:boolean)=>handleSelectLayer(id, m)} 
                                    onRename={(id:string,n:string)=>setLayers(ls=>ls.map(l=>l.id===id?{...l,name:n}:l))} 
                                    onDelete={handleDeleteLayer}
                                    onVisibility={handleToggleVisibility}
                                    editingLayerId={editingLayerId} setEditingLayerId={setEditingLayerId}
                                />
                            </div>

                            {/* COMPACT TOOLBAR DECK (DESKTOP) */}
                            <div className="absolute top-16 left-24 flex flex-col gap-4 z-50 pointer-events-none w-auto max-w-[calc(100%-420px)]">
                                <div className="flex items-center gap-4 px-4 py-3 bg-black/70 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl pointer-events-auto w-max">
                                    {(tool === 'BRUSH' || tool === 'ERASER') && (
                                        <>
                                            <div className="min-w-[140px]">
                                                <MobileSlider 
                                                    label={tool === 'ERASER' ? "Tamanho Borracha" : "Tamanho Pincel"} 
                                                    value={tool === 'ERASER' ? brushParams.eraserSize : brushParams.size} 
                                                    onChange={v => setBrushParams(p=>({...p, [tool === 'ERASER' ? 'eraserSize' : 'size']:v}))} 
                                                    min={5} max={400} 
                                                />
                                            </div>
                                            <div className="h-8 w-px bg-white/10 mx-1"></div>
                                            <button onClick={() => setBrushParams(p=>({...p, smart:!p.smart}))} className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all flex items-center gap-2 ${brushParams.smart ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-transparent text-gray-500'}`}><Brain size={14}/> Neural: {brushParams.smart ? 'ON' : 'OFF'}</button>
                                        </>
                                    )}
                                    {tool === 'WAND' && (
                                        <div className="flex items-center gap-4">
                                            <div className="min-w-[200px]"><MobileSlider label="Tolerância da Mira" value={wandParams.tolerance} onChange={v => setWandParams(p=>({...p, tolerance:v}))} min={1} max={180} /></div>
                                            <div className="h-8 w-px bg-white/10 mx-1"></div>
                                            <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
                                                <button onClick={() => setToolMode('ADD')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 ${toolMode==='ADD' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Plus size={14}/> Somar</button>
                                                <button onClick={() => setToolMode('SUB')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 ${toolMode==='SUB' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Minus size={14}/> Subtrair</button>
                                            </div>
                                            <button onClick={() => setWandParams(p=>({...p, contiguous:!p.contiguous}))} className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all flex items-center gap-2 ${wandParams.contiguous ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-transparent text-gray-500'}`}>Contínuo: {wandParams.contiguous ? 'ON' : 'OFF'}</button>
                                        </div>
                                    )}
                                    {tool === 'HAND' && (
                                        <button onClick={fitImageToContainer} className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black text-white flex items-center gap-2 uppercase tracking-widest transition-all"><Maximize2 size={14}/> Centralizar Visualização</button>
                                    )}
                                    {tool === 'LASSO' && (
                                        <div className="flex items-center gap-3 px-4 py-1">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Modo Laço Livre</span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* TEXT GUIDED SEGMENTATION BAR (COMPACT) */}
                                {tool === 'WAND' && (
                                    <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-900/60 to-black/80 backdrop-blur-xl rounded-2xl border border-blue-500/30 shadow-2xl pointer-events-auto w-full max-w-lg animate-in slide-in-from-top-1 group">
                                        <Sparkles size={18} className="text-blue-400 group-hover:rotate-12 transition-transform duration-500"/>
                                        <input 
                                            type="text" 
                                            value={semanticPrompt}
                                            onChange={(e) => setSemanticPrompt(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSemanticWand(semanticPrompt)}
                                            placeholder="Descreva o elemento que deseja segmentar..." 
                                            className="flex-1 bg-transparent border-none text-[12px] font-bold text-white placeholder-gray-500 outline-none"
                                        />
                                        <button 
                                            onClick={() => handleSemanticWand(semanticPrompt)}
                                            disabled={!semanticPrompt || isSemanticLoading}
                                            className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl transition-all disabled:opacity-30 flex items-center gap-2 px-4 shadow-lg shadow-blue-900/20"
                                        >
                                            {isSemanticLoading ? <Loader2 size={14} className="animate-spin"/> : <SearchCode size={16}/>}
                                            <span className="text-[10px] font-black uppercase tracking-widest">Segmentar</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {mobileMenuLayerId && (
                        <div className="fixed inset-0 z-[300] animate-in fade-in flex flex-col justify-end">
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileMenuLayerId(null)} />
                            <div className="relative bg-[#111] rounded-t-[32px] p-6 shadow-2xl border-t border-white/10 animate-in slide-in-from-bottom">
                                <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
                                <div className="grid grid-cols-2 gap-4 pb-8">
                                    <MenuAction icon={Edit2} label="Renomear" onClick={() => { setEditingLayerId(mobileMenuLayerId); setMobileMenuLayerId(null); }} />
                                    <MenuAction icon={Copy} label="Duplicar" onClick={() => { const l = layers.find(x=>x.id===mobileMenuLayerId); if(l) setLayers([...layers, {...l, id: 'L'+Date.now(), name: l.name+' (Cópia)'}]); setMobileMenuLayerId(null); }} />
                                    <MenuAction icon={Eye} label="Visibilidade" onClick={() => { handleToggleVisibility(mobileMenuLayerId); setMobileMenuLayerId(null); }} />
                                    <MenuAction icon={Trash2} label="Excluir" danger onClick={() => { handleDeleteLayer(mobileMenuLayerId); setMobileMenuLayerId(null); }} />
                                    <MenuAction icon={Shirt} label="Molde" onClick={() => { const l = layers.find(x=>x.id===mobileMenuLayerId); if(l) triggerTransfer('MOCKUP', l.src); setMobileMenuLayerId(null); }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {isProcessing && ( <div className="fixed inset-0 z-[500] bg-black/95 flex flex-col items-center justify-center animate-fade-in"><Brain size={48} className="text-blue-500 animate-pulse mb-4" /><p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-200">Processando Nexus Core...</p></div> )}
        </div>
    );
};

const MenuAction = ({ icon: Icon, label, onClick, danger }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-white/5 active:scale-95 transition-all ${danger ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-gray-300'}`}>
        <Icon size={24}/>
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
);

const ToolBtn = ({ icon: Icon, label, active, onClick }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center min-w-[54px] h-12 rounded-xl transition-all ${active ? 'bg-white/10 text-white scale-110' : 'text-gray-600 hover:text-gray-400'}`}>
        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
        <span className={`text-[8px] mt-0.5 uppercase font-black tracking-tight ${active ? 'text-white' : 'text-gray-700'}`}>{label}</span>
    </button>
);

const MobileSlider = ({ label, value, onChange, min, max }: any) => (
    <div className="flex flex-col gap-1 w-full">
        <div className="flex justify-between px-1"><span className="text-[8px] font-black text-gray-500 uppercase">{label}</span><span className="text-[8px] font-mono text-blue-500">{value}</span></div>
        <input type="range" min={min} max={max} value={value} onChange={e => onChange(parseInt(e.target.value))} className="w-full h-2 bg-white/5 rounded-full appearance-none accent-blue-500 outline-none border border-white/5" />
    </div>
);

const MinusCircle = ({ size = 24, className = "" }) => ( <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg> );

const LayerList = ({ layers, selectedIds, onSelect, onRename, onDelete, onVisibility, editingLayerId, setEditingLayerId }: any) => {
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-5 flex items-center justify-between border-b border-white/5">
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2"><LayoutGrid size={14}/> Camadas Nexus</span>
                <button className="p-2 bg-white/5 rounded-full text-gray-500"><Settings size={14}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar pb-32">
                {[...layers].reverse().map((l: any) => {
                    const isSelected = selectedIds.includes(l.id);
                    const isEditing = editingLayerId === l.id;
                    return (
                        <div 
                            key={l.id} 
                            onClick={(e) => {
                                if (!l.visible) {
                                    onVisibility(l.id);
                                }
                                onSelect(l.id, e.ctrlKey || e.metaKey);
                            }} 
                            className={`p-3 rounded-2xl border transition-all flex items-center gap-4 relative cursor-pointer ${isSelected ? 'bg-blue-600/10 border-blue-500/50 shadow-lg' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                        >
                            <div className="w-12 h-12 bg-black rounded-xl border border-white/10 flex items-center justify-center p-0.5 overflow-hidden shrink-0 shadow-inner">
                                {l.isGroup ? <Folder className="text-blue-500" size={24}/> : <img src={l.src} className="max-w-full max-h-full object-contain" />}
                                {!l.visible && <div className="absolute inset-0 bg-red-900/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none"><EyeOff size={14} className="text-white"/></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                {isEditing ? (
                                    <input autoFocus className="w-full bg-blue-900/30 border border-blue-500/50 rounded px-2 py-1 text-[11px] font-bold text-white outline-none" defaultValue={l.name} onBlur={(e) => { onRename(l.id, e.target.value); setEditingLayerId(null); }} onKeyDown={(e) => e.key==='Enter' && onRename(l.id, e.currentTarget.value)} />
                                ) : (
                                    <div className="flex flex-col">
                                        <p className={`text-[11px] font-black truncate uppercase tracking-tight ${isSelected ? 'text-blue-400' : l.visible ? 'text-gray-200' : 'text-gray-600'}`}>{l.name}</p>
                                        <span className="text-[8px] text-gray-600 font-mono tracking-tighter">REF_{l.id.substring(0, 8)}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <button 
                                    type="button"
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        e.preventDefault();
                                        onVisibility(l.id); 
                                    }} 
                                    className={`p-2 rounded-lg transition-colors cursor-pointer ${l.visible ? 'text-blue-400 bg-blue-400/5 hover:bg-blue-400/10' : 'text-gray-700 bg-black/20 hover:bg-black/30'}`}
                                >
                                    {l.visible ? <Eye size={16} className="pointer-events-none"/> : <EyeOff size={16} className="pointer-events-none"/>}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === l.id ? null : l.id); }} className="p-2 text-gray-500 hover:text-white"><MoreVertical size={18}/></button>
                            </div>
                            {menuOpenId === l.id && (
                                <div className="absolute right-2 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-[300] p-1 animate-in fade-in slide-in-from-top-2">
                                    <button onClick={(e)=>{e.stopPropagation(); setEditingLayerId(l.id); setMenuOpenId(null);}} className="w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold text-gray-300 hover:bg-blue-600 hover:text-white rounded-xl transition-all"><Edit2 size={14}/> Renomear</button>
                                    <button onClick={(e)=>{e.stopPropagation(); triggerTransfer('MOCKUP', l.src); setMenuOpenId(null);}} className="w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold text-gray-300 hover:bg-blue-600 hover:text-white rounded-xl transition-all"><Shirt size={14}/> Aplicar em Molde</button>
                                    <div className="h-px bg-white/5 my-1"></div>
                                    <button onClick={(e)=>{e.stopPropagation(); onDelete(l.id); setMenuOpenId(null);}} className="w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all"><Trash2 size={14}/> Excluir Permanente</button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {menuOpenId && <div className="fixed inset-0 z-[250]" onClick={() => setMenuOpenId(null)} />}
        </div>
    );
};

const triggerTransfer = (targetModule: string, imageData: string) => {
    if (targetModule === 'MOCKUP') localStorage.setItem('vingi_mockup_pattern', imageData);
    window.dispatchEvent(new CustomEvent('vingi_transfer', { detail: { module: targetModule } }));
};
