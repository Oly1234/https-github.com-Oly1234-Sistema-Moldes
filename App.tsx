
import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { analyzeClothingImage } from './services/geminiService';
import { AppState, PatternAnalysisResult, ExternalPatternMatch, CuratedCollection, RecommendedResource, ViewState, ScanHistoryItem } from './types';
import { MOCK_LOADING_STEPS } from './constants';
import { UploadCloud, RefreshCw, ExternalLink, Search, Compass, Image as ImageIcon, CheckCircle2, Globe, Layers, Sparkles, Share2, PenTool, ArrowRightCircle, ShoppingBag, BookOpen, Star, Link as LinkIcon, Camera, Layout, DownloadCloud, AlertCircle, ShoppingCart, Plus, X, DollarSign, Gift, ChevronUp, ChevronDown, History, Clock, Smartphone, Scissors, Eye, MonitorPlay, Ruler, ScanFace } from 'lucide-react';

// --- UTILITÁRIOS DE IMAGEM (STEALTH & PROXY) ---

// Camada 1: Proxy Otimizado (Apenas para IMAGENS diretas)
const getProxiedUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.includes('googleusercontent') || url.includes('bing.net')) return url;
  // output=jpg & q=80: Compressão para velocidade
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=500&h=700&fit=cover&a=attention&output=jpg&q=80&n=-1`;
};

// Camada 2: Extrator de Meta Tags (Open Graph / Twitter Card) - IMAGEM DO PRODUTO
const getMicrolinkImageExtraction = (siteUrl: string) => {
    const encoded = encodeURIComponent(siteUrl);
    // Embed=image.url extrai og:image ou twitter:image
    return `https://api.microlink.io/?url=${encoded}&embed=image.url`;
};

// Camada 3: Screenshot HQ (Vitrine Virtual) - GRID DE RESULTADOS
const getMicrolinkScreenshot = (siteUrl: string) => {
    const encoded = encodeURIComponent(siteUrl);
    
    // SELETORES PARA ESCONDER (Limpa a tela para focar no produto)
    // Inclui GDPR banners comuns em sites europeus (Burda, Makerist) e Overlays do Etsy
    const hideSelectors = encodeURIComponent('#onetrust-banner-sdk, .wt-overlay, #gdpr-single-choice-overlay, .cookie-banner, .popup-overlay, #newsletter-popup, header, nav, .ad-banner, [aria-label="cookie consent"], .ui-toolkit-overlay');

    // CONFIGURAÇÃO STEALTH OTIMIZADA
    // viewport: 1280x800 (Laptop) - Garante que sites responsivos mostrem grid de produtos
    // waitFor: 8s (Tempo para lazy load)
    return `https://api.microlink.io/?url=${encoded}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1280&viewport.height=800&waitFor=8000&hide=${hideSelectors}&overlay.browser=dark&colorScheme=dark&scripts=true`;
};

