
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Layers, Move, Trash2, Eye, EyeOff, Lock, Hand, RotateCw, Minimize2, 
    Minus, Plus, X, Brush, Focus, Loader2, RefreshCcw, PlusCircle, 
    LayoutGrid, Sparkles, Wand2, Send, Crosshair, Target, Zap, Merge, 
    Eraser, Undo2, MoreHorizontal, Check, Download, MousePointer2, 
    ChevronUp, ChevronDown, SlidersHorizontal, Settings2, Scissors
} from 'lucide-react';
import { DesignLayer } from '../types';
import { ModuleLandingPage } from './Shared';

// --- ENGINE DE SEGMENTAÇÃO TÁTICA ---
const VingiTacticalSegmenter = {
    // Retorna máscara confirmada (Verde) e sugestão (Vermelha)
    segment: (ctx: CanvasRenderingContext2D, width: number, height: number, x: number, y: number, tolerance: number) => {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const confirmedMask = new Uint8Array(width * height);
        const suggestedMask = new Uint8Array(width * height);
        const visited = new Uint8Array(width * height);
        const stack: [number, number][] = [[Math.floor(x), Math.floor(y)]];
        
        const startPos = (Math.floor(y) * width + Math.floor(x)) * 4;
        const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];

        // Lógica de Vizinhança
        while (stack.length) {
            const [cx, cy] = stack.pop()!;
            const idx = cy * width + cx;
            if (visited[idx]) continue;
            visited[idx] = 1;
            const pos = idx * 4;
            
            const diff = Math.abs(data[pos] - r0) + Math.abs(data[pos+1] - g0) + Math.abs(data[pos+2] - b0);
            
            // VERDE: Seleção Confirmada (Direta)
            if (diff <= tolerance) {
                confirmedMask[idx] = 255;
                if (cx > 0) stack.push([cx-1, cy]);
                if (cx < width - 1) stack.push([cx+1, cy]);
                if (cy > 0) stack.push([cx, cy-1]);
                if (cy < height - 1) stack.push([cx, cy+1]);
            } 
            // VERMELHO: Sugestão Inteligente (Vizinhança Expandida com Tolerância Maior)
            else if (diff <= tolerance * 2.2) {
                suggestedMask[idx] = 255;
            }
        }
        return { confirmedMask, suggestedMask };
    }
};

