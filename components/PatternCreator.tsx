
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Image as ImageIcon, Loader2, Sparkles, Layers, Grid3X3, Target, Globe, Move, ZoomIn, Minimize2, Plus, TrendingUp, Brush, Leaf, Droplets, ShoppingBag, Share2, Ruler, Scissors, ArrowDownToLine, ArrowRightToLine, LayoutTemplate, History as HistoryIcon, Trash2, Settings2, Check, Printer, Search, RefreshCw, XCircle, ScanLine, AlertCircle, Info, RotateCcw } from 'lucide-react';
import { PantoneColor, ExternalPatternMatch } from '../types';
import { PatternVisualCard } from './PatternVisualCard';
import { ModuleLandingPage, SmartImageViewer } from './Shared';
import { PantoneGrid } from './PantoneHub';

const LOADING_STEPS = [
    "Inicializando Visão Computacional...",
    "Isolando Motivos da Textura...",
    "Extraindo Paleta Pantone (TCX)...",
    "Detectando Padrão de Repetição...",
    "Varrendo Bancos de Imagem Globais...",
    "Classificando Por Similaridade...",
    "Finalizando Curadoria..."
];

interface PatternCreatorProps {
    onNavigateToAtelier: () => void;
}

const compressImage = (base64Str: string | null, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!base64Str) { reject(new Error("Imagem vazia")); return; }
        const img = new Image(); img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.drawImage(img, 0, 0, w, h); resolve(canvas.toDataURL('image/jpeg', 0.8)); }
            else reject(new Error("Canvas error"));
        };
        img.onerror = () => reject(new Error("Load error"));
    });
};

const SpecBadge: React.FC<{ icon: any, label: string, value: string }> = ({ icon: Icon, label, value }) => (
    <div className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-3 shadow-sm min-w-[140px]">
        <div className="p-2 bg-gray-50 rounded-lg text-vingi-500">
            <Icon size={16} />
        </div>
        <div>
            <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            <span className="block text-[11px] font-bold text-gray-800 capitalize line-clamp-1">{value || "N/A"}</span>
        </div>
    </div>
);

