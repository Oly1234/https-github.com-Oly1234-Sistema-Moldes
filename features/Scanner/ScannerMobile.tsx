
import React from 'react';
import { ScanLine, Loader2, RefreshCw } from 'lucide-react';
import { PatternAnalysisResult } from '../../types';
import { PatternVisualCard } from '../../components/PatternVisualCard';

interface ScannerProps {
    uploadedImage: string;
    result: PatternAnalysisResult | null;
    isAnalyzing: boolean;
    onStart: () => void;
    onReset: () => void;
}

export const ScannerMobile: React.FC<ScannerProps> = ({ uploadedImage, result, isAnalyzing, onStart, onReset }) => {
    return (
        <div className="flex-1 flex flex-col bg-[#f8fafc] overflow-hidden">
            <div className="h-[40vh] relative bg-white border-b border-gray-100 flex items-center justify-center p-4">
                <img src={uploadedImage} className={`max-h-full object-contain transition-all duration-700 ${isAnalyzing ? 'blur-sm grayscale opacity-50' : ''}`} />
                {isAnalyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Loader2 size={40} className="text-vingi-900 animate-spin mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-800">Analisando Molde...</span>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 pb-32">
                {!result && !isAnalyzing ? (
                    <div className="flex flex-col gap-6 items-center pt-10">
                        <button onClick={onStart} className="w-full py-5 bg-vingi-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl active:scale-95">Iniciar Engenharia Reversa</button>
                    </div>
                ) : result ? (
                    <div className="space-y-8 animate-fade-in">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 leading-tight">{result.patternName}</h2>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">{result.category}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {result.matches.exact.map((match, i) => (
                                <PatternVisualCard key={i} match={match} />
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>

            {result && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
                    <button onClick={onReset} className="bg-white border-2 border-gray-100 text-gray-800 px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl flex items-center gap-2"><RefreshCw size={14}/> Novo Scan</button>
                </div>
            )}
        </div>
    );
};