export const LayerStudio: React.FC<{ onNavigateBack?: () => void, onNavigateToMockup?: () => void }> = ({ onNavigateBack, onNavigateToMockup }) => {
    const [originalSrc, setOriginalSrc] = useState<string | null>(null);
    const [layers, setLayers] = useState<DesignLayer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    
    // States de Seleção
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [suggestedMask, setSuggestedMask] = useState<Uint8Array | null>(null);
    const [wandTolerance, setWandTolerance] = useState(45);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // UI State
    const [tool, setTool] = useState<'MOVE' | 'WAND' | 'ERASER' | 'HAND'>('WAND');
    const [showLayers, setShowLayers] = useState(!isMobile);
    const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
    const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

    const containerRef = useRef<HTMLDivElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Ajuste de layout responsivo
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const initFromImage = (src: string) => {
        const img = new Image(); img.src = src;
        img.onload = () => {
            const layer: DesignLayer = {
                id: 'BG', type: 'BACKGROUND', name: 'Original', src,
                x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false,
                visible: true, locked: false, zIndex: 0, opacity: 1
            };
            setCanvasSize({ w: img.width, h: img.height });
            setLayers([layer]);
            setSelectedLayerId(layer.id);
            setOriginalSrc(src);
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setView({ x: 0, y: 0, k: Math.min(rect.width/img.width, rect.height/img.height) * 0.8 });
            }
        };
    };

    // --- RENDERIZADOR DE OVERLAY (VERDE/VERMELHO) ---
    useEffect(() => {
        if (!overlayCanvasRef.current || (!activeMask && !suggestedMask)) return;
        const ctx = overlayCanvasRef.current.getContext('2d')!;
        ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);
        const imgData = ctx.createImageData(canvasSize.w, canvasSize.h);
        
        const len = canvasSize.w * canvasSize.h;
        for (let i = 0; i < len; i++) {
            const pos = i * 4;
            if (activeMask && activeMask[i] === 255) {
                imgData.data[pos] = 0; imgData.data[pos+1] = 255; imgData.data[pos+2] = 0; imgData.data[pos+3] = 160; // Verde Confirmação
            } else if (suggestedMask && suggestedMask[i] === 255) {
                imgData.data[pos] = 255; imgData.data[pos+1] = 0; imgData.data[pos+2] = 0; imgData.data[pos+3] = 100; // Vermelho Sugestão
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }, [activeMask, suggestedMask, canvasSize]);

    const handleCanvasClick = (e: React.PointerEvent) => {
        if (!containerRef.current || tool !== 'WAND') return;
        const rect = containerRef.current.getBoundingClientRect();
        const cx = (e.clientX - rect.left - rect.width/2 - view.x) / view.k + canvasSize.w/2;
        const cy = (e.clientY - rect.top - rect.height/2 - view.y) / view.k + canvasSize.h/2;

        const target = layers.find(l => l.id === selectedLayerId);
        if (!target) return;

        const tempC = document.createElement('canvas'); tempC.width = canvasSize.w; tempC.height = canvasSize.h;
        const tCtx = tempC.getContext('2d')!;
        const img = new Image(); img.src = target.src;
        img.onload = () => {
            tCtx.drawImage(img, 0, 0);
            const { confirmedMask, suggestedMask: suggestion } = VingiTacticalSegmenter.segment(tCtx, canvasSize.w, canvasSize.h, cx, cy, wandTolerance);
            setActiveMask(confirmedMask);
            setSuggestedMask(suggestion);
        };
    };

    const extractLayer = () => {
        if (!activeMask || !selectedLayerId) return;
        setIsProcessing(true);
        const target = layers.find(l => l.id === selectedLayerId)!;
        const canvas = document.createElement('canvas'); canvas.width = canvasSize.w; canvas.height = canvasSize.h;
        const ctx = canvas.getContext('2d')!;
        const img = new Image(); img.src = target.src;
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvasSize.w, canvasSize.h);
            for (let i = 0; i < activeMask.length; i++) { if (activeMask[i] === 0) imgData.data[i*4 + 3] = 0; }
            ctx.putImageData(imgData, 0, 0);
            
            const newLayer: DesignLayer = {
                id: 'L' + Date.now(), type: 'ELEMENT', name: `Camada ${layers.length}`, src: canvas.toDataURL(),
                x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, visible: true, locked: false, zIndex: layers.length, opacity: 1
            };
            setLayers([...layers, newLayer]);
            setSelectedLayerId(newLayer.id);
            setActiveMask(null); setSuggestedMask(null);
            setIsProcessing(false);
        };
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden relative font-sans">
            {/* HEADER PROFISSIONAL */}
            <div className="h-14 bg-[#111] border-b border-white/5 px-4 flex items-center justify-between shrink-0 z-[100] shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="bg-vingi-900/50 p-2 rounded-xl border border-vingi-500/30 text-vingi-400 animate-pulse"><Layers size={18}/></div>
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-widest leading-none">Lab de Imagem</h2>
                        <p className="text-[9px] text-gray-500 uppercase font-bold mt-1 tracking-tight">Separador de Camadas Inteligente</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowLayers(!showLayers)} className="p-2 bg-white/5 rounded-lg border border-white/10 md:hidden"><LayoutGrid size={18}/></button>
                    <button onClick={() => onNavigateBack?.()} className="text-[10px] bg-white/5 px-4 py-1.5 rounded-lg border border-white/10 font-bold uppercase hover:bg-white/10 transition-all">Voltar</button>
                    <button className="text-[10px] bg-vingi-600 px-4 py-1.5 rounded-lg font-black uppercase shadow-lg shadow-vingi-900/50 flex items-center gap-2">Exportar <Settings2 size={12}/></button>
                </div>
            </div>

            {!layers.length ? (
                <div className="flex-1 bg-white">
                    <input type="file" ref={fileInputRef} onChange={e => {const f=e.target.files?.[0]; if(f){const r=new FileReader(); r.onload=ev=>initFromImage(ev.target?.result as string); r.readAsDataURL(f);}}} className="hidden" />
                    <ModuleLandingPage icon={Layers} title="Separador de Camadas" description="A IA identifica elementos da estampa para separação técnica. Use a varinha mágica para selecionar e o motor de produção para o refinamento final." primaryActionLabel="Iniciar Estúdio" onPrimaryAction={() => fileInputRef.current?.click()} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                    {/* BARRA DE FERRAMENTAS LATERAL (DESKTOP) */}
                    <div className="hidden md:flex w-16 bg-[#0a0a0a] border-r border-white/5 flex-col items-center py-6 gap-6 shrink-0">
                        <ToolBtn icon={Hand} active={tool==='HAND'} onClick={() => setTool('HAND')} tooltip="Pan" />
                        <ToolBtn icon={Wand2} active={tool==='WAND'} onClick={() => setTool('WAND')} tooltip="Varinha Mágica" />
                        <ToolBtn icon={Move} active={tool==='MOVE'} onClick={() => setTool('MOVE')} tooltip="Mover Camada" />
                        <div className="w-8 h-px bg-white/10"></div>
                        <ToolBtn icon={Eraser} active={tool==='ERASER'} onClick={() => setTool('ERASER')} tooltip="Borracha" />
                    </div>

                    {/* CANVAS CENTRAL */}
                    <div 
                        ref={containerRef} 
                        className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#050505] cursor-crosshair touch-none"
                        onPointerDown={handleCanvasClick}
                        onPointerMove={(e) => {
                            if (e.buttons === 4 || (tool==='HAND' && e.buttons === 1)) {
                                setView(v => ({ ...v, x: v.x + e.movementX, y: v.y + e.movementY }));
                            }
                        }}
                    >
                        {/* Grid de Fundo */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                        
                        <div className="relative shadow-2xl transition-transform duration-75 ease-out" style={{ width: canvasSize.w, height: canvasSize.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                            {layers.map(l => l.visible && (
                                <div key={l.id} className="absolute inset-0 pointer-events-none" style={{ zIndex: l.zIndex, opacity: l.opacity ?? 1 }}>
                                    <img src={l.src} className={`w-full h-full object-contain ${selectedLayerId === l.id ? 'filter drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]' : ''}`} draggable={false} />
                                </div>
                            ))}
                            <canvas ref={overlayCanvasRef} width={canvasSize.w} height={canvasSize.h} className="absolute inset-0 pointer-events-none z-[60] opacity-80 mix-blend-screen" />
                        </div>

                        {/* HUD TÁTICO (MOBILE/DESKTOP) */}
                        {activeMask && (
                            <div className="absolute bottom-32 md:bottom-10 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
                                <div className="bg-black/90 backdrop-blur-3xl border border-white/10 px-6 py-4 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center gap-6">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-vingi-400 uppercase tracking-widest">Área Selecionada (Verde)</span>
                                        <span className="text-[10px] text-gray-400 font-bold">Confirme para criar nova camada</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => {setActiveMask(null); setSuggestedMask(null);}} className="p-3 bg-white/5 rounded-full hover:bg-red-900/20 text-gray-500 hover:text-red-500 transition-all"><X size={20}/></button>
                                        <button onClick={extractLayer} className="bg-vingi-600 hover:bg-vingi-500 text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl">Confirmar <Check size={18}/></button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PAINEL DE CAMADAS (LATERAIS/DESLIZANTE) */}
                    <div className={`absolute md:relative right-0 top-0 bottom-0 bg-[#0a0a0a]/95 backdrop-blur-2xl border-l border-white/5 transition-all duration-300 z-[150] shadow-2xl flex flex-col ${showLayers ? 'w-72 translate-x-0' : 'w-0 translate-x-full md:translate-x-0 md:w-0 overflow-hidden'}`}>
                        <div className="p-4 border-b border-white/5 flex justify-between items-center shrink-0">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Painel de Camadas</span>
                            <button onClick={() => setShowLayers(false)} className="md:hidden"><X size={18}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                            {layers.slice().reverse().map((l, i) => (
                                <div key={l.id} onClick={() => setSelectedLayerId(l.id)} className={`group p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${selectedLayerId===l.id ? 'bg-vingi-900/40 border-vingi-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                                    <div className="w-12 h-12 bg-black rounded-xl overflow-hidden border border-white/10 shrink-0"><img src={l.src} className="w-full h-full object-cover" /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[11px] font-bold truncate ${selectedLayerId===l.id ? 'text-white' : 'text-gray-500'}`}>{l.name}</p>
                                        <div className="flex items-center gap-3 mt-2">
                                            <button onClick={(e) => {e.stopPropagation(); setLayers(ls => ls.map(ly => ly.id===l.id ? {...ly, visible:!ly.visible} : ly))}}>{l.visible ? <Eye size={12}/> : <EyeOff size={12} className="text-red-500"/>}</button>
                                            <button onClick={(e) => {e.stopPropagation(); setLayers(ls => ls.map(ly => ly.id===l.id ? {...ly, locked:!ly.locked} : ly))}}>{l.locked ? <Lock size={12} className="text-vingi-500"/> : <Lock size={12} className="text-gray-600"/>}</button>
                                            <button onClick={(e) => {e.stopPropagation(); setLayers(ls => ls.filter(ly => ly.id!==l.id)); if(selectedLayerId===l.id) setSelectedLayerId(null);}} className="hover:text-red-500 opacity-0 group-hover:opacity-100 ml-auto"><Trash2 size={12}/></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* DOCK INFERIOR (ESTILO INSHOT - MOBILE) */}
                    <div className="bg-[#0a0a0a] border-t border-white/5 shrink-0 z-[100] pb-[env(safe-area-inset-bottom)] flex flex-col shadow-2xl md:hidden">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-6">
                            <div className="flex-1 space-y-2">
                                <div className="flex justify-between text-[9px] font-black text-gray-500 uppercase tracking-widest"><span>Tolerância da Varinha</span><span>{wandTolerance}%</span></div>
                                <input type="range" min="5" max="150" value={wandTolerance} onChange={e => setWandTolerance(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-full appearance-none accent-vingi-500"/>
                            </div>
                        </div>
                        <div className="flex items-center justify-between px-6 py-2 overflow-x-auto no-scrollbar">
                            <ToolBtn icon={Hand} label="Pan" active={tool==='HAND'} onClick={() => setTool('HAND')} />
                            <ToolBtn icon={Wand2} label="Varinha" active={tool==='WAND'} onClick={() => setTool('WAND')} />
                            <ToolBtn icon={Move} label="Mover" active={tool==='MOVE'} onClick={() => setTool('MOVE')} />
                            <ToolBtn icon={Eraser} label="Borracha" active={tool==='ERASER'} onClick={() => setTool('ERASER')} />
                            <ToolBtn icon={LayoutGrid} label="Camadas" onClick={() => setShowLayers(true)} />
                        </div>
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative mb-8"><div className="absolute inset-0 bg-vingi-500 blur-[60px] opacity-20 animate-pulse rounded-full"></div><Loader2 size={64} className="text-vingi-400 animate-spin relative z-10" /></div>
                    <p className="text-lg font-black uppercase tracking-[0.4em] text-white">Segmentando Camadas...</p>
                </div>
            )}
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick, tooltip }: any) => (
    <button 
        onClick={onClick} 
        title={tooltip}
        className={`flex flex-col items-center justify-center min-w-[64px] h-14 rounded-2xl gap-1.5 transition-all active:scale-90 ${active ? 'bg-vingi-900/60 text-white border border-vingi-500/30' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
    >
        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className={active ? 'drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]' : ''} /> 
        {label && <span className="text-[9px] font-black uppercase tracking-tight">{label}</span>}
    </button>
);
