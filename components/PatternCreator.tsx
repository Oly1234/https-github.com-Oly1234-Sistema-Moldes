
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

const ExternalSearchButton = ({ name, url, colorClass, icon: Icon }: any) => (
    <a href={url} target="_blank" className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-white transition-transform hover:scale-105 ${colorClass}`}>
        <Icon size={12} /> {name}
    </a>
);

const SpecBadge: React.FC<{ icon: any, label: string, value: string }> = ({ icon: Icon, label, value }) => (
    <div className="bg-white border border-gray-100 rounded-lg p-2 flex items-center gap-2 shadow-sm min-w-[100px]">
        <div className="p-1.5 bg-gray-50 rounded-full text-vingi-500">
            <Icon size={12} />
        </div>
        <div>
            <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
            <span className="block text-[10px] font-bold text-gray-800 capitalize line-clamp-1">{value || "N/A"}</span>
        </div>
    </div>
);

export const PatternCreator: React.FC<PatternCreatorProps> = ({ onNavigateToAtelier }) => {
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [detectedColors, setDetectedColors] = useState<PantoneColor[]>([]);
    const [fabricMatches, setFabricMatches] = useState<ExternalPatternMatch[]>([]);
    const [visibleMatchesCount, setVisibleMatchesCount] = useState(10); 
    const [technicalSpecs, setTechnicalSpecs] = useState<any>(null);
    const [genError, setGenError] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
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
                    setFabricMatches([]); setDetectedColors([]); setTechnicalSpecs(null); setPrompt(''); setGenError(null);
                    setVisibleMatchesCount(10);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleStartAnalysis = async () => {
        if (!referenceImage) return;
        setIsAnalyzing(true);
        setGenError(null);
        setVisibleMatchesCount(10);
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
            }
        } catch (error) { setGenError("Não foi possível analisar a textura."); } finally { setIsAnalyzing(false); }
    };

    const uniqueMatches = fabricMatches.filter((match, index, self) => index === self.findIndex((m) => (m.url === match.url)));
    const visibleData = uniqueMatches.slice(0, visibleMatchesCount);
    const hasResults = uniqueMatches.length > 0 || technicalSpecs;

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto overflow-x-hidden relative custom-scrollbar">
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm shrink-0">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <div className="flex items-center gap-2 justify-center">
                        <div className="bg-vingi-900 p-1.5 rounded text-white shadow-sm"><Globe size={14}/></div>
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Radar Global de Estampas</h2>
                    </div>
                </div>
                <div className="ml-auto">
                    {referenceImage && !isAnalyzing && (
                        <button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-vingi-600 bg-vingi-50 px-3 py-1.5 rounded-lg hover:bg-vingi-100 flex items-center gap-2">
                            <RefreshCw size={12}/> Nova Imagem
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 p-4 md:p-8 max-w-[1800px] mx-auto w-full">
                <input type="file" ref={fileInputRef} onChange={handleReferenceUpload} accept="image/*" className="hidden" />
                
                {!referenceImage && (
                    <ModuleLandingPage icon={Globe} title="Radar de Estampas" description="Encontre fornecedores globais para qualquer estampa. A IA identifica o padrão e busca em bancos mundiais." primaryActionLabel="Escanear Textura" onPrimaryAction={() => fileInputRef.current?.click()} partners={["SHUTTERSTOCK", "ADOBE STOCK", "PATTERNBANK"]} />
                )}

                {referenceImage && (
                    <div className="w-full space-y-8">
                        {isAnalyzing ? (
                             <div className="flex flex-col items-center justify-center h-[50vh] animate-fade-in">
                                <div className="relative w-48 h-64 rounded-2xl overflow-hidden shadow-2xl border-4 border-white bg-slate-900">
                                    <img src={referenceImage} className="w-full h-full object-cover opacity-60 blur-[2px]" />
                                    <div className="absolute top-0 left-0 w-full h-1 bg-vingi-400 shadow-[0_0_20px_rgba(96,165,250,1)] animate-scan"></div>
                                </div>
                                <h3 className="mt-6 text-sm font-bold text-gray-800 animate-pulse">{LOADING_STEPS[loadingStep]}</h3>
                             </div>
                        ) : !hasResults && !genError ? (
                             <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6">
                                 <div className="w-48 h-48 rounded-2xl shadow-lg border-4 border-white overflow-hidden"><SmartImageViewer src={referenceImage} /></div>
                                 <button onClick={handleStartAnalysis} className="px-8 py-4 bg-vingi-900 text-white rounded-full font-bold shadow-xl hover:scale-105 transition-all flex items-center gap-2 animate-bounce-subtle"><ScanLine size={18}/> PESQUISAR ESTAMPAS</button>
                             </div>
                        ) : (
                            <div className="animate-fade-in flex flex-col lg:flex-row gap-8">
                                <div className="w-full lg:w-80 shrink-0 space-y-6">
                                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Referência Ativa</h4>
                                        <div className="aspect-square rounded-xl overflow-hidden border border-gray-100 bg-gray-50"><SmartImageViewer src={referenceImage} /></div>
                                        {technicalSpecs && (
                                            <div className="mt-4 space-y-2">
                                                <SpecBadge icon={Brush} label="Estilo" value={technicalSpecs.technique} />
                                                <SpecBadge icon={Leaf} label="Motivo" value={technicalSpecs.motifs?.[0]} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Paleta de Alma</h4>
                                        <PantoneGrid colors={detectedColors} columns={4} />
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Globe className="text-vingi-600" size={18}/> Resultados de Mercado</h3></div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {visibleData.map((match, i) => ( <PatternVisualCard key={i} match={match} /> ))}
                                    </div>
                                    {visibleMatchesCount < uniqueMatches.length && (
                                        <div className="mt-8 flex justify-center"><button onClick={() => setVisibleMatchesCount(p => p + 10)} className="px-8 py-3 bg-white border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all">+ Carregar Mais Resultados</button></div>
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