// --- FUNÇÃO ANTI-404 (Smart Link Sanitizer 2.0) ---
const generateSafeUrl = (match: ExternalPatternMatch): string => {
    const { url, source, patternName } = match;
    const lowerSource = source.toLowerCase();
    const lowerUrl = url.toLowerCase();
    const cleanSearchTerm = encodeURIComponent(patternName.replace(/ pattern| sewing| molde| vestido| dress| pdf| download/gi, '').trim());
    const fullSearchTerm = encodeURIComponent(patternName + ' sewing pattern');

    const isGenericLink = url.split('/').length < 4 && !url.includes('search');

    // 1. ETSY (Prioridade de Busca)
    if (lowerSource.includes('etsy') || lowerUrl.includes('etsy.com')) {
        if (lowerUrl.includes('/search')) return url;
        return `https://www.etsy.com/search?q=${fullSearchTerm}&explicit=1&ship_to=BR`;
    }

    // 2. BURDA STYLE
    if (lowerSource.includes('burda') || lowerUrl.includes('burdastyle')) {
         if (lowerUrl.includes('catalogsearch')) return url;
        return `https://www.burdastyle.com/catalogsearch/result/?q=${cleanSearchTerm}`;
    }

    // 3. MOOD FABRICS
    if (lowerSource.includes('mood') || lowerUrl.includes('moodfabrics')) {
        return `https://www.moodfabrics.com/blog/?s=${cleanSearchTerm}`;
    }

    // 4. AMAZON / EBAY
    if (lowerSource.includes('amazon')) {
        return `https://www.amazon.com/s?k=${fullSearchTerm}`;
    }
    if (lowerSource.includes('ebay')) {
        return `https://www.ebay.com/sch/i.html?_nkw=${fullSearchTerm}`;
    }

    // 5. INDIE BRANDS
    if (lowerSource.includes('mccall') || lowerSource.includes('vogue') || lowerSource.includes('simplicity') || lowerUrl.includes('somethingdelightful')) {
        return `https://simplicity.com/search.php?search_query=${cleanSearchTerm}`;
    }
    
    // 6. MAKERIST / FOLD LINE
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

// --- COMPONENTE: CARD TÉCNICO (FALLBACK CAMADA 4) ---
const TechnicalFallbackCard = ({ match }: { match: ExternalPatternMatch }) => {
    return (
        <div className="w-full h-full bg-[#f8fafc] flex flex-col relative overflow-hidden p-4 group-hover:bg-[#f1f5f9] transition-colors border-b border-gray-100">
            <div className="absolute inset-0 opacity-10 pointer-events-none" 
                 style={{ 
                     backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)', 
                     backgroundSize: '20px 20px' 
                 }} 
            />
            <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-center">
                <div className="mb-3 p-3 bg-white rounded-full shadow-sm border border-gray-200">
                    <Ruler size={20} className="text-vingi-400 opacity-80" />
                </div>
                <h4 className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-1">
                    Molde Digital
                </h4>
                <div className="w-3/4 h-px bg-gray-300 my-2"></div>
                <h3 className="font-serif font-bold text-gray-700 text-sm leading-tight line-clamp-2 px-2">
                    {match.patternName}
                </h3>
            </div>
            <div className="mt-auto flex justify-between items-center w-full pt-2 border-t border-gray-200 border-dashed">
                <span className="text-[9px] font-bold text-gray-500 uppercase">{match.source.substring(0, 10)}</span>
                <span className="text-[9px] font-mono text-gray-400">PDF/A4</span>
            </div>
        </div>
    );
};

