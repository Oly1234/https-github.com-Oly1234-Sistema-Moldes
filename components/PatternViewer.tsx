import React from 'react';
import { PatternPiece, LineArt } from '../types';
import { Download, Layers } from 'lucide-react';

interface PatternViewerProps {
  pieces?: PatternPiece[];
  lineArt?: LineArt; // Mantido na prop caso precise no futuro, mas não usado visualmente
  category: string;
  onDownload?: () => void;
}

export const PatternViewer: React.FC<PatternViewerProps> = ({ pieces, category, onDownload }) => {
  // Removido estado de viewMode, agora é fixo em 'cutlayout'
  const safePieces = pieces && pieces.length > 0 ? pieces : [];

  // Dimensões virtuais para o SVG
  const SHEET_WIDTH = 1000;
  const PIECE_SPACING = 300;
  const totalWidth = Math.max(SHEET_WIDTH, safePieces.length * PIECE_SPACING);

  return (
    <div className="w-full h-full bg-white flex flex-col font-sans border-r border-gray-200">
      
      {/* Header da Ferramenta */}
      <div className="h-14 border-b border-gray-200 flex justify-between items-center px-6 bg-white shrink-0">
        <div className="flex gap-4">
            <div className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg bg-vingi-900 text-white transition-all">
                <Layers size={14} /> MOLDES SUGESTIVOS
            </div>
        </div>
        
        {onDownload && (
          <button 
            onClick={onDownload} 
            className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors flex gap-2 items-center font-medium"
          >
            <Download size={14} /> EXPORTAR
          </button>
        )}
      </div>

      {/* Área de Visualização */}
      <div className="flex-1 overflow-auto bg-[#f0f2f5] relative flex justify-center">
        
        {/* Grid de Fundo Técnico */}
        <div className="absolute inset-0 pointer-events-none opacity-20" 
             style={{
                 backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)',
                 backgroundSize: '40px 40px'
             }}
        />

        <div className="relative bg-white shadow-2xl my-8 min-h-[500px] w-[90%] max-w-[1200px] overflow-hidden border border-gray-200 rounded-lg">
            
            <div className="h-full w-full flex flex-col">
                <div className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Geometria de Corte (Sugestão Anatômica)</h3>
                    <span className="text-xs font-mono text-gray-400">{safePieces.length} PARTES</span>
                </div>
                <div className="flex-1 overflow-x-auto overflow-y-hidden">
                    <svg 
                        viewBox={`0 0 ${totalWidth} 600`} 
                        className="h-full w-auto min-w-full"
                        preserveAspectRatio="xMidYMid meet"
                    >
                        {safePieces.map((piece, index) => {
                            const offsetX = index * PIECE_SPACING;
                            return (
                            <g key={index} transform={`translate(${offsetX + 100}, 100)`}>
                                {/* Sombra suave */}
                                <path 
                                  d={piece.path} 
                                  fill="none" 
                                  stroke="black" 
                                  strokeWidth="0"
                                  filter="drop-shadow(3px 5px 2px rgb(0 0 0 / 0.1))"
                                  transform="translate(2, 2)"
                                />
                                
                                {/* Molde com preenchimento de papel */}
                                <path 
                                d={piece.path} 
                                fill="#fffcf5" 
                                stroke="#1e293b" 
                                strokeWidth="2.5" 
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                                />
                                
                                {/* Labels */}
                                <g transform="translate(0, 350)">
                                    <text x="0" y="0" fontSize="16" fontFamily="Arial" fontWeight="bold" fill="#1e293b" textAnchor="middle">
                                        {piece.name.toUpperCase()}
                                    </text>
                                    <text x="0" y="25" fontSize="12" fontFamily="Arial" fill="#64748b" textAnchor="middle">
                                        {piece.quantity}x ({piece.cutType})
                                    </text>
                                </g>

                                {/* Fio do Tecido (Seta dupla) */}
                                <line x1="0" y1="50" x2="0" y2="250" stroke="#ef4444" strokeWidth="1" strokeDasharray="6,4" />
                                <path d="M -5 60 L 0 50 L 5 60" fill="none" stroke="#ef4444" strokeWidth="1"/>
                                <path d="M -5 240 L 0 250 L 5 240" fill="none" stroke="#ef4444" strokeWidth="1"/>
                            </g>
                            );
                        })}
                    </svg>
                </div>
            </div>
            
        </div>
      </div>
    </div>
  );
};