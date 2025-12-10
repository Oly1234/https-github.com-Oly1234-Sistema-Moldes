import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { analyzeClothingImage } from './services/geminiService';
import { AppState, PatternAnalysisResult, ExternalPatternMatch, CuratedCollection, ViewState, ScanHistoryItem } from './types';
import { MOCK_LOADING_STEPS } from './constants';
import { UploadCloud, RefreshCw, ExternalLink, Search, Image as ImageIcon, CheckCircle2, Globe, Layers, Sparkles, Share2, ArrowRightCircle, ShoppingBag, BookOpen, Star, Camera, DollarSign, Gift, ChevronUp, ChevronDown, History, Clock, Smartphone, X, Zap, Plus, Eye, DownloadCloud, Loader2, Database, Terminal, Maximize2, Minimize2, AlertTriangle, CloudOff } from 'lucide-react';

// --- UTILITÁRIOS DE IMAGEM E LINKS ---

const getBrandIcon = (domain: string) => {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
};

// --- COMPRESSÃO DE IMAGEM (CORREÇÃO MOBILE) ---
// Reduz imagens gigantes de câmeras (10MB+) para tamanho tratável (~500KB)
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
            
            // Qualidade 0.8 JPEG é perfeita para IA e leve para mobile
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
    });
};

// --- FUNÇÃO ANTI-404 (Smart Link Sanitizer 2.0) ---
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
    if (lowerSource.includes('amazon')) {
        return `https://www.amazon.com/s?k=${fullSearchTerm}`;
    }
    if (lowerSource.includes('ebay')) {
        return `https://www.ebay.com/sch/i.html?_nkw=${fullSearchTerm}`;
    }
    if (lowerSource.includes('mccall') || lowerSource.includes('vogue') || lowerSource.includes('simplicity') || lowerUrl.includes('somethingdelightful')) {
        return `https://simplicity.com/search.php?search_query=${cleanSearchTerm}`;
    }
    if (lowerSource.includes('makerist')) {
        return `https://www.makerist.com/patterns?q=${cleanSearchTerm}`;
    }
    if (lowerSource.includes('fold line') || lowerUrl.includes('thefoldline')) {
        return `https://thefoldline.com/?s=${cleanSearchTerm}&post_type=product`;
    }
    if (isGenericLink) {
         return `https://www.google.com/search?q=${fullSearchTerm}+site:${lowerSource}`;
    }
    return url;
};

