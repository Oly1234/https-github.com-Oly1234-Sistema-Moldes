
import React from 'react';
import { Globe, ScanLine, Palette, ChevronRight } from 'lucide-react';
import { PantoneColor, ExternalPatternMatch } from '../../types';
import { PatternVisualCard } from '../../components/PatternVisualCard';

interface RadarProps {
    referenceImage: string;
    isAnalyzing: boolean;
    hasAnalyzed: boolean;
    detectedColors: PantoneColor[];
    uniqueMatches: ExternalPatternMatch[];
    visibleMatchesCount: number;
    setVisibleMatchesCount: React.Dispatch<React.SetStateAction<number>>;
    onStartAnalysis: () => void;
    onReset: () => void;
}

export const RadarMobile: React.FC<RadarProps> = (props) => {
    return (
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <div className="h-[35vh] relative shrink-0 border-b border-gray-100 flex items-center justify-center p-4 bg-slate-50">
                <img src={props.referenceImage} className={`max-h-full rounded-2xl shadow-xl transition-all duration-700 ${props.isAnalyzing ? 'blur-md opacity-50 scale-90' : ''}`} />
                {props.isAnalyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-vingi-600 border-t-transparent rounded-full animate-spin mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-vingi-900">IA Vasculhando...</span>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
                {!props.hasAnalyzed && !props.isAnalyzing ? (
                    <div className="flex flex-col gap-6 items-center pt-6">
                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 w-full">
                            <p className="text-xs font-bold text-blue-800 leading-relaxed">O Radar irá buscar essa textura em 50+ bancos de imagens mundiais.</p>
                        </div>
                        <button onClick={props.onStartAnalysis} className="w-full py-5 bg-vingi-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl active:scale-95 flex items-center justify-center gap-3">
                            <Globe size={20}/> Buscar Estampa Real
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 flex items-center gap-2">
                                <Palette size={16} className="text-vingi-500"/> Paleta Digital
                            </h3>
                            <span className="text-[10px] font-bold text-gray-400">{props.detectedColors.length} CORES</span>
                        </div>
                        <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2">
                            {props.detectedColors.map((c, i) => (
                                <div key={i} className="w-12 h-12 rounded-xl shrink-0 shadow-sm border border-black/5" style={{ backgroundColor: c.hex }} />
                            ))}
                        </div>

                        <div className="h-px bg-gray-100" />

                        <div className="grid grid-cols-2 gap-3">
                            {props.uniqueMatches.slice(0, props.visibleMatchesCount).map((match, i) => (
                                <PatternVisualCard key={i} match={match} />
                            ))}
                        </div>

                        {props.visibleMatchesCount < props.uniqueMatches.length && (
                            <button onClick={() => props.setVisibleMatchesCount(p => p + 6)} className="w-full py-4 bg-gray-50 border border-gray-200 text-gray-500 rounded-xl font-bold text-xs uppercase tracking-widest active:bg-gray-100">
                                Ver mais resultados
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
