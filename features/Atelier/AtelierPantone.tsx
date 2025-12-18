
import React from 'react';
import { PantoneColor } from '../../types';
import { Pipette, Copy } from 'lucide-react';

export const AtelierPantone: React.FC<{ colors: PantoneColor[], onDelete: (i: number) => void }> = ({ colors, onDelete }) => {
    return (
        <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Pipette size={14} className="text-vingi-400"/> Colorimetria Industrial
            </h3>
            <div className="grid grid-cols-5 gap-2">
                {colors.map((c, i) => (
                    <div key={i} className="flex flex-col bg-[#111] border border-white/5 rounded-lg overflow-hidden group relative">
                        <div className="h-10 w-full" style={{ backgroundColor: c.hex }} />
                        <div className="p-1.5 bg-[#0a0a0a]">
                            <span className="block text-[8px] font-bold text-gray-500 truncate">{c.code}</span>
                        </div>
                        <button 
                            onClick={() => onDelete(i)}
                            className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] font-black uppercase"
                        >
                            Remover
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
