
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Image as ImageIcon, Loader2, Sparkles, Layers, Grid3X3, Target, Globe, Move, ZoomIn, Minimize2, Plus, TrendingUp, Brush, Leaf, Droplets, ShoppingBag, Share2, Ruler, Scissors, ArrowDownToLine, ArrowRightToLine, LayoutTemplate, History as HistoryIcon, Trash2, Settings2, Check, Printer, Search, RefreshCw, XCircle, ScanLine, AlertCircle, Info, RotateCcw } from 'lucide-react';
import { PantoneColor, ExternalPatternMatch } from '../types';
import { PatternVisualCard } from './PatternVisualCard';
import { ModuleLandingPage, SmartImageViewer, FloatingReference } from './Shared';
import { PantoneGrid } from './PantoneHub';

const LOADING_STEPS = [
    "Inicializando Motores Visuais Vingi...",
    "Isolando Motivos e Elementos Gráficos...",
    "Extraindo Paleta Pantone (TCX/TPG)...",
    "Mapeando Repetição e Rapport Industrial...",
    "Varrendo Bancos Globais (EUA, Europa, Ásia)...",
    "Filtrando Melhores Resultados por Similaridade...",
    "Gerando Biblioteca Técnica 4.0..."
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
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="p-2.5 bg-slate-50 rounded-xl text-vingi-600">
            <Icon size={20} />
        </div>
        <div>
            <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{label}</span>
            <span className="block text-xs font-bold text-slate-800 capitalize line-clamp-1">{value || "N/A"}</span>
        </div>
    </div>
);

