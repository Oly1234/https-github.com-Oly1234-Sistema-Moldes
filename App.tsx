
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MockupStudio } from './components/MockupStudio'; 
import { PatternCreator } from './components/PatternCreator'; 
import { analyzeClothingImage } from './services/geminiService';
import { AppState, PatternAnalysisResult, ExternalPatternMatch, CuratedCollection, ViewState, ScanHistoryItem } from './types';
import { MOCK_LOADING_STEPS } from './constants';
import { UploadCloud, RefreshCw, ExternalLink, Search, Image as ImageIcon, CheckCircle2, Globe, Layers, Sparkles, Share2, ArrowRightCircle, ShoppingBag, BookOpen, Star, Camera, DollarSign, Gift, ChevronUp, ChevronDown, History, Clock, Smartphone, X, Zap, Plus, Eye, DownloadCloud, Loader2, Database, Terminal, Maximize2, Minimize2, AlertTriangle, CloudOff, Info, Share, MessageCircle, Key, ShieldCheck, Lock, GripHorizontal } from 'lucide-react';

const APP_VERSION = '5.7.3-GOLD'; 

// ... Utility functions mantidas ...
const getBrandIcon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
const compressImage = (base64Str: string, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
    });
};
const generateSafeUrl = (match: ExternalPatternMatch): string => {
    const { url, source, patternName } = match;
    const lowerSource = source.toLowerCase();
    const lowerUrl = url.toLowerCase();
    const cleanSearchTerm = encodeURIComponent(patternName.replace(/ pattern| sewing| molde| vestido| dress| pdf| download/gi, '').trim());
    const fullSearchTerm = encodeURIComponent(patternName + ' sewing pattern');
    const isGenericLink = url.split('/').length < 4 && !url.includes('search');
    if (lowerSource.includes('etsy') || lowerUrl.includes('etsy.com')) {
        if (lowerUrl.includes('/search')) return url;
        return `https://www.etsy.com/search?q=${fullSearchTerm}&explicit=1&ship_to=BR`;
    }
    if (lowerSource.includes('burda') || lowerUrl.includes('burdastyle')) {
         if (lowerUrl.includes('catalogsearch')) return url;
        return `https://www.burdastyle.com/catalogsearch/result/?q=${cleanSearchTerm}`;
    }
    if (lowerSource.includes('mood') || lowerUrl.includes('moodfabrics')) {
        return `https://www.moodfabrics.com/blog/?s=${cleanSearchTerm}`;
    }
    if (isGenericLink) {
         return `https://www.google.com/search?q=${fullSearchTerm}+site:${lowerSource}`;
    }
    return url;
};

