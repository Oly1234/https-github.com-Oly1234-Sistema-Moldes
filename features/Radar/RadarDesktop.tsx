
import React from 'react';
import { Globe, RefreshCw, ScanLine, Palette, Plus } from 'lucide-react';
import { PantoneColor, ExternalPatternMatch } from '../../types';
import { PatternVisualCard } from '../../components/PatternVisualCard';
import { SmartImageViewer, FloatingReference } from '../../components/Shared';

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

export const RadarDesktop: React.FC<RadarProps> = (props) => {
    return (
        <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar">
            {props.hasAnalyzed && <FloatingReference image={props.referenceImage} label="Referência" />}
            
            <div className="p-12 max-w-[1800px] mx-auto w-full">
                {!props.hasAnalyzed && !props.isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10">
                        <div className="w-80 h-80 rounded-[3rem] shadow-2xl border-[12px] border-white overflow-hidden rotate-3 hover:rotate-0 transition-all duration-700"><SmartImageViewer src={props.referenceImage} /></div>
                        <button onClick={props.onStartAnalysis} className="px-16 py-6 bg-vingi-900 text-white rounded-3xl font-black shadow-2xl hover:scale-105 transition-all flex items-center gap-5 text-sm uppercase tracking-[0.2em]"><ScanLine size={24}/> INICIAR PESQUISA MUNDIAL</button>
                    </div>
                ) : props.isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center h-[70vh]">
                        <div className="relative w-64 h-80 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white bg-slate-900">
                            <img src={props.referenceImage} className="w-full h-full object-cover opacity-60 blur-md" />
                            <div className="absolute top-0 left-0 w-full h-2 bg-vingi-400 shadow-[0_0_30px_rgba(96,165,250,1)] animate-scan"></div>
                        </div>
                        <h3 className="mt-12 text-lg font-black text-gray-800 uppercase tracking-[0.2em] animate-pulse">Varrendo Bancos Globais...</h3>
                    </div>
                ) : (
                    <div className="flex gap-12 animate-fade-in">
                        <div className="w-[380px] shrink-0 space-y-8">
                            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100 space-y-8 sticky top-12">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Palette size={14}/> Paleta Técnica</h4>
                                <div className="grid grid-cols-4 gap-2">
                                    {props.detectedColors.map((c, i) => (
                                        <div key={i} className="h-10 rounded-lg shadow-inner" style={{ backgroundColor: c.hex }} title={c.code} />
                                    ))}
                                </div>
                                <button onClick={props.onReset} className="w-full py-4 bg-gray-50 border border-gray-200 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all flex items-center justify-center gap-2">
                                    <RefreshCw size={14}/> Nova Pesquisa
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-2xl font-black text-gray-900 flex items-center gap-4 uppercase tracking-tighter"><Globe className="text-vingi-600" size={32}/> Marketplace Global</h3>
                            </div>
                            <div className="grid grid-cols-3 xl:grid-cols-4 gap-6">
                                {props.uniqueMatches.slice(0, props.visibleMatchesCount).map((match, i) => (
                                    <PatternVisualCard key={i} match={match} />
                                ))}
                            </div>
                            {props.visibleMatchesCount < props.uniqueMatches.length && (
                                <div className="mt-16 flex justify-center">
                                    <button onClick={() => props.setVisibleMatchesCount(p => p + 12)} className="px-12 py-5 bg-white border-2 border-gray-200 rounded-3xl font-black text-[11px] text-gray-500 uppercase tracking-widest hover:border-vingi-400 transition-all flex items-center gap-3 shadow-sm hover:shadow-lg">
                                        <Plus size={18}/> Carregar Mais Resultados
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