// --- WIDGET FLUTUANTE DE COMPARAÇÃO ---
const FloatingCompareWidget: React.FC<{ mainImage: string | null; secImage: string | null }> = ({ mainImage, secImage }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isVisible, setIsVisible] = useState(true);

    if (!mainImage || !isVisible) return null;

    return (
        <div 
            className={`fixed z-40 transition-all duration-500 ease-in-out shadow-2xl rounded-2xl overflow-hidden bg-white border-2 border-vingi-100
                ${isExpanded 
                    ? 'w-48 h-auto md:w-64 bottom-24 right-4 md:top-24 md:right-8 md:bottom-auto' 
                    : 'w-16 h-16 bottom-24 right-4 md:top-24 md:right-8 md:bottom-auto hover:scale-110 cursor-pointer rounded-full'
                }
            `}
            style={{ boxShadow: '0 10px 40px -10px rgba(0,0,0,0.3)' }}
        >
            <div 
                className="relative w-full h-full group"
                onClick={() => !isExpanded && setIsExpanded(true)}
            >
                <img 
                    src={mainImage} 
                    alt="Reference" 
                    className={`w-full h-full object-cover transition-all ${!isExpanded ? 'scale-150' : ''}`} 
                />
                
                {/* Minimized View Overlay */}
                {!isExpanded && (
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-white/90 shadow-sm flex items-center justify-center">
                            <Layers size={12} className="text-vingi-600"/>
                        </div>
                    </div>
                )}

                {/* Expanded View Controls */}
                {isExpanded && (
                    <>
                        <div className="absolute top-0 left-0 w-full p-2 bg-gradient-to-b from-black/60 to-transparent flex justify-between items-start">
                            <span className="text-[10px] font-bold text-white bg-black/20 backdrop-blur px-2 py-0.5 rounded-full">SUA REFERÊNCIA</span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                                className="p-1 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur"
                            >
                                <Minimize2 size={12} />
                            </button>
                        </div>

                        {secImage && (
                            <div className="absolute bottom-2 right-2 w-12 h-16 rounded-lg overflow-hidden border-2 border-white shadow-lg">
                                <img src={secImage} className="w-full h-full object-cover" alt="Sec" />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// --- VIRTUAL SCRAPER ENGINE (Simulando Lógica Python Backend) ---
const PatternVisualCard: React.FC<{ match: ExternalPatternMatch; safeUrl: string }> = ({ match, safeUrl }) => {
    const domain = new URL(safeUrl).hostname;
    
    // Estado do Scraper
    const [imageSrc, setImageSrc] = useState<string | null>(match.imageUrl || null);
    const [status, setStatus] = useState<'IDLE' | 'SCRAPING' | 'CACHED' | 'FALLBACK'>('IDLE');
    const [scraperLog, setScraperLog] = useState<string>('');

    // Efeito: Inicia o "Python Script" virtual ao montar
    useEffect(() => {
        // 1. Verifica Cache ("Pasta Temporária")
        const cacheKey = `vingi_v2_cache_${safeUrl}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
            setImageSrc(cachedData);
            setStatus('CACHED');
            return;
        }

        // 2. Se não tem cache, inicia scraping
        runVirtualScraper();
    }, [safeUrl]);

    const runVirtualScraper = async () => {
        setStatus('SCRAPING');
        setScraperLog('Iniciando crawler...');
        
        try {
            // TENTATIVA 1: Microlink Meta API (Excelente para extrair og:image limpo)
            // Isso simula o comportamento do Python de ler metadados sem renderizar visualmente a página
            setScraperLog('Extraindo meta tags...');
            const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(safeUrl)}`);
            const data = await response.json();
            
            if (data.status === 'success' && data.data?.image?.url) {
                const foundUrl = data.data.image.url;
                
                // Valida se não é logo genérico
                if (!foundUrl.includes('logo') && !foundUrl.includes('favicon')) {
                    saveToCache(foundUrl);
                    return;
                }
            }

            // TENTATIVA 2: Fallback para busca de imagem genérica (DuckDuckGo/Google Proxy)
            // Se o site bloqueou o scraper, buscamos a imagem no índice público
            setScraperLog('Buscando em índice público...');
            const fallbackImage = `https://tse2.mm.bing.net/th?q=${encodeURIComponent(match.patternName + ' sewing pattern ' + match.source)}&w=400&h=400&c=7&rs=1&p=0`;
            
            // Aceitamos o fallback mas não salvamos no cache permanente para tentar scrap real depois
            setImageSrc(fallbackImage);
            setStatus('FALLBACK');

        } catch (error) {
            console.error("Scraper failed:", error);
            setStatus('FALLBACK');
        }
    };

    const saveToCache = (url: string) => {
        const cacheKey = `vingi_v2_cache_${safeUrl}`;
        try {
            localStorage.setItem(cacheKey, url);
            setImageSrc(url);
            setStatus('CACHED');
        } catch (e) {
            console.warn("Cache cheio");
            setImageSrc(url); // Exibe mesmo sem salvar
        }
    };

    // Feedback de Tipo/Preço
    let typeColor = 'bg-slate-100 text-slate-500 border-slate-200';
    let TypeIcon = DollarSign;
     
    if (match.type === 'GRATUITO') {
         typeColor = 'bg-emerald-100 text-emerald-600 border-emerald-200';
         TypeIcon = Gift;
    } else if (match.type === 'INDIE') {
         typeColor = 'bg-purple-100 text-purple-600 border-purple-200';
         TypeIcon = Zap;
    }

    return (
        <div 
            className="group bg-white rounded-2xl border border-gray-100 hover:border-vingi-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full overflow-hidden relative"
        >
             {/* Badge de Match */}
             <div className="absolute top-2 right-2 z-10">
                <span className={`text-[9px] font-bold px-2 py-1 rounded-md text-white shadow-sm backdrop-blur-md ${match.similarityScore > 90 ? 'bg-vingi-600/90' : 'bg-vingi-400/80'}`}>
                    {Math.round(match.similarityScore)}% MATCH
                </span>
             </div>

             {/* Área da Imagem (Scraper View) */}
             <div 
                onClick={() => window.open(safeUrl, '_blank')}
                className="h-48 w-full bg-gray-50 relative overflow-hidden flex items-center justify-center cursor-pointer border-b border-gray-100"
            >
                 {status === 'SCRAPING' && (
                     <div className="flex flex-col items-center justify-center gap-3 px-4 text-center w-full">
                         <div className="relative">
                            <div className="w-8 h-8 border-2 border-vingi-200 border-t-vingi-600 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Terminal size={12} className="text-vingi-600" />
                            </div>
                         </div>
                         <div className="flex flex-col gap-1 w-full">
                            <span className="text-[10px] font-bold text-vingi-700 uppercase tracking-wider">Acessando Fonte...</span>
                            <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-vingi-400 animate-progress-indeterminate"></div>
                            </div>
                            <span className="text-[9px] text-gray-400 font-mono truncate">{scraperLog}</span>
                         </div>
                     </div>
                 )}
                 
                 {(status === 'CACHED' || status === 'FALLBACK') && imageSrc && (
                    <>
                        <img 
                            src={imageSrc} 
                            alt={match.patternName}
                            className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                            onError={(e) => {
                                // Se a imagem cacheada quebrar, reseta
                                e.currentTarget.style.display = 'none';
                                localStorage.removeItem(`vingi_v2_cache_${safeUrl}`);
                                setStatus('SCRAPING');
                            }}
                        />
                        {/* Overlay Gradiente para legibilidade */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </>
                 )}

                 {/* Botão de Debug/Recache */}
                 <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        localStorage.removeItem(`vingi_v2_cache_${safeUrl}`);
                        runVirtualScraper();
                    }}
                    title="Forçar download da imagem novamente"
                    className="absolute bottom-2 right-2 bg-white/90 text-gray-600 p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:text-vingi-600"
                 >
                     <RefreshCw size={12} className={status === 'SCRAPING' ? 'animate-spin' : ''} />
                 </button>
             </div>

             {/* Informações */}
             <div className="p-4 flex flex-col flex-1 relative bg-white">
                 <div className="flex items-center gap-2 mb-2">
                    <img src={getBrandIcon(domain)} className="w-4 h-4 rounded-full opacity-70" alt="icon"/>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide truncate">
                        {match.source}
                    </p>
                 </div>

                 <h3 
                    onClick={() => window.open(safeUrl, '_blank')}
                    className="font-bold text-gray-800 text-sm leading-snug line-clamp-2 mb-2 group-hover:text-vingi-600 transition-colors cursor-pointer"
                 >
                    {match.patternName}
                 </h3>
                 
                 <div className="mt-auto pt-3 flex items-center justify-between">
                     <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-full flex items-center gap-1 ${typeColor}`}>
                         <TypeIcon size={10} /> {match.type}
                     </span>
                     
                     {/* Indicador de Status do Scraper */}
                     {status === 'CACHED' ? (
                         <span className="text-[9px] text-emerald-500 font-bold flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" title="Imagem salva no sistema">
                             <Database size={10} /> SALVO
                         </span>
                     ) : (
                        <span className="text-[9px] text-gray-300 font-bold flex items-center gap-1">
                            WEB
                        </span>
                     )}
                 </div>
             </div>
        </div>
    );
};

const CollectionCard: React.FC<{ collection: CuratedCollection }> = ({ collection }) => (
    <div 
        onClick={() => window.open(collection.searchUrl, '_blank')}
        className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:border-vingi-300 transition-all cursor-pointer group flex flex-col h-full relative overflow-hidden"
    >
        <div className="absolute top-0 right-0 p-10 bg-gradient-to-bl from-gray-50 to-transparent rounded-bl-full opacity-50"></div>
        <div className="flex items-start justify-between mb-3 relative z-10">
            <div className={`p-2 rounded-lg ${collection.sourceName.includes('Etsy') ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                {collection.sourceName.includes('Etsy') ? <ShoppingBag size={18}/> : <BookOpen size={18}/>}
            </div>
            <span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded text-gray-600 group-hover:bg-vingi-100 group-hover:text-vingi-700 transition-colors">
                {collection.itemCount}
            </span>
        </div>
        <h4 className="font-bold text-gray-900 text-sm mb-1 leading-tight group-hover:text-vingi-600 relative z-10">
            {collection.title}
        </h4>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3 relative z-10">
            {collection.description}
        </p>
        <div className="mt-auto flex items-center gap-1 text-xs font-bold text-vingi-600 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
            Explorar Acervo <ArrowRightCircle size={12}/>
        </div>
    </div>
);

const ExternalSearchButton = ({ name, url, colorClass, icon: Icon }: any) => (
    <a 
        href={url} 
        target="_blank" 
        rel="noreferrer" 
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold text-white transition-transform hover:scale-105 shadow-sm ${colorClass}`}
    >
        <Icon size={12} />
        {name}
    </a>
);

const FilterTab = ({ label, count, active, onClick, icon: Icon }: any) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
            active 
            ? 'bg-vingi-900 text-white shadow-md' 
            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
        }`}
    >
        {Icon && <Icon size={12} className={active ? 'text-vingi-400' : 'text-gray-400'} />}
        {label}
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
            {count}
        </span>
    </button>
);

export default function App() {
  const [view, setView] = useState<ViewState>('HOME');
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<PatternAnalysisResult | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedSecondaryImage, setUploadedSecondaryImage] = useState<string | null>(null);
  const [isRefExpanded, setIsRefExpanded] = useState(true);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'EXACT' | 'CLOSE' | 'VIBE'>('ALL');

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstallDismissed, setIsInstallDismissed] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  
  // Refs para entrada secundária
  const secondaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryCameraInputRef = useRef<HTMLInputElement>(null);

  // RESET DE SCROLL INTELIGENTE (Correção para Tela Branca no Mobile)
  useLayoutEffect(() => {
    // Força o scroll voltar ao topo quando a análise termina ou a view muda
    if (mainScrollRef.current) {
        mainScrollRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [state, view, activeTab]);

  useEffect(() => {
      const storedHistory = localStorage.getItem('vingi_scan_history');
      if (storedHistory) {
          try {
              setHistory(JSON.parse(storedHistory));
          } catch (e) {
              console.error("Falha ao carregar histórico");
          }
      }
      
      const handleBeforeInstallPrompt = (e: any) => {
          e.preventDefault();
          setDeferredPrompt(e);
          setShowInstallButton(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      return () => {
          window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
  }, []);

  const handleInstallClick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
          setShowInstallButton(false);
      }
      setDeferredPrompt(null);
  };

  const dismissInstall = () => {
      setShowInstallButton(false);
      setIsInstallDismissed(true);
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
        setTimeout(() => {
            if (cameraInputRef.current) {
                cameraInputRef.current.click();
            }
        }, 50);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (state === AppState.ANALYZING) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < MOCK_LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 2500); 
    }
    return () => clearInterval(interval);
  }, [state]);

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

    // 1. Atualização visual imediata (Renderiza o Loader)
    setState(AppState.ANALYZING);
    setErrorMsg(null);
    
    // Força scroll para o topo em mobile
    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
    window.scrollTo(0,0);

    // 2. CRÍTICO: setTimeout permite que o navegador "pinte" o loader na tela (Paint Cycle)
    // antes de bloquear a thread JS com o processamento pesado de Base64 e Network.
    setTimeout(async () => {
        try {
            // COMPRESSÃO PARA MOBILE: Reduzir a imagem para evitar estouro de memória (White Screen)
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
            console.error(err);
            // Captura o erro e exibe na tela ao invés de tela branca
            setErrorMsg(err.message || "Erro desconhecido na análise.");
            setState(AppState.ERROR);
        }
    }, 300); // Aumentado delay para garantir que a UI de loading carregue
  };

  const resetApp = () => {
    setState(AppState.IDLE);
    setResult(null);
    setUploadedImage(null);
    setUploadedSecondaryImage(null);
    setActiveTab('ALL');
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

  const filteredData = getFilteredMatches();
  
  const getStrictSearchQuery = () => {
      if (!result) return '';
      return `${result.technicalDna.silhouette} ${result.technicalDna.neckline} ${result.technicalDna.sleeve} ${result.category} pattern`;
  };
  
  const strictQuery = getStrictSearchQuery();

  const renderHistoryView = () => (
      <div className="p-6 max-w-5xl mx-auto min-h-full">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <History size={28} className="text-vingi-600"/> Histórico de Varreduras
          </h2>
          
          {history.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border border-gray-200 shadow-sm">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock size={32} className="text-gray-400"/>
                  </div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">Sem histórico recente</h3>
                  <p className="text-gray-500 mb-6">Suas análises aparecerão aqui.</p>
                  <button onClick={() => setView('HOME')} className="px-6 py-2 bg-vingi-900 text-white rounded-lg font-bold">
                      Iniciar Nova Busca
                  </button>
              </div>
          ) : (
              <div className="grid gap-4">
                  {history.map(item => (
                      <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
                          <div>
                              <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                                  {new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString()}
                              </div>
                              <h4 className="font-bold text-gray-900">{item.patternName}</h4>
                              <p className="text-xs text-gray-500">{item.dnaSummary}</p>
                          </div>
                          <div className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600">
                              {item.category}
                          </div>
                      </div>
                  ))}
                  <button 
                    onClick={() => {
                        localStorage.removeItem('vingi_scan_history');
                        setHistory([]);
                    }}
                    className="mt-4 text-xs text-red-400 hover:text-red-600 font-bold self-start"
                  >
                      Limpar Histórico
                  </button>
              </div>
          )}
      </div>
  );

  return (
    // FIX MOBILE: h-[100dvh] força altura da tela exata no celular, ignorando barras de navegação.
    // overflow-hidden no pai impede que o corpo da página role, deixando o scroll apenas para o <main>
    <div className="flex h-[100dvh] w-full bg-[#f8fafc] text-gray-800 font-sans overflow-hidden fixed inset-0">
      <Sidebar 
        currentView={view} 
        appState={state}
        hasUploadedImage={!!uploadedImage}
        onViewChange={setView} 
        onInstallClick={handleInstallClick}
        showInstallButton={showInstallButton}
        onFabClick={handleFabAction}
      />
      
      {showInstallButton && !isInstallDismissed && state === AppState.IDLE && (
          <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full md:w-auto animate-bounce-in">
              <div className="bg-vingi-900 border border-vingi-700 p-4 rounded-xl shadow-2xl flex flex-col gap-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-vingi-500/20 blur-2xl rounded-full pointer-events-none"></div>

                  <div className="flex items-start gap-3 relative z-10">
                      <div className="p-3 bg-vingi-800 rounded-lg shrink-0">
                          <Smartphone className="text-vingi-400" size={24} />
                      </div>
                      <div>
                          <h3 className="font-bold text-white text-sm">Instalar Aplicativo</h3>
                          <p className="text-xs text-gray-400 mt-1">
                              Acesse o VINGI AI em tela cheia, offline e direto da tela inicial.
                          </p>
                      </div>
                      <button 
                        onClick={dismissInstall}
                        className="text-gray-500 hover:text-white transition-colors"
                      >
                          <X size={16} />
                      </button>
                  </div>

                  <div className="flex gap-2 mt-1 relative z-10">
                      <button 
                        onClick={dismissInstall}
                        className="flex-1 py-2 text-xs font-bold text-gray-400 hover:bg-white/5 rounded-lg transition-colors"
                      >
                          Agora não
                      </button>
                      <button 
                        onClick={handleInstallClick}
                        className="flex-1 py-2 text-xs font-bold bg-vingi-500 hover:bg-vingi-400 text-white rounded-lg shadow-lg shadow-vingi-500/20 transition-all"
                      >
                          Instalar Agora
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* WIDGET FLUTUANTE DE COMPARAÇÃO */}
      {state === AppState.SUCCESS && (
          <FloatingCompareWidget mainImage={uploadedImage} secImage={uploadedSecondaryImage} />
      )}

      {/* ERROR OVERLAY */}
      {state === AppState.ERROR && (
          <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-8 animate-fade-in">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                  <AlertTriangle size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">Interrupção na Análise</h3>
              <p className="text-sm text-gray-500 text-center max-w-md mb-8">
                  {errorMsg || "Não foi possível conectar ao servidor neural. Verifique sua conexão ou tente novamente."}
              </p>
              
              <div className="flex gap-4">
                  <button 
                    onClick={resetApp}
                    className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors"
                  >
                      Voltar ao Início
                  </button>
                  <button 
                    onClick={startAnalysis}
                    className="px-6 py-3 bg-vingi-900 text-white font-bold rounded-xl shadow-lg hover:bg-vingi-800 transition-colors flex items-center gap-2"
                  >
                      <RefreshCw size={16} /> Tentar Novamente
                  </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-8 font-mono border p-2 rounded">
                  DEBUG: {process.env.API_KEY ? 'API_KEY_PRESENT' : 'API_KEY_MISSING'}
              </p>
          </div>
      )}

      {/* LOADING OVERLAY (FULLSCREEN FIX) */}
      {state === AppState.ANALYZING && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-xs text-center">
                <div className="relative w-32 h-48 mx-auto bg-white rounded-xl p-1 shadow-2xl mb-8 rotate-3 transition-transform duration-1000">
                    {uploadedImage && <img src={uploadedImage} alt="Analise" className="w-full h-full object-cover rounded-lg" />}
                    <div className="absolute inset-0 bg-vingi-900/20 rounded-xl"></div>
                    <div className="absolute top-0 w-full h-1 bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)] animate-scan z-20"></div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{MOCK_LOADING_STEPS[loadingStep]}</h3>
                <div className="w-48 h-2 bg-gray-100 rounded-full mx-auto overflow-hidden mt-4">
                    <div 
                        className="h-full bg-vingi-500 transition-all duration-500 ease-out"
                        style={{ width: `${((loadingStep + 1) / MOCK_LOADING_STEPS.length) * 100}%` }}
                    />
                </div>
                <p className="text-xs text-gray-400 mt-8 font-mono">PROCESSANDO DADOS TÊXTEIS...</p>
            </div>
        </div>
      )}

      {/* MAIN CONTAINER: Agora gerencia seu próprio scroll interno */}
      <main 
        ref={mainScrollRef}
        className="flex-1 md:ml-20 h-full overflow-y-auto overflow-x-hidden pb-24 md:pb-6 relative touch-pan-y scroll-smooth"
      >
        
        {view === 'HISTORY' ? renderHistoryView() : (
            <>
            {/* Header só aparece se NÃO estiver carregando */}
            {state !== AppState.ANALYZING && state !== AppState.ERROR && (
                <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex justify-between items-center transition-all shadow-sm">
                <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold tracking-tight text-vingi-900">
                    VINGI <span className="text-vingi-500">GALERIA TÉCNICA</span>
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    {state === AppState.SUCCESS && (
                        <button onClick={resetApp} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors" title="Nova Busca">
                            <RefreshCw size={18} />
                        </button>
                    )}
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-vingi-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm ring-2 ring-white">
                        AI
                    </div>
                </div>
                </header>
            )}

            <div className="max-w-[1800px] mx-auto p-4 md:p-6 min-h-full flex flex-col">
            {state === AppState.IDLE && (
                <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center animate-fade-in pb-32 md:pb-0">
                
                <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col md:flex-row">
                    <div className="flex-1 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100">
                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                            <UploadCloud size={32} className="text-vingi-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Análise Visual 3D</h2>
                        <p className="text-gray-500 text-sm mb-8 max-w-xs">
                            Carregue a foto da peça. Adicione ângulos extras para maior precisão.
                        </p>

                        <input type="file" ref={fileInputRef} onChange={handleMainUpload} accept="image/*" className="hidden" />
                        <input type="file" ref={cameraInputRef} onChange={handleMainUpload} accept="image/*" capture="environment" className="hidden" />

                        {!uploadedImage ? (
                            <div className="flex gap-3 w-full max-w-xs">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 py-3 bg-vingi-900 text-white rounded-xl font-bold text-sm hover:bg-vingi-800 transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    <ImageIcon size={16} /> Galeria
                                </button>
                                <button 
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="py-3 px-5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all flex items-center justify-center"
                                    title="Usar Câmera"
                                >
                                    <Camera size={18} />
                                </button>
                            </div>
                        ) : (
                            <div className="w-full max-w-xs relative group">
                                <img src={uploadedImage} alt="Preview" className="w-full h-48 object-cover rounded-xl shadow-md" />
                                <button 
                                    onClick={() => setUploadedImage(null)}
                                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        <span className="text-[10px] text-gray-300 mt-4">v3.0 Stability Update</span>
                    </div>

                    <div className="w-full md:w-80 bg-gray-50 p-8 flex flex-col justify-center">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Opcional</h3>
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Ângulo Secundário</label>
                            <p className="text-xs text-gray-500 mb-3">Costas, lado ou detalhe.</p>
                            
                            <input type="file" ref={secondaryInputRef} onChange={handleSecondaryUpload} accept="image/*" className="hidden" />
                            <input type="file" ref={secondaryCameraInputRef} onChange={handleSecondaryUpload} accept="image/*" capture="environment" className="hidden" />
                            
                            {!uploadedSecondaryImage ? (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => secondaryInputRef.current?.click()}
                                        className="flex-1 h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-vingi-400 hover:bg-white hover:text-vingi-500 transition-all"
                                    >
                                        <Plus size={24} className="opacity-50" />
                                        <span className="text-xs font-medium">Galeria</span>
                                    </button>
                                    <button 
                                        onClick={() => secondaryCameraInputRef.current?.click()}
                                        className="w-12 h-32 bg-gray-200 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-300 transition-all"
                                        title="Câmera Secundária"
                                    >
                                        <Camera size={20} />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative group w-full h-32">
                                    <img src={uploadedSecondaryImage} alt="Sec" className="w-full h-full object-cover rounded-xl border border-gray-200" />
                                    <button 
                                        onClick={() => setUploadedSecondaryImage(null)}
                                        className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={startAnalysis}
                            disabled={!uploadedImage}
                            className={`hidden md:flex w-full py-3 rounded-xl font-bold text-sm transition-all shadow-lg items-center justify-center gap-2 ${
                                uploadedImage 
                                ? 'bg-gradient-to-r from-vingi-900 to-vingi-500 text-white hover:shadow-xl hover:scale-[1.02]' 
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            <Sparkles size={16} />
                            INICIAR VARREDURA
                        </button>
                    </div>
                </div>
                </div>
            )}

            {state === AppState.SUCCESS && result && (
                <div className="animate-fade-in space-y-8">
                
                {uploadedImage && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                        <div 
                            className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => setIsRefExpanded(!isRefExpanded)}
                        >
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <ImageIcon size={14} /> Referência Visual vs Análise
                            </h3>
                            {isRefExpanded ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
                        </div>
                        
                        {isRefExpanded && (
                            <div className="p-4 flex flex-col md:flex-row gap-6">
                                <div className="flex gap-4 shrink-0">
                                    <div className="relative group w-32 h-40 md:w-40 md:h-52 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-inner">
                                        <img src={uploadedImage} alt="Ref" className="w-full h-full object-cover" />
                                        <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] py-1 text-center font-bold backdrop-blur-sm">ORIGINAL</div>
                                    </div>
                                    {uploadedSecondaryImage && (
                                        <div className="relative group w-32 h-40 md:w-40 md:h-52 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-inner">
                                            <img src={uploadedSecondaryImage} alt="Ref Sec" className="w-full h-full object-cover" />
                                            <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] py-1 text-center font-bold backdrop-blur-sm">ÂNGULO 2</div>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex-1 flex flex-col justify-center border-l border-gray-100 pl-6 border-dashed">
                                    <h2 className="text-xl font-bold text-gray-800 mb-1">{result.patternName}</h2>
                                    <p className="text-gray-500 text-sm mb-4">DNA Técnico Identificado</p>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                            <span className="text-[10px] text-blue-400 font-bold uppercase block mb-1">Silhueta</span>
                                            <span className="text-sm font-semibold text-gray-700">{result.technicalDna.silhouette}</span>
                                        </div>
                                        <div className="bg-purple-50/50 p-3 rounded-lg border border-purple-100">
                                            <span className="text-[10px] text-purple-400 font-bold uppercase block mb-1">Decote / Gola</span>
                                            <span className="text-sm font-semibold text-gray-700">{result.technicalDna.neckline}</span>
                                        </div>
                                        <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-100">
                                            <span className="text-[10px] text-orange-400 font-bold uppercase block mb-1">Manga</span>
                                            <span className="text-sm font-semibold text-gray-700">{result.technicalDna.sleeve}</span>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Estrutura</span>
                                            <span className="text-sm font-semibold text-gray-700">{result.technicalDna.fabricStructure}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="sticky top-[60px] z-20 bg-[#f8fafc]/95 backdrop-blur py-2 border-b border-gray-200/50">
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                            <FilterTab label="Todos" count={allMatches.length} active={activeTab === 'ALL'} onClick={() => setActiveTab('ALL')} icon={Layers} />
                            <FilterTab label="Exatos" count={exactMatches.length} active={activeTab === 'EXACT'} onClick={() => setActiveTab('EXACT')} icon={CheckCircle2} />
                            <FilterTab label="Estilo" count={closeMatches.length} active={activeTab === 'CLOSE'} onClick={() => setActiveTab('CLOSE')} icon={Sparkles} />
                            <FilterTab label="Inspiração" count={vibeMatches.length} active={activeTab === 'VIBE'} onClick={() => setActiveTab('VIBE')} icon={Star} />
                        </div>
                        <div className="hidden md:flex text-[10px] font-bold text-gray-400 items-center gap-1">
                            <Globe size={10} /> {allMatches.length} RESULTADOS GLOBAIS
                        </div>
                    </div>
                </div>

                {/* VISUAL PATTERN CARDS (Grid com Scraper Virtual) */}
                <div className="min-h-[600px]">
                    {filteredData.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                            {filteredData.map((match, i) => {
                                const safeUrl = generateSafeUrl(match);
                                return <PatternVisualCard key={i} match={match} safeUrl={safeUrl} />;
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm">
                            <p>Nenhum resultado para este filtro.</p>
                        </div>
                    )}
                </div>

                <div className="mt-12 pt-8 border-t border-gray-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-vingi-900 text-white rounded-lg shadow-lg">
                            <Globe size={20} />
                        </div>
                        <div>
                            <h4 className="text-xl font-bold text-gray-900 tracking-tight">Hub de Pesquisa Global</h4>
                            <p className="text-xs text-gray-500">Acesso direto a acervos independentes e marcas internacionais</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-8">
                        <h5 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <Sparkles size={14} className="text-amber-500"/> Coleções Curadas pela IA
                        </h5>
                        {result.curatedCollections && result.curatedCollections.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {result.curatedCollections.map((collection, idx) => (
                                    <CollectionCard key={idx} collection={collection} />
                                ))}
                            </div>
                        ) : <p className="text-xs text-gray-400">Nenhuma coleção encontrada.</p>}
                    </div>

                    <div className="bg-vingi-900 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-white">
                             <h5 className="text-sm font-bold mb-1">Exploração Externa de Alta Precisão</h5>
                             <p className="text-[10px] text-gray-400">
                                Pesquisando DNA: <span className="text-vingi-300">"{strictQuery}"</span>
                             </p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                             <ExternalSearchButton 
                                name="Google Technical" 
                                url={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(strictQuery + ' technical drawing')}`}
                                colorClass="bg-blue-600 hover:bg-blue-500"
                                icon={Globe}
                             />
                             <ExternalSearchButton 
                                name="Pinterest Vibe" 
                                url={`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(strictQuery + ' aesthetic')}`}
                                colorClass="bg-red-600 hover:bg-red-500"
                                icon={Share2}
                             />
                             <ExternalSearchButton 
                                name="Etsy Patterns" 
                                url={`https://www.etsy.com/search?q=${encodeURIComponent(strictQuery + ' pdf')}`}
                                colorClass="bg-orange-600 hover:bg-orange-500"
                                icon={ShoppingBag}
                             />
                             <ExternalSearchButton 
                                name="The Fold Line" 
                                url={`https://thefoldline.com/?s=${encodeURIComponent(strictQuery)}&post_type=product`}
                                colorClass="bg-teal-600 hover:bg-teal-500"
                                icon={Star}
                             />
                        </div>
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