// --- COMPONENTE INTELIGENTE DE IMAGEM (LÓGICA DE 4 CAMADAS) ---
const PatternCardImage = ({ src, alt, className, onClick, match }: { src?: string, alt: string, className?: string, onClick?: () => void, match: ExternalPatternMatch }) => {
  // Stage 1: Direct CDN Image
  // Stage 2: Open Graph Extraction (Product Page)
  // Stage 3: Screenshot Stealth (Search Page or Fallback)
  // Stage 4: Technical Card (Final Fallback)
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const safeSiteUrl = generateSafeUrl(match);
  
  // DETECÇÃO AUTOMÁTICA DE PÁGINA DE BUSCA
  // Se for uma busca, pular a extração de Meta Tags (Stage 2) e ir direto para Screenshot (Stage 3)
  // pois Meta Tags de páginas de busca geralmente retornam apenas o logo do site.
  const isSearchPage = safeSiteUrl.includes('search') || 
                       safeSiteUrl.includes('?q=') || 
                       safeSiteUrl.includes('catalogsearch') ||
                       safeSiteUrl.includes('google.com') ||
                       safeSiteUrl.includes('pinterest.com');

  useEffect(() => {
    setIsLoading(true);
    
    // LÓGICA DE DECISÃO INICIAL
    const hasValidDirectImage = src && src.length > 10 && (src.includes('http') || src.startsWith('data:')) && !src.includes('placeholder');

    if (hasValidDirectImage) {
        // CAMADA 1: TEMOS URL DIRETA
        setStage(1);
        setCurrentSrc(getProxiedUrl(src as string));
    } else if (isSearchPage) {
        // CAMADA 3 (FORÇADA): É PÁGINA DE BUSCA -> SCREENSHOT DIRETO
        setStage(3);
        const screenshotUrl = getMicrolinkScreenshot(safeSiteUrl);
        setCurrentSrc(screenshotUrl);
    } else {
        // CAMADA 2: É PÁGINA DE PRODUTO -> TENTAR EXTRAIR FOTO PRINCIPAL
        setStage(2);
        const metaImageUrl = getMicrolinkImageExtraction(safeSiteUrl);
        setCurrentSrc(metaImageUrl);
    }
  }, [src, match.url, safeSiteUrl, isSearchPage]);

  const handleError = () => {
      // ESCALADA DE ERROS (Failover Logic)
      if (stage === 1) {
          // Imagem Direta falhou?
          // Se for busca, vai para Screenshot (3). Se for produto, tenta Meta (2).
          if (isSearchPage) {
             setStage(3);
             setCurrentSrc(getMicrolinkScreenshot(safeSiteUrl));
          } else {
             setStage(2);
             setCurrentSrc(getMicrolinkImageExtraction(safeSiteUrl));
          }
      } else if (stage === 2) {
          // Extração Meta falhou? -> Vai para Screenshot (Último recurso visual)
          setStage(3);
          setCurrentSrc(getMicrolinkScreenshot(safeSiteUrl));
      } else if (stage === 3) {
          // Screenshot falhou? -> Mostra Envelope Técnico (Sem ícones genéricos)
          setStage(4);
          setIsLoading(false);
      }
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const img = e.currentTarget;
      // Anti-Corrupção: Imagens muito pequenas (pixels de tracking ou ícones quebrados) são rejeitadas
      if (img.naturalWidth < 50 || img.naturalHeight < 50) {
          handleError();
      } else {
          setIsLoading(false);
      }
  };

  if (stage === 4) {
      return (
          <div className={`${className} cursor-pointer relative group`} onClick={onClick}>
              <TechnicalFallbackCard match={match} />
          </div>
      );
  }

  // Feedback Visual para o Usuário
  let loadingText = "";
  if (stage === 1) loadingText = "Carregando Imagem...";
  if (stage === 2) loadingText = "Extraindo Foto...";
  if (stage === 3) loadingText = "Capturando Vitrine...";

  return (
    <div className={`${className} relative bg-gray-100 overflow-hidden`}>
        {isLoading && (
            <div className="absolute inset-0 bg-gray-50 z-10 flex flex-col items-center justify-center gap-2 p-4 text-center">
                <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-vingi-500 animate-spin opacity-60"></div>
                <span className="text-[9px] text-gray-400 font-mono tracking-tighter uppercase animate-pulse">
                    {loadingText}
                </span>
            </div>
        )}

        <img
            src={currentSrc}
            alt={alt}
            className={`w-full h-full object-cover object-top transition-all duration-700 group-hover:scale-105 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
            onClick={onClick}
            onError={handleError}
            onLoad={handleLoad}
            crossOrigin="anonymous"
            loading="lazy"
            referrerPolicy="no-referrer"
        />
        
        {!isLoading && (
            <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-60 transition-opacity bg-black/50 px-1 rounded pointer-events-none">
                <span className="text-[8px] text-white font-mono">
                    {stage === 1 ? 'CDN' : stage === 2 ? 'META' : 'SCREEN'}
                </span>
            </div>
        )}
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
  
  // Refs para entrada secundária
  const secondaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryCameraInputRef = useRef<HTMLInputElement>(null);

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

  // --- LÓGICA DO BOTÃO PRINCIPAL (FAB MOBILE) ---
  const handleFabAction = () => {
    // 1. Se estiver analisando, não faz nada
    if (state === AppState.ANALYZING) return;

    // 2. Se já tiver resultados (Sucesso), reseta para Nova Busca
    if (state === AppState.SUCCESS) {
        resetApp();
        setView('HOME');
        return;
    }

    // 3. Se estiver na Home COM Imagem, Inicia a Análise
    if (state === AppState.IDLE && uploadedImage) {
        startAnalysis();
        return;
    }

    // 4. Se estiver na Home SEM Imagem, Abre a Câmera
    if (state === AppState.IDLE && !uploadedImage) {
        setView('HOME');
        // Timeout para garantir renderização do input
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
      const updatedHistory = [newItem, ...history].slice(50); // Manter últimos 50
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

  // Helper para construir queries ultra-específicas usando DNA Técnico
  const getStrictSearchQuery = () => {
      if (!result) return '';
      // Ex: "A-Line Dress V-Neck Raglan Sleeve sewing pattern"
      return `${result.technicalDna.silhouette} ${result.technicalDna.neckline} ${result.technicalDna.sleeve} ${result.category} pattern`;
  };
  
  const strictQuery = getStrictSearchQuery();

  const renderCatalogCard = (match: ExternalPatternMatch, index: number, isHero: boolean = false) => {
     // Sanitiza a URL para abrir no navegador (anti-404)
     const safeUrl = generateSafeUrl(match);
     const isSearchLink = safeUrl.includes('search') || safeUrl.includes('catalogsearch') || match.linkType === 'SEARCH_QUERY';
     
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
                <div className="relative bg-[#f8fafc] overflow-hidden cursor-pointer aspect-[3/4] border-b border-gray-100" onClick={() => window.open(safeUrl, '_blank')}>
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
                        <a href={safeUrl} target="_blank" rel="noreferrer">{match.patternName}</a>
                    </h3>
                    
                    <div className="mt-auto pt-2 border-t border-gray-50 flex items-center justify-between">
                         <span className={`text-[8px] font-bold border px-1.5 py-0.5 rounded flex items-center gap-1 ${typeBadgeClass}`}>
                             <TypeIcon size={8} />
                             {match.type}
                         </span>
                         <a href={safeUrl} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-vingi-600 flex items-center gap-0.5 hover:underline group/link">
                            {isSearchLink ? 'BUSCAR' : 'ABRIR'} <ExternalLink size={8} className="group-hover/link:translate-x-0.5 transition-transform"/>
                         </a>
                    </div>
                </div>
            </div>
         );
     }

     // Hero Card (Destaque)
     return (
        <div key={index} className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl hover:border-vingi-300 transition-all duration-300 flex flex-col md:flex-row md:col-span-2 md:h-[300px]">
            <div className="relative bg-gray-50 overflow-hidden cursor-pointer md:w-5/12 h-64 md:h-full" onClick={() => window.open(safeUrl, '_blank')}>
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
                    <a href={safeUrl} target="_blank" rel="noreferrer">{match.patternName}</a>
                </h3>
                <p className="text-gray-600 text-sm mb-6 line-clamp-3 leading-relaxed">
                   Encontramos este modelo compatível com alta precisão técnica. Recomendamos verificar também as variações no site oficial.
                </p>
                <div className="mt-auto flex gap-3">
                    <button onClick={() => window.open(safeUrl, '_blank')} className="flex-1 bg-vingi-900 text-white py-3 rounded-lg text-sm font-bold hover:bg-vingi-800 transition-colors shadow-lg shadow-vingi-900/20 flex items-center justify-center gap-2">
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
        appState={state}
        hasUploadedImage={!!uploadedImage}
        onViewChange={setView} 
        onInstallClick={handleInstallClick}
        showInstallButton={showInstallButton}
        onFabClick={handleFabAction}
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
                    </div>

                    <div className="w-full md:w-80 bg-gray-50 p-8 flex flex-col justify-center">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Opcional</h3>
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Ângulo Secundário</label>
                            <p className="text-xs text-gray-500 mb-3">Costas, lado ou detalhe.</p>
                            
                            {/* Inputs Invisíveis */}
                            <input type="file" ref={secondaryInputRef} onChange={handleSecondaryUpload} accept="image/*" className="hidden" />
                            <input type="file" ref={secondaryCameraInputRef} onChange={handleSecondaryUpload} accept="image/*" capture="environment" className="hidden" />
                            
                            {!uploadedSecondaryImage ? (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => secondaryInputRef.current?.click()}
                                        className="flex-1 h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-vingi-400 hover:bg-white hover:text-vingi-500 transition-all"
                                    >
                                        <Plus size={24} className="mb-2 opacity-50" />
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

                    {/* SEÇÃO 1: COLEÇÕES RECOMENDADAS (AGORA EM LARGURA TOTAL) */}
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

                    {/* NOVA ÁREA DE BUSCA RÁPIDA (COM QUERIES RESTRITIVAS) */}
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
                                name="Lekala Custom" 
                                url={`https://www.lekala.co/catalog?q=${encodeURIComponent(result.technicalDna.silhouette + ' ' + result.technicalDna.neckline)}`}
                                colorClass="bg-purple-600 hover:bg-purple-500"
                                icon={Scissors}
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