// ... Components ...
const PatternVisualCard: React.FC<{ match: ExternalPatternMatch; safeUrl: string }> = ({ match, safeUrl }) => {
    // Lógica para recuperar o ícone da marca se não houver imagem
    let domain = '';
    try { domain = new URL(match.url).hostname; } catch (e) { domain = 'google.com'; }
    const iconUrl = match.imageUrl || getBrandIcon(domain);

    return (
        <div onClick={() => window.open(safeUrl, '_blank')} className="bg-white rounded-xl border border-gray-200 hover:shadow-xl cursor-pointer transition-all hover:-translate-y-1 group overflow-hidden flex flex-col h-full">
            {/* ÁREA VISUAL RICA (ICONE/IMAGEM) - RESTAURADO */}
            <div className="h-32 bg-gray-50 overflow-hidden relative border-b border-gray-100 p-4 flex items-center justify-center">
                <img 
                    src={iconUrl} 
                    alt={match.source} 
                    className="w-16 h-16 object-contain mix-blend-multiply group-hover:scale-110 transition-transform" 
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/3389/3389081.png'; }}
                />
                <div className="absolute top-2 right-2">
                    <ExternalLink size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"/>
                </div>
            </div>

            <div className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{match.source}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${match.type === 'PAGO' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                        {match.type}
                    </span>
                </div>
                <h3 className="font-bold text-sm text-gray-800 line-clamp-2 leading-tight mb-2 flex-1">{match.patternName}</h3>
                <div className="text-xs text-vingi-500 font-medium flex items-center gap-1 group-hover:underline">
                    Ver Molde <ArrowRightCircle size={10}/>
                </div>
            </div>
        </div>
    );
};

const ExternalSearchButton = ({ name, url, colorClass, icon: Icon }: any) => (
    <a href={url} target="_blank" className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-white transition-transform hover:scale-105 ${colorClass}`}>
        <Icon size={12} /> {name}
    </a>
);
const FilterTab = ({ label, count, active, onClick, icon: Icon }: any) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-colors ${active ? 'bg-vingi-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
        {label} <span className="opacity-70">{count}</span>
    </button>
);
const InstallGatekeeper: React.FC<{ onInstall: () => void, isIOS: boolean }> = ({ onInstall, isIOS }) => (
    <div className="fixed inset-0 bg-vingi-900 flex items-center justify-center text-white z-[999]">
        <div className="text-center">
            <h1 className="text-2xl font-bold">Instale o App</h1>
            <button onClick={onInstall} className="mt-4 px-6 py-3 bg-white text-vingi-900 rounded-xl font-bold">Instalar</button>
        </div>
    </div>
);

export default function App() {
  const [view, setView] = useState<ViewState>('HOME'); 
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<PatternAnalysisResult | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedSecondaryImage, setUploadedSecondaryImage] = useState<string | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  
  const [generatedPatternForStudio, setGeneratedPatternForStudio] = useState<string | null>(null);
  
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'EXACT' | 'CLOSE' | 'VIBE'>('ALL');
  const [visibleCount, setVisibleCount] = useState(12);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryCameraInputRef = useRef<HTMLInputElement>(null);

  const handlePatternGenerated = (url: string) => {
      setGeneratedPatternForStudio(url);
      setView('MOCKUP');
  };

  useEffect(() => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const mobile = /iphone|ipad|ipod|android/i.test(userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      setIsMobileBrowser(mobile && !isStandalone);
      setIsIOS(/iphone|ipad|ipod/.test(userAgent));

      const storedHistory = localStorage.getItem('vingi_scan_history');
      if (storedHistory) setHistory(JSON.parse(storedHistory));
      
      const handleBeforeInstallPrompt = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Efeito para rotacionar mensagens de loading
  useEffect(() => {
    let interval: any;
    if (state === AppState.ANALYZING) {
        setLoadingStep(0);
        interval = setInterval(() => {
            setLoadingStep(prev => (prev + 1) % MOCK_LOADING_STEPS.length);
        }, 2000);
    }
    return () => clearInterval(interval);
  }, [state]);

  const handleInstallClick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsMobileBrowser(false);
      setDeferredPrompt(null);
  };

  const handleFabAction = () => {
    if (state === AppState.ANALYZING) return;
    if (state === AppState.SUCCESS || state === AppState.ERROR) { resetApp(); setView('HOME'); return; }
    if (state === AppState.IDLE && uploadedImage) { startAnalysis(); return; }
    if (state === AppState.IDLE && !uploadedImage) { setView('HOME'); setTimeout(() => cameraInputRef.current?.click(), 50); }
  };

  const addToHistory = (res: PatternAnalysisResult) => {
      const newItem: ScanHistoryItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          patternName: res.patternName,
          category: res.category,
          dnaSummary: `${res.technicalDna.silhouette}, ${res.technicalDna.neckline}`
      };
      const updatedHistory = [newItem, ...history].slice(50);
      setHistory(updatedHistory);
      localStorage.setItem('vingi_scan_history', JSON.stringify(updatedHistory));
  };

  const handleMainUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onload = (e) => {setUploadedImage(e.target?.result as string);}; reader.readAsDataURL(file); }
  };

  const handleSecondaryUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onload = (e) => setUploadedSecondaryImage(e.target?.result as string); reader.readAsDataURL(file); }
  };

  const startAnalysis = async () => {
    if (!uploadedImage) return;
    
    // Inicia estado de análise
    setState(AppState.ANALYZING); 
    setErrorMsg(null); 
    setVisibleCount(12);
    
    // Timestamp de início para calcular o tempo mínimo de loading
    const startTime = Date.now();
    const MIN_LOADING_TIME = 3000; // 3 segundos para a animação "correr"

    // Pequeno delay inicial para renderizar a UI de loading
    setTimeout(async () => {
        try {
            const compressedMain = await compressImage(uploadedImage);
            const mainBase64 = compressedMain.split(',')[1];
            const mainType = compressedMain.split(';')[0].split(':')[1];
            
            let secondaryBase64: string | null = null;
            let secondaryType: string | null = null;
            
            if (uploadedSecondaryImage) {
                const compressedSec = await compressImage(uploadedSecondaryImage);
                secondaryBase64 = compressedSec.split(',')[1];
                secondaryType = compressedSec.split(';')[0].split(':')[1];
            }
            
            // Chama a API
            const analysisResult = await analyzeClothingImage(mainBase64, mainType, secondaryBase64, secondaryType);
            
            // Calcula quanto tempo passou
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

            // Espera o tempo restante se a API foi muito rápida
            setTimeout(() => {
                setResult(analysisResult); 
                addToHistory(analysisResult); 
                setState(AppState.SUCCESS);
            }, remainingTime);

        } catch (err: any) { 
            setErrorMsg(err.message || "Erro desconhecido na análise."); 
            setState(AppState.ERROR); 
        }
    }, 100); 
  };
  
  const handleLoadMore = () => setVisibleCount(prev => prev + 12);
  const resetApp = () => { setState(AppState.IDLE); setResult(null); setUploadedImage(null); setUploadedSecondaryImage(null); setActiveTab('ALL'); setVisibleCount(12); setErrorMsg(null); };

  const exactMatches = result?.matches?.exact || [];
  const closeMatches = result?.matches?.close || [];
  const vibeMatches = result?.matches?.adventurous || [];
  const allMatches = [...exactMatches, ...closeMatches, ...vibeMatches].sort((a, b) => b.similarityScore - a.similarityScore);
  const getFilteredMatches = () => { switch(activeTab) { case 'EXACT': return exactMatches; case 'CLOSE': return closeMatches; case 'VIBE': return vibeMatches; default: return allMatches; } };
  const visibleData = getFilteredMatches().slice(0, visibleCount);
  const hasMoreItems = visibleCount < getFilteredMatches().length;
  const strictQuery = result ? `${result.technicalDna.silhouette} ${result.technicalDna.neckline} pattern` : '';

  if (isMobileBrowser) return <InstallGatekeeper onInstall={handleInstallClick} isIOS={isIOS} />;

  const renderHistoryView = () => (
      <div className="p-6 max-w-5xl mx-auto min-h-full">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3"><History size={28} className="text-vingi-600"/> Histórico</h2>
          {history.length === 0 ? (<div className="text-center text-gray-400 mt-20">Sem histórico recente.</div>) : (
              <div className="grid gap-4">
                  {history.map(item => (
                      <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between">
                          <div><span className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleDateString()}</span><h4 className="font-bold">{item.patternName}</h4></div>
                      </div>
                  ))}
                  <button onClick={() => { localStorage.removeItem('vingi_scan_history'); setHistory([]); }} className="text-red-500 text-xs font-bold mt-4">Limpar Histórico</button>
              </div>
          )}
      </div>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-[#f8fafc] text-gray-800 font-sans overflow-hidden fixed inset-0">
      <Sidebar 
        currentView={view} 
        appState={state}
        hasUploadedImage={!!uploadedImage}
        onViewChange={setView} 
        onInstallClick={handleInstallClick}
        showInstallButton={!!deferredPrompt && !isMobileBrowser}
        onFabClick={handleFabAction}
      />
      
      <main ref={mainScrollRef} className="flex-1 md:ml-20 h-full overflow-y-auto overflow-x-hidden relative touch-pan-y scroll-smooth">
        {view === 'MOCKUP' && <MockupStudio externalPattern={generatedPatternForStudio} />}
        {view === 'CREATOR' && <PatternCreator onPatternGenerated={handlePatternGenerated} />}
        {view === 'HISTORY' && renderHistoryView()}
        
        {view === 'HOME' && (
            <>
            {state !== AppState.ANALYZING && state !== AppState.ERROR && (
                <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200 px-6 py-4 flex justify-between items-center transition-all shadow-sm">
                    <h1 className="text-lg font-bold tracking-tight text-vingi-900">VINGI <span className="text-vingi-500">AI</span></h1>
                    {state === AppState.SUCCESS && <button onClick={resetApp} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><RefreshCw size={18}/></button>}
                </header>
            )}

            <div className="max-w-[1600px] mx-auto p-4 md:p-8 min-h-full flex flex-col">
            
            {state === AppState.IDLE && (
                <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center animate-fade-in pb-32 md:pb-0 relative">
                
                <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden flex flex-col md:flex-row relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-vingi-500 to-purple-500"></div>
                    
                    {/* PRIMARY UPLOAD AREA */}
                    <div className="flex-1 p-8 md:p-12 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 bg-gradient-to-b from-white to-slate-50/50">
                        <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                            <UploadCloud size={40} className="text-vingi-600" />
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Análise Visual 3D</h2>
                        <p className="text-slate-500 text-sm mb-10 max-w-xs leading-relaxed">Carregue a foto da peça para análise de DNA técnico e busca global de moldes.</p>

                        <input type="file" ref={fileInputRef} onChange={handleMainUpload} accept="image/*" className="hidden" />
                        <input type="file" ref={cameraInputRef} onChange={handleMainUpload} accept="image/*" capture="environment" className="hidden" />

                        {!uploadedImage ? (
                            <div className="flex gap-4 w-full max-w-xs flex-col md:flex-row">
                                <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-4 bg-vingi-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-300 hover:bg-vingi-800 active:scale-95 transition-all flex items-center justify-center gap-3">
                                    <ImageIcon size={18} /> Galeria
                                </button>
                                {/* Câmera visível APENAS em Mobile/Tablet (Telas menores) */}
                                <button onClick={() => cameraInputRef.current?.click()} className="md:hidden py-4 px-6 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold shadow-sm hover:bg-slate-50 active:scale-95 transition-all">
                                    <Camera size={20} />
                                </button>
                            </div>
                        ) : (
                            <div className="w-full max-w-sm relative group">
                                <div className="absolute inset-0 bg-black/10 rounded-xl"></div>
                                <img src={uploadedImage} alt="Preview" className="w-full h-64 object-cover rounded-xl shadow-lg" />
                                <button onClick={() => setUploadedImage(null)} className="absolute top-3 right-3 p-2 bg-white/90 text-slate-900 rounded-full hover:bg-red-50 hover:text-red-500 shadow transition-all"><X size={16} /></button>
                                <div className="absolute bottom-3 left-3 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow"><CheckCircle2 size={10}/> IMAGEM OK</div>
                            </div>
                        )}
                    </div>

                    {/* SECONDARY UPLOAD AREA */}
                    <div className="w-full md:w-96 bg-slate-50 p-8 md:p-12 flex flex-col justify-center border-l border-white">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Opcional</h3>
                        </div>
                        
                        <div className="mb-8">
                            <label className="block text-sm font-bold text-slate-700 mb-3">Ângulo Secundário</label>
                            <input type="file" ref={secondaryInputRef} onChange={handleSecondaryUpload} accept="image/*" className="hidden" />
                            <input type="file" ref={secondaryCameraInputRef} onChange={handleSecondaryUpload} accept="image/*" capture="environment" className="hidden" />
                            
                            {!uploadedSecondaryImage ? (
                                <div className="flex gap-2">
                                     <button onClick={() => secondaryInputRef.current?.click()} className="flex-1 h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:bg-white hover:border-slate-400 transition-all bg-white/50 gap-2">
                                        <Plus size={24} className="opacity-50" /><span className="text-xs font-medium">Galeria</span>
                                     </button>
                                     <button onClick={() => secondaryCameraInputRef.current?.click()} className="md:hidden w-16 h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:bg-white bg-white/50">
                                        <Camera size={20} className="opacity-50" />
                                     </button>
                                </div>
                            ) : (
                                <div className="relative group w-full h-32">
                                    <img src={uploadedSecondaryImage} alt="Sec" className="w-full h-full object-cover rounded-xl shadow-sm" />
                                    <button onClick={() => setUploadedSecondaryImage(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"><X size={12} /></button>
                                </div>
                            )}
                        </div>
                        
                        <button onClick={startAnalysis} disabled={!uploadedImage} className={`hidden md:flex w-full py-4 rounded-xl font-bold text-sm shadow-lg items-center justify-center gap-2 transition-all ${uploadedImage ? 'bg-vingi-900 text-white hover:bg-vingi-800 transform hover:-translate-y-1' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                            <Sparkles size={16} /> INICIAR VARREDURA
                        </button>
                    </div>
                </div>
                <div className="mt-8 text-slate-300 text-[10px] font-mono">{APP_VERSION} • ENGINE V5</div>
                </div>
            )}
            
            {state === AppState.ANALYZING && (
                <div className="flex flex-col items-center justify-center h-[90vh] w-full p-6">
                     <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl border-4 border-white ring-1 ring-slate-200 bg-slate-900">
                        {/* Imagem do Usuário de Fundo */}
                        <img src={uploadedImage || ''} className="w-full h-full object-cover opacity-60 blur-[2px]" />
                        
                        {/* Overlay Grade Técnica */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,100,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,100,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

                        {/* Linha de Scanner - Reforçada para visibilidade */}
                        <div className="absolute top-0 left-0 w-full h-2 bg-vingi-400 shadow-[0_0_20px_rgba(96,165,250,1),0_0_10px_rgba(255,255,255,0.8)] animate-scan z-30 opacity-90"></div>
                     </div>
                     
                     <div className="mt-8 text-center max-w-xs mx-auto">
                        <h3 className="text-xl font-bold text-slate-800 tracking-tight animate-pulse min-h-[3rem] flex items-center justify-center">
                            {MOCK_LOADING_STEPS[loadingStep]}
                        </h3>
                        <div className="flex justify-center items-center gap-2 text-vingi-500 font-mono text-xs mt-2 uppercase tracking-widest">
                            <Loader2 size={12} className="animate-spin"/>
                            Processando DNA
                        </div>
                     </div>
                </div>
            )}
            
            {state === AppState.ERROR && (
                <div className="flex flex-col items-center justify-center h-[70vh] text-center max-w-lg mx-auto">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                        <AlertTriangle size={32} className="text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-slate-900">Falha na Análise</h3>
                    <p className="text-slate-500 mb-8">{errorMsg}</p>
                    <div className="flex gap-4 w-full">
                        <button onClick={resetApp} className="flex-1 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50">Cancelar</button>
                        <button onClick={startAnalysis} className="flex-1 py-3 bg-vingi-900 text-white rounded-xl font-bold hover:bg-vingi-800 shadow-lg shadow-vingi-200">Tentar Novamente</button>
                    </div>
                </div>
            )}

            {state === AppState.SUCCESS && result && (
                <div className="animate-fade-in space-y-8 pb-20">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 flex flex-col md:flex-row gap-6 items-start">
                         {uploadedImage && <img src={uploadedImage} className="w-24 h-32 object-cover rounded-lg shadow-md border border-slate-100" />}
                         <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Identificado</span>
                             </div>
                             <h2 className="text-2xl font-bold text-slate-900 mb-2">{result.patternName}</h2>
                             <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                                <span className="bg-slate-50 px-3 py-1 rounded-full border border-slate-200 font-medium">{result.technicalDna.silhouette}</span>
                                <span className="bg-slate-50 px-3 py-1 rounded-full border border-slate-200 font-medium">{result.technicalDna.neckline}</span>
                             </div>
                         </div>
                    </div>

                    <div className="flex items-center justify-between">
                         <h3 className="text-lg font-bold text-slate-800">Resultados da Busca</h3>
                         <div className="flex gap-2">
                            <FilterTab label="Todos" count={allMatches.length} active={activeTab === 'ALL'} onClick={() => setActiveTab('ALL')} icon={Layers} />
                            <FilterTab label="Exatos" count={exactMatches.length} active={activeTab === 'EXACT'} onClick={() => setActiveTab('EXACT')} icon={CheckCircle2} />
                            <FilterTab label="Vibe" count={vibeMatches.length} active={activeTab === 'VIBE'} onClick={() => setActiveTab('VIBE')} icon={Sparkles} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {visibleData.map((match, i) => (
                            <PatternVisualCard key={i} match={match} safeUrl={generateSafeUrl(match)} />
                        ))}
                    </div>
                    
                    {hasMoreItems && (
                        <div className="mt-8 flex justify-center">
                            <button onClick={handleLoadMore} className="px-8 py-3 bg-white border border-slate-300 text-slate-600 rounded-xl font-bold shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-all">
                                Carregar Mais
                            </button>
                        </div>
                    )}

                    {/* SEÇÃO DE LINKS SUGESTIVOS (RESTAURADO) */}
                    {result.curatedCollections && result.curatedCollections.length > 0 && (
                        <div className="mt-12 bg-gray-50 rounded-2xl p-6 border border-gray-100">
                             <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><BookOpen size={20} className="text-vingi-600"/> Coleções Sugestivas</h3>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {result.curatedCollections.map((coll, i) => (
                                    <a key={i} href={coll.searchUrl} target="_blank" className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-all flex flex-col group">
                                        <div className="flex justify-between mb-2">
                                            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">{coll.sourceName}</span>
                                            <ExternalLink size={14} className="text-gray-300 group-hover:text-gray-600"/>
                                        </div>
                                        <h4 className="font-bold text-gray-800 mb-1">{coll.title}</h4>
                                        <p className="text-xs text-gray-500 line-clamp-2">{coll.description}</p>
                                        <div className="mt-3 text-xs font-medium text-gray-400">{coll.itemCount}</div>
                                    </a>
                                ))}
                             </div>
                        </div>
                    )}

                </div>
            )}
            </div>
            </>
        )}
      </main>
    </div>
  );
}
