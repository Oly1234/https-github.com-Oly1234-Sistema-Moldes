
import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { analyzeClothingImage } from './services/geminiService';
import { AppState, PatternAnalysisResult, ExternalPatternMatch, CuratedCollection, RecommendedResource, ViewState, ScanHistoryItem } from './types';
import { MOCK_LOADING_STEPS } from './constants';
import { UploadCloud, RefreshCw, ExternalLink, Search, Compass, Image as ImageIcon, CheckCircle2, Globe, Layers, Sparkles, Share2, PenTool, ArrowRightCircle, ShoppingBag, BookOpen, Star, Link as LinkIcon, Camera, Layout, DownloadCloud, AlertCircle, ShoppingCart, Plus, X, DollarSign, Gift, ChevronUp, ChevronDown, History, Clock, Smartphone } from 'lucide-react';

// --- UTILITÁRIOS DE IMAGEM ---

// Camada 1: Proxy de Imagem Otimizado
const getProxiedUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.includes('googleusercontent')) return url;
  // output=jpg e q=85 para garantir compressão e carregamento
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&h=600&fit=cover&a=attention&output=jpg&q=80`;
};

// Camada 3: Screenshot HQ (Microlink) - Timeout rápido
const getMicrolinkScreenshot = (siteUrl: string) => {
    const encoded = encodeURIComponent(siteUrl);
    // Adicionei refresh=false para tentar pegar cache se existir, mais rápido
    return `https://api.microlink.io/?url=${encoded}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1280&viewport.height=1280&overlay.browser=dark`;
};

// Camada 4: Fallback mShots (Wordpress/Blog safe)
const getMShotsScreenshot = (siteUrl: string) => {
    return `https://s0.wp.com/mshots/v1/${encodeURIComponent(siteUrl)}?w=600&h=800`;
};

// Camada 5: Logo/Favicon da Marca
const getBrandLogoUrl = (url: string) => {
    let domain = '';
    try {
        const urlObj = new URL(url);
        domain = urlObj.hostname;
    } catch (e) {
        domain = 'google.com';
    }
    return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=128`;
};

// Lista de domínios que sabemos que bloqueiam screenshots (Puzzle/Captcha)
const ANTI_CAPTCHA_DOMAINS = ['etsy.com', 'amazon.com', 'simplicity.com', 'mccall.com', 'knowme', 'somethingdelightful', 'ebay', 'sewdirect'];

// --- COMPONENTE DE CARTÃO DE MARCA (FALLBACK FINAL) ---
const BrandFallbackCard = ({ match }: { match: ExternalPatternMatch }) => {
    const logoUrl = getBrandLogoUrl(match.url);

    return (
        <div className="w-full h-full bg-white flex flex-col items-center justify-center relative overflow-hidden p-4 text-center group-hover:bg-gray-50 transition-colors">
            {/* Padrão de fundo sutil */}
             <div className="absolute inset-0 opacity-[0.03]" 
                 style={{ 
                     backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E")` 
                 }} 
            />
            
            <div className="relative z-10 flex flex-col items-center animate-fade-in w-full">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center mb-2 p-2 group-hover:scale-110 transition-transform duration-500">
                    <img 
                        src={logoUrl} 
                        alt={match.source} 
                        className="max-w-full max-h-full object-contain opacity-80"
                        onError={(e) => e.currentTarget.style.display = 'none'} 
                    />
                </div>
                <div className="bg-gray-100 px-2 py-0.5 rounded-full mb-1">
                    <span className="text-[7px] font-bold tracking-widest text-gray-500 uppercase truncate max-w-[90px] block">{match.source}</span>
                </div>
                <h4 className="font-serif font-bold text-gray-800 text-[10px] leading-tight line-clamp-2 w-full">
                    {match.patternName}
                </h4>
            </div>
             <div className="absolute bottom-0 w-full bg-gray-50 py-1 border-t border-gray-100">
                 <span className="text-[7px] font-bold text-gray-400 flex items-center justify-center gap-1 uppercase">
                    <Globe size={8} /> Site Oficial
                 </span>
            </div>
        </div>
    );
};

