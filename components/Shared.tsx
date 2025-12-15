
import React, { useState, useRef } from 'react';
import { Move, ZoomIn, Minimize2, ImageIcon, RotateCcw, X, Info, Plus } from 'lucide-react';

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

// --- NOVO COMPONENTE DE LANDING PAGE PADRONIZADA ---
interface ModuleLandingPageProps {
    icon: React.ElementType;
    title: string;
    description: string;
    primaryActionLabel: string;
    onPrimaryAction: () => void;
    secondaryAction?: React.ReactNode; // Conteúdo da direita
    versionLabel?: string;
    features?: string[];
}

export const ModuleLandingPage: React.FC<ModuleLandingPageProps> = ({
    icon: Icon, title, description, primaryActionLabel, onPrimaryAction, secondaryAction, versionLabel = "VINGI SYSTEM v6.4", features
}) => {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center animate-fade-in pb-32 md:pb-0">
            <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col md:flex-row">
                {/* Lado Esquerdo: Ação Principal */}
                <div className="flex-1 p-8 md:p-12 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 relative">
                    <div className="absolute top-4 left-4 flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-400"></div>
                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    </div>

                    <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                        <Icon size={40} className="text-vingi-600" />
                    </div>
                    
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 tracking-tight">{title}</h2>
                    <p className="text-gray-500 text-sm md:text-base mb-8 max-w-md leading-relaxed mx-auto">
                        {description}
                    </p>
                    
                    <button 
                        onClick={onPrimaryAction} 
                        className="w-full max-w-xs py-4 bg-vingi-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-vingi-800 hover:scale-105 transition-all flex items-center justify-center gap-3"
                    >
                        <ImageIcon size={20} /> {primaryActionLabel}
                    </button>

                    <div className="mt-8 flex gap-4 text-gray-400">
                        {features?.map((feat, i) => (
                            <span key={i} className="text-[10px] uppercase font-bold tracking-widest bg-gray-50 px-2 py-1 rounded border border-gray-100">{feat}</span>
                        ))}
                    </div>

                    <span className="text-[10px] text-gray-300 mt-8 font-mono absolute bottom-4">{versionLabel}</span>
                </div>

                {/* Lado Direito: Secundário ou Decorativo */}
                <div className="w-full md:w-80 bg-gray-50 p-8 flex flex-col justify-center border-l border-gray-100">
                    {secondaryAction ? (
                        secondaryAction
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-50 space-y-4">
                            <div className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl"></div>
                            <div className="w-full h-20 border-2 border-dashed border-gray-300 rounded-xl"></div>
                            <span className="text-xs font-bold uppercase">Área de Trabalho</span>
                        </div>
                    )}
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
