
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MockupStudio } from './components/MockupStudio'; 
import { analyzeClothingImage } from './services/geminiService';
import { AppState, PatternAnalysisResult, ExternalPatternMatch, CuratedCollection, ViewState, ScanHistoryItem } from './types';
import { MOCK_LOADING_STEPS } from './constants';
import { UploadCloud, RefreshCw, ExternalLink, Search, Image as ImageIcon, CheckCircle2, Globe, Layers, Sparkles, Share2, ArrowRightCircle, ShoppingBag, BookOpen, Star, Camera, DollarSign, Gift, ChevronUp, ChevronDown, History, Clock, Smartphone, X, Zap, Plus, Eye, DownloadCloud, Loader2, Database, Terminal, Maximize2, Minimize2, AlertTriangle, CloudOff, Info, Share, MessageCircle, Key, ShieldCheck, Lock, GripHorizontal } from 'lucide-react';

// --- VERSÃO DO SISTEMA ---
const APP_VERSION = '6.1-PREVIEW-MECHANISM'; 

// --- UTILITÁRIOS ---
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

// --- COMPONENTES VISUAIS RICOS (RESTAURADOS COM MECANISMO DE PREVIEW) ---

const PatternVisualCard: React.FC<{ match: ExternalPatternMatch; safeUrl: string }> = ({ match, safeUrl }) => {
    // Estado local para a imagem (começa com o ícone, tenta baixar a real)
    const [displayImage, setDisplayImage] = useState<string | null>(match.imageUrl || null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    
    let domain = '';
    try { domain = new URL(safeUrl).hostname; } catch (e) { domain = 'google.com'; }
    const brandIcon = getBrandIcon(domain);

    // EFEITO: Mecanismo de "Baixar e Mostrar"
    useEffect(() => {
        // Se já temos uma imagem boa (não vazia e não igual ao ícone básico), não faz nada
        if (match.imageUrl && match.imageUrl.length > 50) return;

        // Se é uma URL de busca genérica, geralmente não tem imagem de capa boa, evitamos gastar recurso
        if (safeUrl.includes('/search') || safeUrl.includes('google.com')) return;

        let isMounted = true;
        setLoadingPreview(true);

        // Chama o backend para fazer o trabalho sujo (download do site)
        fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'GET_LINK_PREVIEW', targetUrl: safeUrl })
        })
        .then(res => res.json())
        .then(data => {
            if (isMounted && data.success && data.image) {
                setDisplayImage(data.image); // Atualiza com a imagem baixada (Base64)
            }
        })
        .catch(err => console.log("Preview fail:", err))
        .finally(() => {
            if (isMounted) setLoadingPreview(false);
        });

        return () => { isMounted = false; };
    }, [safeUrl, match.imageUrl]);

    const finalImage = displayImage || brandIcon;
    const isBrandIcon = finalImage === brandIcon;

    return (
        <div onClick={() => window.open(safeUrl, '_blank')} className="bg-white rounded-xl border border-gray-200 hover:shadow-xl cursor-pointer transition-all hover:-translate-y-1 group overflow-hidden flex flex-col h-full animate-fade-in">
            {/* ÁREA VISUAL RICA */}
            <div className={`overflow-hidden relative border-b border-gray-100 flex items-center justify-center ${isBrandIcon ? 'h-24 bg-gray-50 p-4' : 'h-48 bg-white'}`}>
                
                {/* Loader do mecanismo */}
                {loadingPreview && (
                    <div className="absolute top-2 left-2 z-20">
                        <div className="w-4 h-4 border-2 border-vingi-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
                
                <img 
                    src={finalImage} 
                    alt={match.source} 
                    className={`transition-transform duration-500 ${isBrandIcon ? 'w-16 h-16 object-contain mix-blend-multiply opacity-80' : 'w-full h-full object-cover group-hover:scale-105'}`}
                    onError={(e) => { (e.target as HTMLImageElement).src = brandIcon; setDisplayImage(brandIcon); }}
                />
                
                <div className="absolute top-2 right-2 z-20">
                    <ExternalLink size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 bg-white/80 p-0.5 rounded shadow-sm"/>
                </div>
            </div>

            <div className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate max-w-[70%]">{match.source}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${match.type === 'PAGO' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                        {match.type}
                    </span>
                </div>
                <h3 className="font-bold text-sm text-gray-800 line-clamp-2 leading-tight mb-2 flex-1 group-hover:text-vingi-600 transition-colors">{match.patternName}</h3>
                
                <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-xs text-vingi-500 font-medium">
                    <span>Ver Molde</span>
                    <ArrowRightCircle size={14} className="group-hover:translate-x-1 transition-transform"/>
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
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${active ? 'bg-vingi-900 text-white shadow-md transform scale-105' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
        {label} <span className="opacity-70 text-[10px] ml-1 bg-white/20 px-1.5 rounded-full">{count}</span>
    </button>
);

const InstallGatekeeper: React.FC<{ onInstall: () => void, isIOS: boolean }> = ({ onInstall, isIOS }) => (
    <div className="fixed inset-0 bg-vingi-900 flex items-center justify-center text-white z-[999]">
        <div className="text-center p-6">
            <h1 className="text-2xl font-bold mb-2">Instale o Vingi AI</h1>
            <p className="text-gray-400 mb-6 text-sm">Acesso total à biblioteca de moldes</p>
            <button onClick={onInstall} className="px-8 py-3 bg-white text-vingi-900 rounded-xl font-bold shadow-xl active:scale-95 transition-transform">Instalar Agora</button>
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
  
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'EXACT' | 'CLOSE' | 'VIBE'>('ALL');
  const [visibleCount, setVisibleCount] = useState(12);

  // PWA State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryCameraInputRef = useRef<HTMLInputElement>(null);

  // --- AUTO-UPDATE LOGIC ---
  useEffect(() => {
    const checkUpdate = async () => {
        try {
            const storedVersion = localStorage.getItem('vingi_app_version');
            if (storedVersion !== APP_VERSION) {
                if ('caches' in window) {
                   const names = await caches.keys();
                   await Promise.all(names.map(name => caches.delete(name)));
                }
                if ('serviceWorker' in navigator) {
                   const regs = await navigator.serviceWorker.getRegistrations();
                   for(let reg of regs) await reg.unregister();
                }
                localStorage.setItem('vingi_app_version', APP_VERSION);
                window.location.reload();
            }
        } catch (e) {}
    };
    setTimeout(checkUpdate, 1000);
  }, []);

  useLayoutEffect(() => {
    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [state, view]); 

  // Loading Rotation
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

  useEffect(() => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const mobile = /iphone|ipad|ipod|android/i.test(userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      setIsMobileBrowser(mobile && !isStandalone);
      setIsIOS(/iphone|ipad|ipod/.test(userAgent));

      const storedHistory = localStorage.getItem('vingi_scan_history');
      if (storedHistory) setHistory(JSON.parse(storedHistory));
      
      const handleBeforeInstallPrompt = (e: any) => {
          e.preventDefault();
          setDeferredPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsMobileBrowser(false);
      setDeferredPrompt(null);
  };

  const handleFabAction = () => {
    if (state === AppState.ANALYZING) return;
    if (state === AppState.SUCCESS || state === AppState.ERROR) {
        resetApp();
        setView('HOME');
        return;
    }
    if (state === AppState.IDLE && uploadedImage) {
        startAnalysis();
        return;
    }
    if (state === AppState.IDLE && !uploadedImage) {
        setView('HOME');
        setTimeout(() => cameraInputRef.current?.click(), 50);
    }
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
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => setUploadedImage(e.target?.result as string);
        reader.readAsDataURL(file);
    }
  };

  const handleSecondaryUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => setUploadedSecondaryImage(e.target?.result as string);
        reader.readAsDataURL(file);
    }
  };

  const startAnalysis = async () => {
    if (!uploadedImage) return;
    setState(AppState.ANALYZING);
    setErrorMsg(null);
    setVisibleCount(12); // Reset para mostrar os primeiros 12 itens
    
    // Pequeno atraso para a UI de loading renderizar antes do processamento pesado
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

            const analysisResult = await analyzeClothingImage(mainBase64, mainType, secondaryBase64, secondaryType);
            setResult(analysisResult);
            addToHistory(analysisResult);
            setState(AppState.SUCCESS);

        } catch (err: any) {
            setErrorMsg(err.message || "Erro desconhecido na análise.");
            setState(AppState.ERROR);
        }
    }, 500); 
  };
  
  const handleLoadMore = () => setVisibleCount(prev => prev + 12);

  const resetApp = () => {
    setState(AppState.IDLE);
    setResult(null);
    setUploadedImage(null);
    setUploadedSecondaryImage(null);
    setActiveTab('ALL');
    setVisibleCount(12);
    setErrorMsg(null);
  };

  const exactMatches = result?.matches?.exact || [];
  const closeMatches = result?.matches?.close || [];
  const vibeMatches = result?.matches?.adventurous || [];
  const allMatches = [...exactMatches, ...closeMatches, ...vibeMatches].sort((a, b) => b.similarityScore - a.similarityScore);

  const getFilteredMatches = () => {
      switch(activeTab) {
          case 'EXACT': return exactMatches;
          case 'CLOSE': return closeMatches;
          case 'VIBE': return vibeMatches;
          default: return allMatches;
      }
  };

  const visibleData = getFilteredMatches().slice(0, visibleCount);
  const hasMoreItems = visibleCount < getFilteredMatches().length;
  
  const strictQuery = result ? `${result.technicalDna.silhouette} ${result.technicalDna.neckline} pattern` : '';

  if (isMobileBrowser) return <InstallGatekeeper onInstall={handleInstallClick} isIOS={isIOS} />;

  // --- RENDERIZADORES DE VIEW ---

  const renderHistoryView = () => (
      <div className="p-6 max-w-5xl mx-auto min-h-full">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <History size={28} className="text-vingi-600"/> Histórico
          </h2>
          {history.length === 0 ? (
              <div className="text-center text-gray-400 mt-20">Sem histórico recente.</div>
          ) : (
              <div className="grid gap-4">
                  {history.map(item => (
                      <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between">
                          <div>
                            <span className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleDateString()}</span>
                            <h4 className="font-bold">{item.patternName}</h4>
                          </div>
                      </div>
                  ))}
                  <button onClick={() => { localStorage.removeItem('vingi_scan_history'); setHistory([]); }} className="text-red-500 text-xs font-bold mt-4">Limpar</button>
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
      
      <main 
        ref={mainScrollRef}
        className="flex-1 md:ml-20 h-full overflow-y-auto overflow-x-hidden relative touch-pan-y scroll-smooth"
      >
        {view === 'MOCKUP' && <MockupStudio />}
        
        {view === 'HISTORY' && renderHistoryView()}
        
        {view === 'HOME' && (
            <>
            {state !== AppState.ANALYZING && state !== AppState.ERROR && (
                <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex justify-between items-center transition-all shadow-sm">
                    <h1 className="text-lg font-bold tracking-tight text-vingi-900">VINGI <span className="text-vingi-500">AI</span></h1>
                    {state === AppState.SUCCESS && (
                        <button onClick={resetApp} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><RefreshCw size={18}/></button>
                    )}
                </header>
            )}

            <div className="max-w-[1800px] mx-auto p-4 md:p-6 min-h-full flex flex-col">
            
            {/* TELA INICIAL / UPLOAD */}
            {state === AppState.IDLE && (
                <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center animate-fade-in pb-32 md:pb-0">
                <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col md:flex-row">
                    <div className="flex-1 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100">
                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                            <UploadCloud size={32} className="text-vingi-600" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-3">Análise Visual 3D</h2>
                        <p className="text-gray-500 text-sm mb-8 max-w-xs leading-relaxed">Carregue a foto da peça para análise de DNA técnico e busca global de moldes.</p>

                        <input type="file" ref={fileInputRef} onChange={handleMainUpload} accept="image/*" className="hidden" />
                        <input type="file" ref={cameraInputRef} onChange={handleMainUpload} accept="image/*" capture="environment" className="hidden" />

                        {!uploadedImage ? (
                            <div className="flex gap-4 w-full max-w-xs flex-col md:flex-row">
                                <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-4 bg-vingi-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-vingi-800 transition-all flex items-center justify-center gap-2">
                                    <ImageIcon size={18} /> Galeria
                                </button>
                                <button onClick={() => cameraInputRef.current?.click()} className="md:hidden py-4 px-6 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">
                                    <Camera size={20} />
                                </button>
                            </div>
                        ) : (
                            <div className="w-full max-w-sm relative group">
                                <img src={uploadedImage} alt="Preview" className="w-full h-64 object-cover rounded-xl shadow-md" />
                                <button onClick={() => setUploadedImage(null)} className="absolute top-3 right-3 p-2 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"><X size={16} /></button>
                                <div className="absolute bottom-3 left-3 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow"><CheckCircle2 size={10} className="inline mr-1"/> IMAGEM OK</div>
                            </div>
                        )}
                        <span className="text-[10px] text-gray-300 mt-6 font-mono">{APP_VERSION}</span>
                    </div>

                    <div className="w-full md:w-80 bg-gray-50 p-8 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Opcional</h3>
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Ângulo Secundário</label>
                            <input type="file" ref={secondaryInputRef} onChange={handleSecondaryUpload} accept="image/*" className="hidden" />
                            {!uploadedSecondaryImage ? (
                                <button onClick={() => secondaryInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-white hover:border-vingi-400 transition-all gap-2"><Plus size={24} className="opacity-50" /><span className="text-xs">Galeria</span></button>
                            ) : (
                                <div className="relative group w-full h-32">
                                    <img src={uploadedSecondaryImage} alt="Sec" className="w-full h-full object-cover rounded-xl" />
                                    <button onClick={() => setUploadedSecondaryImage(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full"><X size={14} /></button>
                                </div>
                            )}
                        </div>
                        <button onClick={startAnalysis} disabled={!uploadedImage} className={`hidden md:flex w-full py-4 rounded-xl font-bold text-sm shadow-lg items-center justify-center gap-2 transition-all ${uploadedImage ? 'bg-vingi-900 text-white hover:bg-vingi-800 transform hover:-translate-y-1' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                            <Sparkles size={16} /> INICIAR VARREDURA
                        </button>
                    </div>
                </div>
                </div>
            )}
            
            {/* TELA DE LOADING COM SCANNER (MECANISMO VISUAL RESTAURADO) */}
            {state === AppState.ANALYZING && (
                <div className="flex flex-col items-center justify-center h-[90vh] w-full p-6 animate-fade-in">
                     <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl border-4 border-white ring-1 ring-slate-200 bg-slate-900">
                        {/* Imagem do Usuário de Fundo (Blur suave) */}
                        <img src={uploadedImage || ''} className="w-full h-full object-cover opacity-60 blur-[2px]" />
                        
                        {/* Overlay Grade Técnica (Grid) */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,100,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,100,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

                        {/* LINHA DE SCANNER (Animação Restaurada) */}
                        <div className="absolute top-0 left-0 w-full h-2 bg-vingi-400 shadow-[0_0_20px_rgba(96,165,250,1),0_0_10px_rgba(255,255,255,0.8)] animate-scan z-30 opacity-90"></div>
                     </div>
                     
                     <div className="mt-8 text-center max-w-xs mx-auto">
                        <h3 className="text-xl font-bold text-gray-800 tracking-tight animate-pulse min-h-[3rem] flex items-center justify-center">
                            {MOCK_LOADING_STEPS[loadingStep]}
                        </h3>
                        <div className="flex justify-center items-center gap-2 text-vingi-500 font-mono text-xs mt-2 uppercase tracking-widest border border-vingi-100 bg-white px-4 py-1.5 rounded-full inline-block">
                            <Loader2 size={12} className="animate-spin inline mr-2"/>
                            Processando DNA Visual
                        </div>
                     </div>
                </div>
            )}
            
            {/* TELA DE ERRO */}
            {state === AppState.ERROR && (
                <div className="flex flex-col items-center justify-center h-[80vh] text-center max-w-lg mx-auto">
                    <div className="bg-red-50 p-6 rounded-full mb-6">
                        <AlertTriangle size={48} className="text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-gray-800">Erro na Análise</h3>
                    <p className="text-gray-500 mb-8">{errorMsg}</p>
                    <div className="flex gap-4 w-full">
                        <button onClick={resetApp} className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50">Voltar</button>
                        <button onClick={startAnalysis} className="flex-1 py-3 bg-vingi-900 text-white rounded-xl font-bold hover:bg-vingi-800 shadow-lg">Tentar Novamente</button>
                    </div>
                </div>
            )}

            {/* TELA DE SUCESSO (RESULTADOS) */}
            {state === AppState.SUCCESS && result && (
                <div className="animate-fade-in space-y-8 pb-20">
                
                {uploadedImage && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 flex flex-col md:flex-row gap-6 items-start">
                         <img src={uploadedImage} className="w-24 h-32 object-cover rounded-lg shadow-md border border-gray-100" />
                         <div className="flex-1">
                             <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wide">Identificado</span>
                             </div>
                             <h2 className="text-2xl font-bold text-gray-900 mb-2">{result.patternName}</h2>
                             <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                                <span className="bg-gray-50 border border-gray-200 px-3 py-1 rounded-full font-medium">{result.technicalDna.silhouette}</span>
                                <span className="bg-gray-50 border border-gray-200 px-3 py-1 rounded-full font-medium">{result.technicalDna.neckline}</span>
                             </div>
                         </div>
                    </div>
                )}

                <div className="flex items-center justify-between overflow-x-auto pb-2">
                    <h3 className="text-lg font-bold text-gray-800 mr-4">Resultados</h3>
                    <div className="flex gap-2">
                        <FilterTab label="Todos" count={allMatches.length} active={activeTab === 'ALL'} onClick={() => setActiveTab('ALL')} icon={Layers} />
                        <FilterTab label="Exatos" count={exactMatches.length} active={activeTab === 'EXACT'} onClick={() => setActiveTab('EXACT')} icon={CheckCircle2} />
                        <FilterTab label="Estilo" count={closeMatches.length} active={activeTab === 'CLOSE'} onClick={() => setActiveTab('CLOSE')} icon={Sparkles} />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {visibleData.map((match, i) => (
                        <PatternVisualCard key={i} match={match} safeUrl={generateSafeUrl(match)} />
                    ))}
                </div>
                
                {hasMoreItems && (
                    <div className="mt-8 flex justify-center">
                        <button onClick={handleLoadMore} className="px-8 py-3 bg-white border border-gray-300 rounded-xl font-bold shadow-sm hover:bg-gray-50 hover:border-gray-400 text-gray-600 transition-all transform hover:-translate-y-1">
                            Carregar Mais Moldes
                        </button>
                    </div>
                )}

                {/* SEÇÃO DE LINKS SUGESTIVOS (RESTAURADA) */}
                {result.curatedCollections && result.curatedCollections.length > 0 && (
                    <div className="mt-12 bg-gray-50 p-8 rounded-2xl border border-gray-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-vingi-100 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
                        
                        <h4 className="font-bold text-lg mb-6 flex items-center gap-2 relative z-10"><BookOpen size={20} className="text-vingi-600"/> Coleções Sugeridas (Links Inteligentes)</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
                            {result.curatedCollections.map((coll, i) => (
                                <a key={i} href={coll.searchUrl} target="_blank" className="bg-white p-5 rounded-xl border border-gray-200 hover:border-vingi-300 hover:shadow-lg transition-all flex flex-col group cursor-pointer">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-1 rounded uppercase tracking-wider">{coll.sourceName}</span>
                                        <ExternalLink size={14} className="text-gray-300 group-hover:text-vingi-500 transition-colors"/>
                                    </div>
                                    <h5 className="font-bold text-gray-800 mb-1 group-hover:text-vingi-700 transition-colors">{coll.title}</h5>
                                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">{coll.description}</p>
                                    <div className="mt-auto pt-3 border-t border-gray-50 flex items-center text-xs font-bold text-gray-400">
                                        <ShoppingBag size={12} className="mr-1"/> {coll.itemCount}
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-8 bg-white p-6 rounded-xl border border-gray-200">
                    <h4 className="font-bold mb-4 flex items-center gap-2 text-sm text-gray-500 uppercase tracking-widest"><Globe size={14}/> Pesquisa Global Manual</h4>
                    <div className="flex gap-2 flex-wrap">
                        <ExternalSearchButton name="Google Imagens" url={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(strictQuery)}`} colorClass="bg-blue-600" icon={Globe} />
                        <ExternalSearchButton name="Pinterest" url={`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(strictQuery)}`} colorClass="bg-red-600" icon={Share2} />
                        <ExternalSearchButton name="Etsy Global" url={`https://www.etsy.com/search?q=${encodeURIComponent(strictQuery + ' sewing pattern')}`} colorClass="bg-orange-500" icon={ShoppingBag} />
                    </div>
                </div>

                </div>
            )}
            </div>
            </>
        )}
      </main>
    </div>
  );
}