// --- COMPONENTE INTELIGENTE DE IMAGEM (5 CAMADAS) ---
const PatternCardImage = ({ src, alt, className, onClick, match }: { src?: string, alt: string, className?: string, onClick?: () => void, match: ExternalPatternMatch }) => {
  // 0: Proxy Otimizado
  // 1: Blob Local
  // 2: Screenshot HQ (Microlink)
  // 3: Screenshot Fallback (mShots)
  // 4: Brand Fallback
  const [stage, setStage] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Verifica se o domínio está na lista negra de screenshots
  const isAntiCaptchaDomain = ANTI_CAPTCHA_DOMAINS.some(domain => match.url.includes(domain) || match.source.toLowerCase().includes(domain.split('.')[0]));

  const attemptBlobDownload = async (imageUrl: string) => {
    try {
        const corsProxy = 'https://corsproxy.io/?'; 
        const response = await fetch(`${corsProxy}${encodeURIComponent(imageUrl)}`);
        if (!response.ok) throw new Error("Falha no download");
        const blob = await response.blob();
        if (blob.size < 500) throw new Error("Imagem inválida"); 
        const localUrl = URL.createObjectURL(blob);
        setCurrentSrc(localUrl);
    } catch (e) {
        handleError(); // Falha no blob, vai para próxima
    }
  };

  useEffect(() => {
    setIsImageLoaded(false);
    setStage(0);
    
    if (src && src.length > 5) {
        setCurrentSrc(getProxiedUrl(src));
        
        // Timeout Longo (10s) para Proxy
        const timeoutId = setTimeout(() => {
            if (!isImageLoaded) handleError();
        }, 10000); 

        return () => clearTimeout(timeoutId);
    } else {
        // Se não tem imagem, tenta screenshot ou vai direto pro logo
        if (isAntiCaptchaDomain) {
            setStage(4); 
        } else {
            setStage(2);
        }
    }
  }, [src, match.url]);

  useEffect(() => {
      if (stage === 1 && src) {
          attemptBlobDownload(src);
      } else if (stage === 2) {
          setCurrentSrc(getMicrolinkScreenshot(match.url));
          
          const screenshotTimeout = setTimeout(() => {
              if (!isImageLoaded) handleError();
          }, 20000); // 20s para screenshot
          return () => clearTimeout(screenshotTimeout);
      } else if (stage === 3) {
          setCurrentSrc(getMShotsScreenshot(match.url));
          
          const mshotsTimeout = setTimeout(() => {
              if (!isImageLoaded) setStage(4);
          }, 20000);
          return () => clearTimeout(mshotsTimeout);
      }
  }, [stage]);

  const handleError = () => {
      if (stage === 0) {
          setStage(1);
      } else if (stage === 1) {
          if (isAntiCaptchaDomain) {
              setStage(4); 
          } else {
              setStage(2);
          }
      } else if (stage === 2) {
          setStage(3); // Tenta mShots
      } else if (stage === 3) {
          setStage(4); // Brand Fallback
      }
  };

  if (stage === 4) {
      return (
          <div className={`${className} cursor-pointer relative group bg-white`} onClick={onClick}>
              <BrandFallbackCard match={match} />
          </div>
      );
  }

  return (
    <div className={`${className} relative bg-gray-100 overflow-hidden`}>
        {/* Placeholder */}
        {!isImageLoaded && (
            <div className="absolute inset-0 bg-gray-50 animate-pulse z-10 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-vingi-500 animate-spin opacity-50"></div>
            </div>
        )}

        <img
            src={currentSrc}
            alt={alt}
            className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onClick={onClick}
            onError={handleError}
            onLoad={() => setIsImageLoaded(true)}
            crossOrigin="anonymous"
            loading="lazy"
            referrerPolicy="no-referrer"
        />
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

const ResourceLink: React.FC<{ resource: RecommendedResource }> = ({ resource }) => {
    let icon = <ExternalLink size={14} />;
    let bgClass = "bg-white border-gray-200 hover:border-vingi-300";
    
    if (resource.type === 'PURCHASE') {
        icon = <ShoppingCart size={14} />;
        bgClass = "bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-800";
    } else if (resource.type === 'FREE_REPO') {
        icon = <DownloadCloud size={14} />;
        bgClass = "bg-indigo-50 border-indigo-200 hover:border-indigo-400 text-indigo-800";
    }

    return (
        <a 
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all group ${bgClass}`}
        >
            <div className="shrink-0 p-1.5 bg-white/60 rounded-full border border-black/5">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <h5 className="text-[11px] font-bold leading-tight truncate">{resource.name}</h5>
                <p className="text-[9px] opacity-80 line-clamp-1">{resource.description}</p>
            </div>
            <ExternalLink size={12} className="opacity-50 group-hover:opacity-100 transition-opacity" />
        </a>
    );
};

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
  const secondaryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      const storedHistory = localStorage.getItem('vingi_scan_history');
      if (storedHistory) {
          try {
              setHistory(JSON.parse(storedHistory));
          } catch (e) {
              console.error("Falha ao carregar histórico");
          }
      }
      
      // PWA Install Prompt Listener
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
      const updatedHistory = [newItem, ...history].slice(0, 50); // Manter últimos 50
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

    try {
        const mainBase64 = uploadedImage.split(',')[1];
        const mainType = uploadedImage.split(';')[0].split(':')[1];
        
        let secondaryBase64: string | null = null;
        let secondaryType: string | null = null;
        
        if (uploadedSecondaryImage) {
            secondaryBase64 = uploadedSecondaryImage.split(',')[1];
            secondaryType = uploadedSecondaryImage.split(';')[0].split(':')[1];
        }

        const analysisResult = await analyzeClothingImage(mainBase64, mainType, secondaryBase64, secondaryType);
        setResult(analysisResult);
        addToHistory(analysisResult);
        setState(AppState.SUCCESS);

    } catch (err) {
      console.error(err);
      setErrorMsg("Erro na conexão com os bancos de dados. Tente novamente.");
      setState(AppState.ERROR);
    }
  };

  const resetApp = () => {
    setState(AppState.IDLE);
    setResult(null);
    setUploadedImage(null);
    setUploadedSecondaryImage(null);
    setActiveTab('ALL');
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
  const superSuggestion = exactMatches[0] || closeMatches[0];

  const renderCatalogCard = (match: ExternalPatternMatch, index: number, isHero: boolean = false) => {
     const isSearchLink = match.url.includes('search') || match.linkType === 'SEARCH_QUERY';
     
     // Color logic for Price Type
     let typeBadgeClass = 'bg-gray-100 text-gray-600 border-gray-200';
     let TypeIcon = DollarSign;
     
     if (match.type === 'GRATUITO') {
         typeBadgeClass = 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm';
         TypeIcon = Gift;
     } else if (match.type === 'INDIE') {
         typeBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
     } else {
         typeBadgeClass = 'bg-slate-50 text-slate-600 border-slate-200';
     }

     // Layout Compacto para Galeria Massiva (7 Colunas)
     if (!isHero) {
         return (
            <div key={index} className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg hover:border-vingi-300 transition-all duration-300 flex flex-col h-full">
                <div className="relative bg-gray-100 overflow-hidden cursor-pointer aspect-[3/4]" onClick={() => window.open(match.url, '_blank')}>
                    <PatternCardImage src={match.imageUrl} alt={match.patternName} match={match} className="w-full h-full" />
                    
                    <div className="absolute top-1.5 left-1.5 z-10 flex gap-1">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm text-white ${match.similarityScore > 90 ? 'bg-vingi-900' : 'bg-vingi-500'}`}>
                            {Math.round(match.similarityScore)}%
                        </span>
                    </div>
                </div>

                <div className="p-2 flex flex-col flex-1">
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wide truncate mb-0.5">
                        {match.source}
                    </p>
                    <h3 className="font-bold text-gray-900 text-[10px] leading-snug line-clamp-2 mb-1.5 group-hover:text-vingi-600 min-h-[2.5em]">
                        <a href={match.url} target="_blank" rel="noreferrer">{match.patternName}</a>
                    </h3>
                    
                    <div className="mt-auto pt-2 border-t border-gray-50 flex items-center justify-between">
                         <span className={`text-[8px] font-bold border px-1.5 py-0.5 rounded flex items-center gap-1 ${typeBadgeClass}`}>
                             <TypeIcon size={8} />
                             {match.type}
                         </span>
                         <a href={match.url} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-vingi-600 flex items-center gap-0.5 hover:underline group/link">
                            ABRIR <ExternalLink size={8} className="group-hover/link:translate-x-0.5 transition-transform"/>
                         </a>
                    </div>
                </div>
            </div>
         );
     }

     // Hero Card (Destaque)
     return (
        <div key={index} className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl hover:border-vingi-300 transition-all duration-300 flex flex-col md:flex-row md:col-span-2 md:h-[300px]">
            <div className="relative bg-gray-50 overflow-hidden cursor-pointer md:w-5/12 h-64 md:h-full" onClick={() => window.open(match.url, '_blank')}>
                <PatternCardImage src={match.imageUrl} alt={match.patternName} match={match} className="w-full h-full" />
                <div className="absolute top-3 left-3 z-10">
                     <span className="text-xs font-bold px-2 py-1 rounded shadow-md text-white bg-vingi-900">
                        {Math.round(match.similarityScore)}% MATCH
                     </span>
                </div>
            </div>

            <div className="p-5 flex flex-col flex-1 relative justify-center">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                        <Globe size={10} /> {match.source}
                    </p>
                </div>
                <h3 className="font-bold text-gray-900 text-xl leading-tight mb-3 group-hover:text-vingi-600 transition-colors">
                    <a href={match.url} target="_blank" rel="noreferrer">{match.patternName}</a>
                </h3>
                <p className="text-gray-600 text-sm mb-6 line-clamp-3 leading-relaxed">
                   Encontramos este modelo compatível com alta precisão técnica. Recomendamos verificar também as variações no site oficial.
                </p>
                <div className="mt-auto flex gap-3">
                    <button onClick={() => window.open(match.url, '_blank')} className="flex-1 bg-vingi-900 text-white py-3 rounded-lg text-sm font-bold hover:bg-vingi-800 transition-colors shadow-lg shadow-vingi-900/20 flex items-center justify-center gap-2">
                         {isSearchLink ? <Search size={16}/> : <ExternalLink size={16}/>}
                         {isSearchLink ? 'Buscar no Acervo' : 'Acessar Loja Oficial'}
                    </button>
                </div>
            </div>
        </div>
     );
  };

  // --- RENDERIZAR TELA DE HISTÓRICO ---
  const renderHistoryView = () => (
      <div className="p-6 max-w-5xl mx-auto min-h-screen">
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

  // --- RENDER PRINCIPAL ---
  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-gray-800 font-sans">
      <Sidebar 
        currentView={view} 
        onViewChange={setView} 
        onInstallClick={handleInstallClick}
        showInstallButton={showInstallButton}
      />
      
      {/* BANNER FLUTUANTE DE INSTALAÇÃO (Só aparece se disponível e não dispensado) */}
      {showInstallButton && !isInstallDismissed && state === AppState.IDLE && (
          <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full md:w-auto animate-bounce-in">
              <div className="bg-vingi-900 border border-vingi-700 p-4 rounded-xl shadow-2xl flex flex-col gap-3 relative overflow-hidden">
                  {/* Fundo decorativo */}
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

      <main className="flex-1 md:ml-20 pb-20 overflow-y-auto">
        
        {view === 'HISTORY' ? renderHistoryView() : (
            <>
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

            <div className="max-w-[1800px] mx-auto p-4 md:p-6 min-h-[calc(100vh-64px)] flex flex-col">
            {state === AppState.IDLE && (
                <div className="h-[80vh] flex flex-col items-center justify-center p-4 text-center animate-fade-in">
                
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
                    </div>

                    <div className="w-full md:w-80 bg-gray-50 p-8 flex flex-col justify-center">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Opcional</h3>
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Ângulo Secundário</label>
                            <p className="text-xs text-gray-500 mb-3">Costas, lado ou detalhe.</p>
                            <input type="file" ref={secondaryInputRef} onChange={handleSecondaryUpload} accept="image/*" className="hidden" />
                            {!uploadedSecondaryImage ? (
                                <button 
                                    onClick={() => secondaryInputRef.current?.click()}
                                    className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-vingi-400 hover:bg-white hover:text-vingi-500 transition-all"
                                >
                                    <Plus size={24} className="mb-2 opacity-50" />
                                    <span className="text-xs font-medium">Adicionar Vista</span>
                                </button>
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
                            className={`w-full py-3 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
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

            {state === AppState.ANALYZING && (
                <div className="h-[80vh] flex flex-col items-center justify-center">
                <div className="w-full max-w-xs text-center">
                    <div className="relative w-32 h-48 mx-auto bg-white rounded-xl p-1 shadow-2xl mb-6 rotate-3 transition-transform duration-1000">
                        {uploadedImage && <img src={uploadedImage} alt="Analise" className="w-full h-full object-cover rounded-lg" />}
                        <div className="absolute inset-0 bg-vingi-900/20 rounded-xl"></div>
                        <div className="absolute top-0 w-full h-1 bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)] animate-scan z-20"></div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{MOCK_LOADING_STEPS[loadingStep]}</h3>
                    <div className="w-48 h-1.5 bg-gray-100 rounded-full mx-auto overflow-hidden mt-3">
                        <div 
                            className="h-full bg-vingi-500 transition-all duration-500 ease-out"
                            style={{ width: `${((loadingStep + 1) / MOCK_LOADING_STEPS.length) * 100}%` }}
                        />
                    </div>
                </div>
                </div>
            )}

            {state === AppState.SUCCESS && result && (
                <div className="animate-fade-in space-y-8">
                
                {/* PAINEL DE REFERÊNCIA VISUAL (COMPARAÇÃO) */}
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

                {/* BARRA DE FILTROS FLUTUANTE */}
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

                {/* GRID MASSIVO (ATÉ 7 COLUNAS EM TELAS GRANDES) */}
                <div className="min-h-[800px]">
                    {filteredData.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3 md:gap-4">
                            {filteredData.map((match, i) => {
                                if (activeTab === 'ALL' && match === superSuggestion) return null;
                                return renderCatalogCard(match, i);
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm">
                            <p>Nenhum resultado para este filtro.</p>
                        </div>
                    )}
                </div>

                {/* HUB DE CURADORIA E PESQUISA EXPANDIDO */}
                <div className="mt-12 pt-8 border-t border-gray-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-vingi-900 text-white rounded-lg shadow-lg">
                            <Compass size={20} />
                        </div>
                        <div>
                            <h4 className="text-xl font-bold text-gray-900 tracking-tight">Hub de Pesquisa Global</h4>
                            <p className="text-xs text-gray-500">Acesso direto a acervos independentes e marcas internacionais</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                            {/* COLEÇÕES */}
                            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                                <h5 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <Sparkles size={14} className="text-amber-500"/> Coleções Recomendadas
                                </h5>
                                {result.curatedCollections && result.curatedCollections.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {result.curatedCollections.map((collection, idx) => (
                                            <CollectionCard key={idx} collection={collection} />
                                        ))}
                                    </div>
                                ) : <p className="text-xs text-gray-400">Nenhuma coleção encontrada.</p>}
                            </div>

                            {/* DEEP LINKS E ACERVOS */}
                            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                                <h5 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <Search size={14} className="text-blue-500"/> Acervos Independentes & Big 4
                                </h5>
                                {/* Combinação de Links Gerados pela IA + Links Fixos Importantes */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {/* MOOD FABRICS EM DESTAQUE */}
                                    <ResourceLink 
                                        resource={{ 
                                            name: 'Mood Fabrics (Sewciety)', 
                                            type: 'FREE_REPO', 
                                            url: `https://www.moodfabrics.com/blog/?s=${encodeURIComponent(result.category + ' pattern')}`, 
                                            description: 'Milhares de moldes grátis' 
                                        }} 
                                    />
                                    {result.recommendedResources && result.recommendedResources.map((resource, idx) => (
                                        <ResourceLink key={idx} resource={resource} />
                                    ))}
                                    <ResourceLink resource={{ name: 'The Fold Line', type: 'PURCHASE', url: 'https://thefoldline.com', description: 'Maior acervo indie da Europa' }} />
                                    <ResourceLink resource={{ name: 'Makerist', type: 'PURCHASE', url: 'https://www.makerist.com/sewing/patterns', description: 'Plataforma global de PDFs' }} />
                                    <ResourceLink resource={{ name: 'Burda Style', type: 'PURCHASE', url: 'https://www.burdastyle.com', description: 'Acervo clássico alemão' }} />
                                </div>
                            </div>
                    </div>

                    {/* NOVA ÁREA DE BUSCA RÁPIDA EM PLATAFORMAS */}
                    <div className="bg-vingi-900 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-white">
                             <h5 className="text-sm font-bold mb-1">Exploração Externa Rápida</h5>
                             <p className="text-[10px] text-gray-400">Pesquise "{result.patternName}" diretamente em:</p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                             <ExternalSearchButton 
                                name="Google Imagens" 
                                url={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(result.patternName + ' sewing pattern technical drawing moldes')}`}
                                colorClass="bg-blue-600 hover:bg-blue-500"
                                icon={Globe}
                             />
                             <ExternalSearchButton 
                                name="Pinterest" 
                                url={`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(result.patternName + ' sewing pattern moldes')}`}
                                colorClass="bg-red-600 hover:bg-red-500"
                                icon={Share2}
                             />
                             <ExternalSearchButton 
                                name="Etsy" 
                                url={`https://www.etsy.com/search?q=${encodeURIComponent(result.patternName + ' sewing pattern pdf')}`}
                                colorClass="bg-orange-600 hover:bg-orange-500"
                                icon={ShoppingBag}
                             />
                             <ExternalSearchButton 
                                name="Lekala" 
                                url={`https://www.lekala.co/catalog?q=${encodeURIComponent(result.category)}`}
                                colorClass="bg-purple-600 hover:bg-purple-500"
                                icon={Scissors}
                             />
                             <ExternalSearchButton 
                                name="PatternReview" 
                                url={`https://sewing.patternreview.com/cgi-bin/search.pl?search=${encodeURIComponent(result.patternName)}`}
                                colorClass="bg-teal-600 hover:bg-teal-500"
                                icon={Star}
                             />
                             <ExternalSearchButton 
                                name="YouTube" 
                                url={`https://www.youtube.com/results?search_query=${encodeURIComponent(result.patternName + ' sewing pattern tutorial')}`}
                                colorClass="bg-red-700 hover:bg-red-600"
                                icon={ExternalLink}
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

// Ícone auxiliar para o botão Lekala
const Scissors = ({ size, className }: any) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
);
