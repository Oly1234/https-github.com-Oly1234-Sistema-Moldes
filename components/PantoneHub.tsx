
import React, { useState } from 'react';
import { Copy, Search, ExternalLink, X } from 'lucide-react';
import { PantoneColor } from '../types';

interface PantoneChipProps {
    color: PantoneColor;
    onDelete?: () => void;
    size?: 'sm' | 'md';
}

export const PantoneChip: React.FC<PantoneChipProps> = ({ color, onDelete, size = 'md' }) => {
    const [showMenu, setShowMenu] = useState(false);
    
    const handleCopyHex = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(color.hex);
        setShowMenu(false);
    };

    const handleSearchPantone = (e: React.MouseEvent) => {
        e.stopPropagation();
        const query = color.code ? color.code : `${color.name} Pantone`;
        window.open(`https://www.pantone.com/color-finder/${query.replace(/\s+/g, '-')}`, '_blank');
        setShowMenu(false);
    };

    const handleSearchGoogle = (e: React.MouseEvent) => {
        e.stopPropagation();
        const query = `${color.code || color.hex} textile color trend`;
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
        setShowMenu(false);
    };

    return (
        <div 
            onClick={() => setShowMenu(!showMenu)} 
            className={`flex flex-col bg-[#111] shadow-xl border border-white/5 rounded-xl overflow-hidden cursor-pointer group relative hover:scale-105 transition-all duration-300 ${size === 'sm' ? 'h-14 w-full' : 'h-16 w-full'}`}
        >
            <div className={`w-full relative ${size === 'sm' ? 'h-8' : 'h-9'}`} style={{ backgroundColor: color.hex }}>
                {onDelete && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                        className="absolute top-1 right-1 bg-black/40 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X size={8} />
                    </button>
                )}
            </div>
            <div className="flex-1 flex flex-col justify-center bg-[#1a1a1a] px-2 py-1">
                <span className="text-[8px] font-black text-white/90 truncate uppercase tracking-tighter">{color.name}</span>
                <span className="text-[7px] text-gray-500 font-mono truncate">{color.code || color.hex}</span>
            </div>

            {showMenu && (
                <div className="absolute inset-0 bg-black/95 backdrop-blur-md flex flex-col items-stretch justify-center p-1 gap-1 animate-fade-in z-50">
                    <button onClick={handleCopyHex} className="flex items-center justify-between px-2 py-1 hover:bg-white/10 rounded-md text-[7px] font-bold text-white uppercase tracking-tighter">
                        <span>HEX</span> <Copy size={8}/>
                    </button>
                    <button onClick={handleSearchGoogle} className="flex items-center justify-between px-2 py-1 hover:bg-blue-600/30 rounded-md text-[7px] font-bold text-blue-400 uppercase tracking-tighter">
                        <span>TENDÊNCIA</span> <Search size={8}/>
                    </button>
                    <button onClick={handleSearchPantone} className="flex items-center justify-between px-2 py-1 hover:bg-vingi-600/30 rounded-md text-[7px] font-bold text-vingi-400 uppercase tracking-tighter">
                        <span>PANTONE</span> <ExternalLink size={8}/>
                    </button>
                </div>
            )}
        </div>
    );
};

export const PantoneGrid: React.FC<{ colors: PantoneColor[], onDelete?: (index: number) => void, columns?: number }> = ({ colors, onDelete, columns = 4 }) => {
    if (!colors || colors.length === 0) return null;
    return (
        <div className={`grid grid-cols-${columns} gap-2`}>
            {colors.map((c, i) => (
                <PantoneChip key={i} color={c} onDelete={onDelete ? () => onDelete(i) : undefined} />
            ))}
        </div>
    );
};
