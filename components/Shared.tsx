
import React, { useState, useRef, useEffect } from 'react';
import { Move, ZoomIn, Minimize2, ImageIcon, RotateCcw, X, Info, Plus, Globe, Cpu, Database, Network, Check, Eye, EyeOff, Maximize2, Minus, GripHorizontal } from 'lucide-react';

// --- VISUALIZADOR INTELIGENTE (ZOOM/PAN) ---
export const SmartImageViewer: React.FC<{ src: string, className?: string, style?: React.CSSProperties }> = ({ src, className = "", style }) => {
    const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
    const [isPinching, setIsPinching] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastDist = useRef<number>(0);
    const lastPos = useRef<{x: number, y: number}>({x: 0, y: 0});
    const isDragging = useRef(false);

    const getDist = (t1: React.Touch, t2: React.Touch) => Math.sqrt((t1.clientX-t2.clientX)**2 + (t1.clientY-t2.clientY)**2);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const scaleChange = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(0.5, transform.k + scaleChange), 8); // Max zoom 8x
        setTransform(p => ({ ...p, k: newScale }));
    };

    const handlePointerDown = (e: React.TouchEvent | React.MouseEvent) => {
        if ('touches' in e && e.touches.length === 2) {
            setIsPinching(true);
            lastDist.current = getDist(e.touches[0], e.touches[1]);
        } else {
            isDragging.current = true;
            const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            lastPos.current = { x: cx, y: cy };
        }
    };

    const handlePointerMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (isPinching && 'touches' in e && e.touches.length === 2) {
            e.preventDefault();
            e.stopPropagation();
            const dist = getDist(e.touches[0], e.touches[1]);
            const zoomFactor = dist / lastDist.current;
            const newScale = Math.min(Math.max(transform.k * zoomFactor, 0.5), 8);
            setTransform(p => ({ ...p, k: newScale }));
            lastDist.current = dist;
        } else if (isDragging.current) {
            e.preventDefault(); 
            e.stopPropagation();
            const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            const dx = cx - lastPos.current.x;
            const dy = cy - lastPos.current.y;
            setTransform(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
            lastPos.current = { x: cx, y: cy };
        }
    };

    const handlePointerUp = () => { isDragging.current = false; setIsPinching(false); };
    const reset = () => setTransform({ k: 1, x: 0, y: 0 });

    return (
        <div 
            ref={containerRef}
            className={`overflow-hidden relative cursor-grab active:cursor-grabbing touch-none flex items-center justify-center bg-gray-50/50 ${className}`}
            style={style}
            onWheel={handleWheel}
            onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}
            onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
            onDoubleClick={reset}
        >
            <div 
                style={{ 
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`, 
                    transition: isDragging.current || isPinching ? 'none' : 'transform 0.1s linear',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <img src={src} className="max-w-full max-h-full object-contain pointer-events-none select-none" draggable={false} />
            </div>
            
            {/* Zoom Controls Overlay */}
            <div className="absolute bottom-2 right-2 flex flex-col gap-1 z-10 scale-90 origin-bottom-right">
                <button onClick={(e) => { e.stopPropagation(); setTransform(p => ({...p, k: Math.min(p.k * 1.2, 8)})); }} className="bg-black/50 backdrop-blur text-white p-1.5 rounded-full shadow-sm hover:bg-black/70 border border-white/10"><Plus size={14}/></button>
                <button onClick={(e) => { e.stopPropagation(); reset(); }} className="bg-black/50 backdrop-blur text-white p-1.5 rounded-full shadow-sm hover:bg-black/70 border border-white/10"><RotateCcw size={14}/></button>
                <button onClick={(e) => { e.stopPropagation(); setTransform(p => ({...p, k: Math.max(p.k / 1.2, 0.5)})); }} className="bg-black/50 backdrop-blur text-white p-1.5 rounded-full shadow-sm hover:bg-black/70 border border-white/10"><Minus size={14}/></button>
            </div>
        </div>
    );
};

// --- TIPO DE PROPRIEDADES DO CABEÇALHO ---
interface ModuleHeaderProps {
    icon: React.ElementType;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
    rightContent?: React.ReactNode;
    referenceImage?: string | null; // Miniatura da referência
}

export const ModuleHeader: React.FC<ModuleHeaderProps> = ({ 
    icon: Icon, title, subtitle, actionLabel, onAction, rightContent, referenceImage 
}) => {
    const [showPreview, setShowPreview] = useState(false);

    return (
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 z-40 shadow-sm relative h-16">
            {/* Lado Esquerdo (Ícone e Títulos - Mobile) */}
            <div className="flex items-center gap-3 md:hidden">
                <div className="bg-vingi-900 p-2 rounded-lg text-white shadow-md">
                    <Icon size={18}/>
                </div>
            </div>

            {/* Centro (Títulos - Desktop & Mobile Absolute Center) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center flex flex-col items-center">
                <div className="hidden md:flex items-center gap-2 mb-0.5">
                    <div className="bg-vingi-900 p-1.5 rounded text-white shadow-sm">
                        <Icon size={14}/>
                    </div>
                    <h1 className="text-sm font-bold text-gray-900 leading-tight uppercase tracking-wide">{title}</h1>
                </div>
                <h1 className="md:hidden text-sm font-bold text-gray-900 leading-tight uppercase tracking-wide">{title}</h1>
                {subtitle && <p className="text-[10px] text-gray-500 font-medium hidden md:block">{subtitle}</p>}
            </div>

            {/* Lado Direito (Ações) */}
            <div className="flex items-center gap-3 ml-auto">
                {/* Miniatura de Referência no Header */}
                {referenceImage && (
                    <div 
                        className="relative group cursor-pointer"
                        onMouseEnter={() => setShowPreview(true)}
                        onMouseLeave={() => setShowPreview(false)}
                    >
                        <div className="w-8 h-8 rounded border border-gray-200 overflow-hidden bg-gray-100">
                            <img src={referenceImage} className="w-full h-full object-cover" />
                        </div>
                        {/* Tooltip Preview */}
                        <div className={`absolute top-full right-0 mt-2 w-32 bg-white p-1 rounded-lg shadow-xl border border-gray-200 transition-all duration-200 ${showPreview ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
                            <img src={referenceImage} className="w-full h-auto rounded border border-gray-100" />
                            <div className="text-[9px] text-center text-gray-500 mt-1 font-bold">Ref. Ativa</div>
                        </div>
                    </div>
                )}

                {rightContent}
                
                {onAction && actionLabel && (
                    <button 
                        onClick={onAction} 
                        className="text-xs font-bold text-gray-500 hover:text-red-500 flex items-center gap-1 bg-gray-50 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors border border-gray-200"
                    >
                        <X size={12}/> <span className="hidden md:inline">{actionLabel}</span>
                    </button>
                )}
            </div>
        </header>
    );
};