export const PatternCreator: React.FC<PatternCreatorProps> = ({ onNavigateToAtelier }) => {
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [detectedColors, setDetectedColors] = useState<PantoneColor[]>([]);
    const [fabricMatches, setFabricMatches] = useState<ExternalPatternMatch[]>([]);
    const [visibleMatchesCount, setVisibleMatchesCount] = useState(16); 
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
            interval = setInterval(() => { setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length); }, 1400);
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
                    setVisibleMatchesCount(16);
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
            {hasAnalyzed && referenceImage && <FloatingReference image={referenceImage} label="Referência" />}

            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-[100] shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                     <div className="bg-vingi-900 p-2 rounded-lg text-white shadow-lg"><Globe size={18}/></div>
                     <h2 className="text-sm font-black text-gray-900 uppercase tracking-[0.2em]">Radar Global de Estampas</h2>
                </div>
                <div className="flex gap-3">
                    {referenceImage && (
                        <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-gray-500 bg-gray-50 px-5 py-2.5 rounded-xl hover:bg-gray-100 flex items-center gap-2 uppercase tracking-widest transition-all">
                            <RefreshCw size={14}/> Nova Textura
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 p-6 md:p-12 max-w-[1700px] mx-auto w-full pb-32">
                <input type="file" ref={fileInputRef} onChange={handleReferenceUpload} accept="image/*" className="hidden" />
                
                {!referenceImage && (
                    <ModuleLandingPage icon={Globe} title="Radar de Estampas" description="Localize fornecedores globais e arquivos de alta definição para qualquer estampa. A IA isola o motivo visual e varre bibliotecas mundiais em segundos." primaryActionLabel="Escanear Textura" onPrimaryAction={() => fileInputRef.current?.click()} partners={["PATTERN BANK", "SPOONFLOWER", "ADOBE STOCK", "SHUTTERSTOCK"]} />
                )}

                {referenceImage && (
                    <div className="w-full animate-fade-in">
                        {isAnalyzing ? (
                             <div className="flex flex-col items-center justify-center h-[70vh]">
                                <div className="relative w-64 h-80 rounded-[2.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.3)] border-8 border-white bg-slate-900 scale-110">
                                    <img src={referenceImage} className="w-full h-full object-cover opacity-60 blur-md" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-vingi-900/60 to-transparent"></div>
                                    <div className="absolute top-0 left-0 w-full h-2 bg-vingi-400 shadow-[0_0_30px_rgba(96,165,250,1)] animate-scan"></div>
                                </div>
                                <div className="mt-12 text-center space-y-3">
                                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-[0.2em] animate-pulse">{LOADING_STEPS[loadingStep]}</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Acessando servidores internacionais via Vingi Engine 6.5</p>
                                </div>
                             </div>
                        ) : !hasAnalyzed ? (
                             <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10">
                                 <div className="relative group">
                                     <div className="absolute inset-0 bg-vingi-500 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
                                     <div className="w-80 h-80 rounded-[3rem] shadow-2xl border-[12px] border-white overflow-hidden rotate-3 hover:rotate-0 transition-all duration-700 relative z-10">
                                         <SmartImageViewer src={referenceImage} />
                                     </div>
                                 </div>
                                 <div className="flex flex-col items-center gap-4">
                                     <button onClick={handleStartAnalysis} className="px-16 py-6 bg-vingi-900 text-white rounded-3xl font-black shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:scale-105 hover:bg-black transition-all flex items-center gap-5 text-sm uppercase tracking-[0.2em] animate-bounce-subtle">
                                        <ScanLine size={24}/> INICIAR VARREDURA MUNDIAL
                                     </button>
                                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Identificação completa de DNA, Pantone e Mercado</p>
                                 </div>
                             </div>
                        ) : (
                            <div className="flex flex-col xl:flex-row gap-12 animate-fade-in">
                                {/* Sidebar de Análise Técnica */}
                                <div className="w-full xl:w-[400px] shrink-0 space-y-8">
                                    <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100 space-y-8">
                                        <div>
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Target size={14}/> DNA Estrutural</h4>
                                            <div className="grid gap-4">
                                                {technicalSpecs && (
                                                    <>
                                                        <SpecBadge icon={Brush} label="Técnica Dominante" value={technicalSpecs.technique} />
                                                        <SpecBadge icon={Leaf} label="Motivo Principal" value={technicalSpecs.motifs?.[0]} />
                                                        <SpecBadge icon={Grid3X3} label="Padrão de Rapport" value={technicalSpecs.layout} />
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-8 border-t border-gray-100">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Palette size={14}/> Paleta Técnica (TCX)</h4>
                                            <PantoneGrid colors={detectedColors} columns={4} />
                                        </div>

                                        <div className="pt-8 border-t border-gray-100 space-y-4">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14}/> Ações Inteligentes</h4>
                                            <button 
                                                onClick={onNavigateToAtelier}
                                                className="w-full py-5 bg-vingi-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-vingi-500 transition-all flex items-center justify-center gap-3 shadow-lg shadow-vingi-600/20"
                                            >
                                                <Palette size={16}/> Abrir no Estúdio IA
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Resultados de Mercado */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                                        <div>
                                            <h3 className="text-2xl font-black text-gray-900 flex items-center gap-4 uppercase tracking-tighter">
                                                <Globe className="text-vingi-600" size={32}/> 
                                                Marketplace Global
                                            </h3>
                                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Exibindo as melhores correspondências em bancos mundiais</p>
                                        </div>
                                        <div className="bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                                            <span className="text-[10px] font-black text-gray-400 uppercase">Filtro:</span>
                                            <span className="text-[10px] font-black text-vingi-600 uppercase">Similaridade Visual</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                                        {visibleData.map((match, i) => ( 
                                            <PatternVisualCard key={i} match={match} /> 
                                        ))}
                                    </div>

                                    {visibleMatchesCount < uniqueMatches.length && (
                                        <div className="mt-16 flex justify-center">
                                            <button onClick={() => setVisibleMatchesCount(p => p + 16)} className="px-12 py-5 bg-white border-2 border-gray-200 rounded-3xl font-black text-[11px] text-gray-500 uppercase tracking-widest hover:border-vingi-400 hover:text-vingi-600 transition-all shadow-sm flex items-center gap-3 group">
                                                <Plus size={18} className="group-hover:rotate-90 transition-transform"/> Carregar Mais Resultados (+16)
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
