
import React, { useState, useRef, useEffect } from 'react';
import { Layers, Move, Trash2, Eye, EyeOff, Lock, Hand, RotateCw, Minimize2, X, Loader2, RefreshCcw, PlusCircle, LayoutGrid, Zap, Merge, Eraser, Undo2, Crosshair, Focus } from 'lucide-react';
import { DesignLayer } from '../../types';
import { ModuleLandingPage } from '../../components/Shared';
import { VingiSegmenter } from '../../services/segmentationEngine';

export const LayerStudio: React.FC<{ onNavigateBack?: () => void, onNavigateToMockup?: () => void }> = ({ onNavigateBack, onNavigateToMockup }) => {
    const [originalSrc, setOriginalSrc] = useState<string | null>(null);
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 1024, h: 1024 });
    const [tool, setTool] = useState<'MOVE' | 'WAND' | 'HAND'>('WAND');
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
    
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

    const initFromImage = (src: string) => {
        const img = new Image(); img.src = src;
        img.onload = () => {
            const layer: DesignLayer = {
                id: 'L0', type: 'BACKGROUND', name: 'Base Têxtil', src,
                x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false,
                visible: true, locked: false, zIndex: 0, opacity: 1
            };
            setCanvasSize({ w: img.width, h: img.height });
            setLayers([layer]);
            setSelectedLayerId(layer.id);
            setOriginalSrc(src);
        };
    };

    useEffect(() => {
        if (!overlayCanvasRef.current || !activeMask) return;
        const ctx = overlayCanvasRef.current.getContext('2d')!;
        ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);
        const imgData = ctx.createImageData(canvasSize.w, canvasSize.h);
        for (let i = 0; i < activeMask.length; i++) {
            if (activeMask[i] === 255) {
                const pos = i * 4;
                imgData.data[pos+1] = 255; imgData.data[pos+3] = 130;
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }, [activeMask, canvasSize]);

    const executeIsolation = () => {
        if (!activeMask || !selectedLayerId) return;
        setIsProcessing(true);
        const target = layers.find(l => l.id === selectedLayerId)!;
        const canvas = document.createElement('canvas'); canvas.width = canvasSize.w; canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!;
        const img = new Image(); img.src = target.src;
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < activeMask.length; i++) { if (activeMask[i] === 0) imgData.data[i*4 + 3] = 0; }
            ctx.putImageData(imgData, 0, 0);
            const newLayer: DesignLayer = { ...target, id: 'LX-'+Date.now(), name: 'Extraído', src: canvas.toDataURL() };
            setLayers([...layers, newLayer]);
            setActiveMask(null); setIsProcessing(false);
        };
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden relative">
            <div className="bg-[#111] h-14 border-b border-white/5 px-4 flex items-center justify-between z-[100]">
                <div className="flex items-center gap-2"><Layers size={18} className="text-vingi-400"/><span className="text-xs font-bold uppercase tracking-widest">Layer Studio</span></div>
                <button onClick={() => onNavigateToMockup?.()} className="text-[10px] bg-vingi-600 px-4 py-1.5 rounded-lg font-bold">Finalizar</button>
            </div>
            {!layers.length ? (
                <div className="flex-1 bg-white">
                    <input type="file" ref={fileInputRef} onChange={(e) => { const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>initFromImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                    <ModuleLandingPage icon={Layers} title="Lab de Imagem" description="Separação inteligente de elementos têxteis." primaryActionLabel="Carregar Imagem" onPrimaryAction={() => fileInputRef.current?.click()} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <div ref={containerRef} className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#050505]" onPointerDown={(e) => {
                        const targetLayer = layers.find(l => l.id === selectedLayerId);
                        if (!targetLayer || tool !== 'WAND') return;
                        const canvas = document.createElement('canvas'); canvas.width = canvasSize.w; canvas.height = canvasSize.h;
                        const tCtx = canvas.getContext('2d')!;
                        const img = new Image(); img.src = targetLayer.src;
                        img.onload = () => {
                            tCtx.drawImage(img, 0, 0);
                            const res = VingiSegmenter.segmentObject(tCtx, canvasSize.w, canvasSize.h, 500, 500, 45);
                            if(res) setActiveMask(res.mask);
                        };
                    }}>
                        <div style={{ width: canvasSize.w, height: canvasSize.h, transform: `scale(${view.k})` }} className="relative shadow-2xl">
                            {layers.map(l => l.visible && <img key={l.id} src={l.src} className="absolute inset-0 w-full h-full object-contain" />)}
                            <canvas ref={overlayCanvasRef} width={canvasSize.w} height={canvasSize.h} className="absolute inset-0 pointer-events-none z-[55] opacity-80 animate-pulse" />
                        </div>
                        {activeMask && (
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[200]">
                                <button onClick={executeIsolation} className="bg-red-600 px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl"><Zap size={18}/> Extrair Motivo</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
