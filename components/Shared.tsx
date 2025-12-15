
import React, { useState, useRef } from 'react';
import { Move, ZoomIn, Minimize2, ImageIcon, RotateCcw, X, Info } from 'lucide-react';

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
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 z-40 shadow-sm relative">
            <div className="flex items-center gap-3">
                <div className="bg-vingi-900 p-2 rounded-lg text-white shadow-md">
                    <Icon size={18}/>
                </div>
                <div>
                    <h1 className="text-sm font-bold text-gray-900 leading-tight uppercase tracking-wide">{title}</h1>
                    {subtitle && <p className="text-[10px] text-gray-500 font-medium">{subtitle}</p>}
                </div>
            </div>

            <div className="flex items-center gap-3">
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
                        <X size={12}/> {actionLabel}
                    </button>
                )}
            </div>
        </header>
    );
};

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
