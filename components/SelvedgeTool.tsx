
import React, { useRef, useState } from 'react';
import { ArrowDownToLine, MousePointerClick } from 'lucide-react';

export type SelvedgePosition = 'Inferior' | 'Superior' | 'Esquerda' | 'Direita';

interface SelvedgeToolProps {
    image: string;
    selectedPos: SelvedgePosition;
    onSelect: (pos: SelvedgePosition) => void;
    active: boolean; // Se a ferramenta está habilitada (ex: só para layout Barrado)
}

export const SelvedgeTool: React.FC<SelvedgeToolProps> = ({ image, selectedPos, onSelect, active }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const [clickCoords, setClickCoords] = useState<{x: number, y: number} | null>(null);

    const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        if (!active || !imgRef.current) return;
        
        const rect = imgRef.current.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const w = rect.width;
        const h = rect.height;

        // Visual Feedback do clique
        setClickCoords({ x, y });

        // Calcular distância para cada borda
        const distTop = y;
        const distBottom = h - y;
        const distLeft = x;
        const distRight = w - x;

        const minDist = Math.min(distTop, distBottom, distLeft, distRight);

        if (minDist === distBottom) onSelect('Inferior');
        else if (minDist === distTop) onSelect('Superior');
        else if (minDist === distLeft) onSelect('Esquerda');
        else if (minDist === distRight) onSelect('Direita');
    };

    // Estilos dinâmicos para a linha da ourela
    const getBorderStyle = () => {
        if (!active) return '';
        switch (selectedPos) {
            case 'Inferior': return 'border-b-4 border-vingi-500';
            case 'Superior': return 'border-t-4 border-vingi-500';
            case 'Esquerda': return 'border-l-4 border-vingi-500';
            case 'Direita': return 'border-r-4 border-vingi-500';
            default: return '';
        }
    };

    const getLabelStyle = () => {
        switch (selectedPos) {
            case 'Inferior': return 'bottom-2 left-1/2 -translate-x-1/2';
            case 'Superior': return 'top-2 left-1/2 -translate-x-1/2';
            case 'Esquerda': return 'left-2 top-1/2 -translate-y-1/2 -rotate-90 origin-center';
            case 'Direita': return 'right-2 top-1/2 -translate-y-1/2 rotate-90 origin-center';
        }
    };

    return (
        <div className={`relative rounded-lg overflow-hidden bg-gray-100 border-2 select-none group ${active ? 'border-vingi-200 cursor-crosshair hover:border-vingi-400' : 'border-gray-200 opacity-50 cursor-not-allowed'}`}>
            <div 
                className={`absolute inset-0 pointer-events-none transition-all duration-300 z-10 ${getBorderStyle()}`}
            />
            
            <img 
                ref={imgRef}
                src={image} 
                className="w-full h-48 md:h-64 object-contain mx-auto"
                onClick={handleInteraction}
                onTouchStart={handleInteraction}
                alt="Referência para Ourela"
            />

            {/* Overlay de Instrução (Só aparece se ainda não interagiu ou hover) */}
            {active && (
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
                        <MousePointerClick size={12}/> Clique na borda da ourela
                    </span>
                </div>
            )}

            {/* Indicador de Ourela (Rótulo) */}
            {active && (
                <div className={`absolute z-20 bg-vingi-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1 animate-fade-in ${getLabelStyle()}`}>
                    <ArrowDownToLine size={12} className={selectedPos === 'Superior' ? 'rotate-180' : selectedPos === 'Esquerda' ? 'rotate-90' : selectedPos === 'Direita' ? '-rotate-90' : ''}/>
                    OURELA DETECTADA
                </div>
            )}
        </div>
    );
};