// --- NOVO COMPONENTE DE LANDING PAGE "CAPA DE REVISTA TÉCNICA" ---
interface ModuleLandingPageProps {
    icon: React.ElementType;
    title: string;
    description: string;
    primaryActionLabel?: string; // Opcional agora
    onPrimaryAction?: () => void;
    secondaryAction?: React.ReactNode; 
    versionLabel?: string;
    features?: string[];
    partners?: string[]; // Lista de logos/nomes para o rodapé
    customContent?: React.ReactNode; // Conteúdo customizado para substituir botões padrão
}

export const ModuleLandingPage: React.FC<ModuleLandingPageProps> = ({
    icon: Icon, title, description, primaryActionLabel, onPrimaryAction, secondaryAction, versionLabel = "VINGI ENGINE 6.5", features, partners, customContent
}) => {
    return (
        <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-[#f8fafc] w-full h-full">
            {/* FUNDO TÉCNICO COM GRID E SCANLINE OTIMIZADA */}
            <div className="absolute inset-0 pointer-events-none h-full w-full fixed z-0 overflow-hidden">
                {/* Grid */}
                <div className="absolute inset-0 opacity-[0.03]" 
                     style={{ backgroundImage: 'linear-gradient(#0f172a 1px, transparent 1px), linear-gradient(90deg, #0f172a 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                </div>
                {/* Scan Line Animation - JITTER FIXED (transform instead of top) */}
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-400/50 shadow-[0_0_30px_rgba(59,130,246,0.6)] animate-scan will-change-transform"></div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative z-10 w-full max-w-[1600px] mx-auto min-h-min pb-32">
                <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    
                    {/* ESQUERDA: HERO CONTENT */}
                    <div className="text-left space-y-8 animate-fade-in w-full max-w-2xl mx-auto lg:mx-0">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            <span className="text-[10px] font-bold text-blue-700 tracking-widest uppercase">Sistema Pronto • {versionLabel}</span>
                        </div>

                        <div className="space-y-6">
                            <div className="w-16 h-16 bg-gradient-to-br from-vingi-900 to-slate-800 rounded-2xl flex items-center justify-center shadow-2xl shadow-slate-400/20 text-white mb-2">
                                <Icon size={32} />
                            </div>
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight">
                                {title}
                            </h1>
                            <p className="text-lg text-slate-500 leading-relaxed font-light">
                                {description}
                            </p>
                        </div>

                        {customContent ? (
                            customContent
                        ) : (
                            <div className="flex flex-col sm:flex-row gap-4">
                                {onPrimaryAction && primaryActionLabel && (
                                    <button 
                                        onClick={onPrimaryAction} 
                                        className="px-8 py-4 bg-vingi-900 text-white rounded-xl font-bold text-sm shadow-xl hover:bg-vingi-800 hover:scale-105 transition-all flex items-center justify-center gap-3 group w-full sm:w-auto"
                                    >
                                        <ImageIcon size={20} className="group-hover:rotate-12 transition-transform"/> {primaryActionLabel}
                                    </button>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {features?.map((feat, i) => (
                                        <div key={i} className="px-4 py-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center gap-2 shadow-sm grow justify-center sm:grow-0">
                                            <Check size={14} className="text-green-500"/> {feat}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* DIREITA: VISUAL CONTEXTUAL (Dica Pro / Exemplo) */}
                    <div className="relative hidden lg:block animate-fade-in w-full max-w-lg mx-auto" style={{ animationDelay: '0.2s' }}>
                        {/* Decorative Backdrop */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-3xl -rotate-2 scale-105 blur-xl"></div>
                        
                        <div className="bg-white/80 backdrop-blur-xl border border-white/50 p-8 rounded-3xl shadow-2xl relative">
                            {secondaryAction ? secondaryAction : (
                                <div className="text-center space-y-4 py-10 opacity-50">
                                    <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-2xl mx-auto flex items-center justify-center">
                                        <Plus size={32} className="text-slate-300"/>
                                    </div>
                                    <p className="text-sm font-bold text-slate-400">Aguardando Input...</p>
                                </div>
                            )}
                            
                            {/* Technical Decoration Lines */}
                            <div className="absolute top-4 right-4 flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                            </div>
                            <div className="absolute bottom-4 left-4 text-[9px] font-mono text-slate-300">
                                AI_MODULE_READY // ID_294
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* RODAPÉ "PROPAGANDA TÉCNICA" (Ecosystem Strip) */}
            <div className="bg-white/90 backdrop-blur border-t border-slate-100 py-4 px-6 md:px-12 w-full z-20 shrink-0">
                <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-slate-400 shrink-0">
                        <Network size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Conectado aos Motores:</span>
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-end gap-6 md:gap-12 opacity-60 grayscale hover:grayscale-0 transition-all duration-500 w-full">
                        {partners ? partners.map((p, i) => (
                            <span key={i} className="text-xs font-bold text-slate-600 flex items-center gap-2 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> {p}
                            </span>
                        )) : (
                            <>
                                <span className="text-xs font-bold text-slate-600">GOOGLE GEMINI 2.5</span>
                                <span className="text-xs font-bold text-slate-600">PANTONE TCX</span>
                                <span className="text-xs font-bold text-slate-600">WGSN ANALYTICS</span>
                                <span className="text-xs font-bold text-slate-600">ADOBE STOCK API</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- MODAL FLUTUANTE DE COMPARAÇÃO "HUD PRO" ---
export const FloatingReference: React.FC<{ image: string, label?: string }> = ({ image, label = "Ref. Original" }) => {
    const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 350 }); 
    const [size, setSize] = useState({ w: 220, h: 280 }); // Estado para largura e altura
    const [isMinimized, setIsMinimized] = useState(false);
    const [opacity, setOpacity] = useState(1);
    
    const dragOffset = useRef({ x: 0, y: 0 });
    const isDragging = useRef(false);
    
    const resizeStart = useRef<{x:number, y:number, w:number, h:number} | null>(null);

    const handlePointerDown = (e: React.PointerEvent) => {
        // Prevent drag if clicking controls
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
        
        e.currentTarget.setPointerCapture(e.pointerId);
        isDragging.current = true;
        dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;
        setPosition({
            x: Math.max(0, Math.min(newX, window.innerWidth - size.w)),
            y: Math.max(0, Math.min(newY, window.innerHeight - 50))
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };
    
    // Resize Logic
    const handleResizeStart = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    };
    
    const handleResizeMove = (e: React.PointerEvent) => {
        if (!resizeStart.current) return;
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        setSize({
            w: Math.max(200, Math.min(600, resizeStart.current.w + dx)),
            h: Math.max(200, Math.min(800, resizeStart.current.h + dy))
        });
    };
    
    const handleResizeEnd = (e: React.PointerEvent) => {
        resizeStart.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    if (isMinimized) {
        return (
            <div 
                className="fixed bottom-24 right-4 bg-black/80 backdrop-blur text-white p-3 rounded-2xl shadow-2xl z-[100] cursor-pointer hover:scale-110 transition-transform animate-bounce-subtle border border-white/20 group"
                onClick={() => setIsMinimized(false)}
                title="Mostrar Referência"
            >
                <div className="relative">
                    <ImageIcon size={24} />
                    <span className="absolute top-0 right-0 w-2 h-2 bg-vingi-500 rounded-full shadow-[0_0_10px_#3b82f6]"></span>
                </div>
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-black/80 text-[10px] px-2 py-1 rounded text-white opacity-0 group-hover:opacity-100 whitespace-nowrap">
                    Mostrar Ref
                </div>
            </div>
        );
    }

    return (
        <div 
            className="fixed z-[90] bg-[#1a1a1a] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/10 overflow-hidden flex flex-col transition-all duration-75"
            style={{ left: position.x, top: position.y, width: size.w, height: size.h, opacity: Math.max(0.2, opacity) }}
        >
            {/* Header / Drag Handle */}
            <div 
                className="bg-black/90 h-8 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing select-none border-b border-white/5 shrink-0"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <span className="text-[9px] font-black text-white flex items-center gap-1.5 uppercase tracking-widest">
                    <Move size={10} className="text-vingi-500"/> {label}
                </span>
                <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                    <button onClick={() => setSize(s => ({...s, w: Math.min(600, s.w + 50), h: Math.min(800, s.h + 50)}))} className="text-gray-500 hover:text-white p-1 transition-colors"><Maximize2 size={10}/></button>
                    <button onClick={() => setIsMinimized(true)} className="text-gray-500 hover:text-white p-1 transition-colors"><Minimize2 size={10}/></button>
                </div>
            </div>

            {/* Image Viewer (Zoomable) */}
            <div className="relative bg-[#050505] group border-b border-white/5 flex-1 overflow-hidden">
                <SmartImageViewer src={image} className="bg-transparent" style={{ height: '100%' }} />
            </div>

            {/* Footer / Controls */}
            <div className="bg-[#111] p-2 flex items-center gap-3 shrink-0 relative">
                <div className="flex items-center gap-2 flex-1">
                    {opacity < 1 ? <EyeOff size={12} className="text-vingi-500"/> : <Eye size={12} className="text-gray-500"/>}
                    <input 
                        type="range" 
                        min="0.1" max="1" step="0.05" 
                        value={opacity} 
                        onChange={(e) => setOpacity(parseFloat(e.target.value))}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-vingi-500 outline-none"
                    />
                </div>
                <div className="text-[9px] font-mono text-gray-500 w-8 text-right">
                    {Math.round(opacity * 100)}%
                </div>
                
                {/* Resize Handle */}
                <div 
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 opacity-50 hover:opacity-100"
                    onPointerDown={handleResizeStart}
                    onPointerMove={handleResizeMove}
                    onPointerUp={handleResizeEnd}
                    onPointerCancel={handleResizeEnd}
                >
                    <div className="w-0 h-0 border-b-[6px] border-r-[6px] border-b-transparent border-r-gray-400 transform translate-x-[-2px] translate-y-[-2px]"></div>
                </div>
            </div>
        </div>
    );
};