export const PatternCreator: React.FC<PatternCreatorProps> = ({ onNavigateToAtelier }) => {
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [detectedColors, setDetectedColors] = useState<PantoneColor[]>([]);
    const [fabricMatches, setFabricMatches] = useState<ExternalPatternMatch[]>([]);
    const [visibleMatchesCount, setVisibleMatchesCount] = useState(12); 
    const [technicalSpecs, setTechnicalSpecs] = useState<any>(null);
    const [genError, setGenError] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [hasAnalyzed, setHasAnalyzed] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0); 
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let interval: any;
        if (isAnalyzing) {
            setLoadingStep(0);
            interval = setInterval(() => { setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length); }, 1200);
        }
        return () => clearInterval(interval);
    }, [isAnalyzing]);

    const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const res = ev.target?.result as string;
                if (res) {
                    setReferenceImage(res);
                    setHasAnalyzed(false);
                    setFabricMatches([]); setDetectedColors([]); setTechnicalSpecs(null); setPrompt(''); setGenError(null);
                    setVisibleMatchesCount(12);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleStartAnalysis = async () => {
        if (!referenceImage) return;
        setIsAnalyzing(true);
        setGenError(null);
        try {
            const compressedBase64 = await compressImage(referenceImage);
            const data = compressedBase64.split(',')[1];
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'DESCRIBE_PATTERN', mainImageBase64: data, mainMimeType: 'image/jpeg' })
            });
            const resData = await response.json();
            if (resData.success) {
                setPrompt(resData.prompt || '');
                setDetectedColors(Array.isArray(resData.colors) ? resData.colors : []);
                setFabricMatches(Array.isArray(resData.stockMatches) ? resData.stockMatches : []);
                setTechnicalSpecs(resData.technicalSpecs || null);
                setHasAnalyzed(true);
            }
        } catch (error) { setGenError("Falha crítica no Radar Global."); } finally { setIsAnalyzing(false); }
    };

    const uniqueMatches = fabricMatches.filter((match, index, self) => index === self.findIndex((m) => (m.url === match.url)));
    const visibleData = uniqueMatches.slice(0, visibleMatchesCount);

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto overflow-x-hidden relative custom-scrollbar">
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm shrink-0">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <div className="flex items-center gap-2 justify-center">
                        <div className="bg-vingi-900 p-1.5 rounded text-white shadow-sm"><Globe size={14}/></div>
                        <h2 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">Radar Global de Estampas</h2>
                    </div>
                </div>
                <div className="ml-auto">
                    {referenceImage && !isAnalyzing && (
                        <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-vingi-600 bg-vingi-50 px-4 py-2 rounded-xl hover:bg-vingi-100 flex items-center gap-2 uppercase tracking-widest transition-all">
                            <RefreshCw size={12}/> Nova Textura
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
                <input type="file" ref={fileInputRef} onChange={handleReferenceUpload} accept="image/*" className="hidden" />
                
                {!referenceImage && (
                    <ModuleLandingPage icon={Globe} title="Radar de Estampas" description="Encontre fornecedores globais para qualquer textura ou padrão têxtil. A IA isola o motivo e varre bancos mundiais em segundos." primaryActionLabel="Escanear Textura" onPrimaryAction={() => fileInputRef.current?.click()} partners={["PATTERN BANK", "SPOONFLOWER", "ADOBE STOCK"]} />
                )}

                {referenceImage && (
                    <div className="w-full space-y-8 animate-fade-in">
                        {isAnalyzing ? (
                             <div className="flex flex-col items-center justify-center h-[60vh]">
                                <div className="relative w-56 h-72 rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white bg-slate-900">
                                    <img src={referenceImage} className="w-full h-full object-cover opacity-60 blur-sm" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-vingi-900/40 to-transparent"></div>
                                    <div className="absolute top-0 left-0 w-full h-1.5 bg-vingi-400 shadow-[0_0_20px_rgba(96,165,250,1)] animate-scan"></div>
                                </div>
                                <h3 className="mt-8 text-sm font-black text-gray-800 uppercase tracking-widest animate-pulse">{LOADING_STEPS[loadingStep]}</h3>
                             </div>
                        ) : !hasAnalyzed ? (
                             <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
                                 <div className="w-64 h-64 rounded-3xl shadow-2xl border-8 border-white overflow-hidden rotate-2 hover:rotate-0 transition-transform duration-500"><SmartImageViewer src={referenceImage} /></div>
                                 <button onClick={handleStartAnalysis} className="px-12 py-5 bg-vingi-900 text-white rounded-2xl font-black shadow-2xl hover:scale-105 transition-all flex items-center gap-4 text-sm uppercase tracking-widest animate-bounce-subtle"><ScanLine size={20}/> INICIAR PESQUISA MUNDIAL</button>
                             </div>
                        ) : (
                            <div className="flex flex-col lg:flex-row gap-10 animate-fade-in">
                                <div className="w-full lg:w-[340px] shrink-0 space-y-8">
                                    <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-gray-100">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Referência Ativa</h4>
                                        <div className="aspect-square rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 shadow-inner"><SmartImageViewer src={referenceImage} /></div>
                                        {technicalSpecs && (
                                            <div className="mt-6 space-y-3">
                                                <SpecBadge icon={Brush} label="Técnica" value={technicalSpecs.technique} />
                                                <SpecBadge icon={Leaf} label="Motivo Principal" value={technicalSpecs.motifs?.[0]} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-gray-100">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Paleta Pantone (TCX)</h4>
                                        <PantoneGrid colors={detectedColors} columns={4} />
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xl font-black text-gray-900 flex items-center gap-3 uppercase tracking-tighter">
                                            <Globe className="text-vingi-600" size={24}/> 
                                            Marketplace Global ({uniqueMatches.length})
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                                        {visibleData.map((match, i) => ( <PatternVisualCard key={i} match={match} /> ))}
                                    </div>
                                    {visibleMatchesCount < uniqueMatches.length && (
                                        <div className="mt-12 flex justify-center">
                                            <button onClick={() => setVisibleMatchesCount(p => p + 12)} className="px-10 py-4 bg-white border-2 border-gray-200 rounded-2xl font-black text-[11px] text-gray-500 uppercase tracking-widest hover:border-vingi-400 hover:text-vingi-600 transition-all shadow-sm">
                                                + Carregar Mais Resultados
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
