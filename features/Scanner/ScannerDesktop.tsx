
import React from 'react';
import { ScanLine, Scissors, Shirt, Ruler, Move, Layers, Info } from 'lucide-react';
import { PatternAnalysisResult } from '../../types';
import { PatternVisualCard } from '../../components/PatternVisualCard';
import { FloatingReference } from '../../components/Shared';

interface ScannerProps {
    uploadedImage: string;
    result: PatternAnalysisResult | null;
    isAnalyzing: boolean;
    onStart: () => void;
    onReset: () => void;
}

const SpecBadge = ({ label, value, icon: Icon }: any) => (
    <div className="flex flex-col bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
            <Icon size={14} /> {label}
        </span>
        <span className="text-sm font-bold text-gray-800 capitalize">{value || "N/A"}</span>
    </div>
);

export const ScannerDesktop: React.FC<ScannerProps> = ({ uploadedImage, result, isAnalyzing, onStart, onReset }) => {
    return (
        <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto">
            {result && <FloatingReference image={uploadedImage} />}
            
            <div className="p-12 max-w-[1600px] mx-auto w-full">
                {!result && !isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
                        <img src={uploadedImage} className="w-80 h-96 object-contain rounded-3xl shadow-2xl bg-white border-8 border-white" />
                        <button onClick={onStart} className="px-12 py-5 bg-vingi-900 text-white rounded-2xl font-black shadow-xl hover:scale-105 transition-all flex items-center gap-4 text-lg">
                            <ScanLine size={24}/> INICIAR VARREDURA TÉCNICA
                        </button>
                    </div>
                ) : isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center h-[60vh]">
                        <div className="relative w-64 h-80 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white bg-slate-900">
                            <img src={uploadedImage} className="w-full h-full object-cover opacity-60 blur-md" />
                            <div className="absolute top-0 left-0 w-full h-2 bg-vingi-400 shadow-[0_0_30px_rgba(96,165,250,1)] animate-scan"></div>
                        </div>
                        <h3 className="mt-12 text-lg font-black text-gray-800 uppercase tracking-[0.2em] animate-pulse">Extraindo DNA do Molde...</h3>
                    </div>
                ) : (
                    <div className="flex gap-12 animate-fade-in">
                        <div className="w-[350px] shrink-0 space-y-6">
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 space-y-6 sticky top-12">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Info size={16}/> Especificações</h4>
                                <SpecBadge label="Silhueta" value={result?.technicalDna.silhouette} icon={Scissors} />
                                <SpecBadge label="Decote" value={result?.technicalDna.neckline} icon={Shirt} />
                                <SpecBadge label="Ajuste" value={result?.technicalDna.fit} icon={Move} />
                                <SpecBadge label="Tecido" value={result?.technicalDna.fabric} icon={Layers} />
                            </div>
                        </div>

                        <div className="flex-1">
                            <h2 className="text-3xl font-black text-gray-900 mb-2">{result?.patternName}</h2>
                            <p className="text-gray-500 mb-10 font-medium">Modelagem industrial detectada com base na análise geométrica.</p>
                            <div className="grid grid-cols-3 xl:grid-cols-4 gap-6">
                                {result?.matches.exact.map((match, i) => (
                                    <PatternVisualCard key={i} match={match} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
