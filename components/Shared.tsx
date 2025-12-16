
import React, { useState, useRef } from 'react';
import { Move, ZoomIn, Minimize2, ImageIcon, RotateCcw, X, Info, Plus, Globe, Cpu, Database, Network, Check } from 'lucide-react';

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

// --- MODAL FLUTUANTE DE COMPARAÇÃO ---
export const FloatingReference: React.FC<{ image: string, label?: string }> = ({ image, label = "Referência" }) => {
    const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 250 }); 
    const [size, setSize] = useState(160);
    const [isMinimized, setIsMinimized] = useState(false);
    
    const dragOffset = useRef({ x: 0, y: 0 });
    const isDragging = useRef(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        isDragging.current = true;
        dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;
        setPosition({
            x: Math.max(0, Math.min(newX, window.innerWidth - size)),
            y: Math.max(0, Math.min(newY, window.innerHeight - 50))
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    if (isMinimized) {
        return (
            <div 
                className="fixed bottom-20 right-4 bg-vingi-900 text-white p-3 rounded-full shadow-2xl z-[100] cursor-pointer hover:scale-110 transition-transform animate-bounce-subtle border-2 border-white"
                onClick={() => setIsMinimized(false)}
                title="Mostrar Referência"
            >
                <ImageIcon size={20} />
            </div>
        );
    }

    return (
        <div 
            className="fixed z-[90] bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.3)] border border-gray-200 overflow-hidden flex flex-col transition-shadow"
            style={{ left: position.x, top: position.y, width: size, touchAction: 'none' }}
        >
            <div 
                className="bg-gray-900 h-8 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing select-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <span className="text-[9px] font-bold text-white flex items-center gap-1 uppercase tracking-wider">
                    <Move size={10} className="text-gray-400"/> {label}
                </span>
                <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                    <button onClick={() => setSize(s => Math.min(400, s + 40))} className="text-gray-400 hover:text-white p-1"><ZoomIn size={12}/></button>
                    <button onClick={() => setIsMinimized(true)} className="text-gray-400 hover:text-white p-1"><Minimize2 size={12}/></button>
                </div>
            </div>
            <div className="relative bg-gray-50 group border-t border-gray-800">
                <img src={image} className="w-full object-contain pointer-events-none select-none" />
                <div className="absolute inset-0 shadow-inner pointer-events-none"></div>
            </div>
        </div>
    );
};
