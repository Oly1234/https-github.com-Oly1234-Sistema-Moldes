
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { analyzeClothingImage } from '../services/geminiService';
import { AppState, PatternAnalysisResult, ScanHistoryItem } from '../types';
import { MOCK_LOADING_STEPS } from '../constants';
import { PatternVisualCard } from '../components/PatternVisualCard';
import { ModuleLandingPage, ModuleHeader } from '../components/Shared';
import { 
    UploadCloud, RefreshCw, Image as ImageIcon, CheckCircle2, Globe, Layers, Sparkles, 
    Share2, BookOpen, ShoppingBag, ExternalLink, Camera, X, Plus, AlertTriangle, Loader2, ScanLine,
    Move, Minimize2, Maximize2, ZoomIn, Scissors, Ruler, Shirt, Info, MousePointer2, FileSearch
} from 'lucide-react';

// --- MODAL FLUTUANTE DE COMPARAÇÃO (REUTILIZADA) ---
const FloatingComparisonModal: React.FC<{ image: string }> = ({ image }) => {
    const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 300 }); 
    const [size, setSize] = useState(180);
    const [isMinimized, setIsMinimized] = useState(false);
    
    const dragOffset = useRef({ x: 0, y: 0 });
    const isDragging = useRef(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        isDragging.current = true;
        dragOffset.current = { 
            x: e.clientX - position.x, 
            y: e.clientY - position.y 
        };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;
        setPosition({
            x: Math.max(0, Math.min(newX, window.innerWidth - size)),
            y: Math.max(0, Math.min(newY, window.innerHeight - 50))
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    if (isMinimized) {
        return (
            <div 
                className="fixed bottom-24 right-4 bg-vingi-900 text-white p-3 rounded-full shadow-2xl z-[100] cursor-pointer hover:scale-110 transition-transform animate-bounce-subtle"
                onClick={() => setIsMinimized(false)}
            >
                <ImageIcon size={24} />
            </div>
        );
    }

    return (
        <div 
            className="fixed z-[90] bg-white rounded-xl shadow-2xl border-2 border-vingi-500 overflow-hidden flex flex-col transition-shadow shadow-md"
            style={{ left: position.x, top: position.y, width: size, touchAction: 'none' }}
        >
            <div 
                className="bg-vingi-900 h-9 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing select-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <span className="text-[10px] font-bold text-white flex items-center gap-1 uppercase tracking-wider"><Move size={10}/> Ref</span>
                <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                    <button onClick={() => setSize(s => Math.min(400, s + 30))} className="text-white/70 hover:text-white"><ZoomIn size={12}/></button>
                    <button onClick={() => setIsMinimized(true)} className="text-white/70 hover:text-white"><Minimize2 size={12}/></button>
                </div>
            </div>
            <div className="relative bg-gray-100 group">
                <img src={image} className="w-full object-contain bg-white pointer-events-none select-none" style={{ maxHeight: size * 1.5 }} />
            </div>
        </div>
    );
};

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

const ExternalSearchButton = ({ name, url, colorClass, icon: Icon }: any) => (
    <a href={url} target="_blank" className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-bold text-white transition-transform hover:scale-105 shadow-sm ${colorClass}`}>
        <Icon size={14} /> {name}
    </a>
);

const FilterTab = ({ label, count, active, onClick, icon: Icon }: any) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${active ? 'bg-vingi-900 text-white shadow-md transform scale-105' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
        {label} <span className="opacity-70 text-[10px] ml-1 bg-white/20 px-1.5 rounded-full">{count}</span>
    </button>
);

const SpecBadge = ({ label, value, icon: Icon }: any) => (
    <div className="flex flex-col bg-white border border-gray-100 rounded-lg p-3 shadow-sm min-w-[120px]">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1">
            <Icon size={10} /> {label}
        </span>
        <span className="text-xs font-bold text-gray-800 capitalize leading-tight">{value || "N/A"}</span>
    </div>
);

export const ScannerSystem: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<PatternAnalysisResult | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedSecondaryImage, setUploadedSecondaryImage] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'EXACT' | 'CLOSE' | 'VIBE'>('ALL');
  
  // PAGINATION CONTROL - START AT 10
  const [visibleCount, setVisibleCount] = useState(10);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [state]);
  useEffect(() => {
    let interval: any;
    if (state === AppState.ANALYZING) {
        setLoadingStep(0);
        interval = setInterval(() => { setLoadingStep(prev => (prev + 1) % MOCK_LOADING_STEPS.length); }, 1500); 
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
      const stored = localStorage.getItem('vingi_scan_history');
      const currentHistory = stored ? JSON.parse(stored) : [];
      const updatedHistory = [newItem, ...currentHistory].slice(50);
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
    setVisibleCount(10); // Reset to first batch
    
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
    }, 100); 
  };
  
  const resetApp = () => {
    setState(AppState.IDLE);
    setResult(null);
    setUploadedImage(null);
    setUploadedSecondaryImage(null);
    setActiveTab('ALL');
    setVisibleCount(10);
    setErrorMsg(null);
  };

  const handleFabClick = () => {
    if (state === AppState.ANALYZING) return;
    if (state === AppState.SUCCESS || state === AppState.ERROR) { resetApp(); return; }
    if (state === AppState.IDLE && uploadedImage) { startAnalysis(); return; }
    if (state === AppState.IDLE && !uploadedImage) { cameraInputRef.current?.click(); }
  };

  const getUniqueMatches = (list: any[]) => {
      const seenUrls = new Set();
      return list.filter(m => {
          if (!m || !m.url) return false;
          if (seenUrls.has(m.url)) return false;
          seenUrls.add(m.url);
          return true;
      });
  };

  const exactMatches = getUniqueMatches(result?.matches?.exact || []);
  const closeMatches = getUniqueMatches(result?.matches?.close || []);
  const vibeMatches = getUniqueMatches(result?.matches?.adventurous || []);
  const allMatches = getUniqueMatches([...exactMatches, ...closeMatches, ...vibeMatches]);

  const getFilteredMatches = () => {
      switch(activeTab) {
          case 'EXACT': return exactMatches;
          case 'CLOSE': return closeMatches;
          case 'VIBE': return vibeMatches;
          default: return allMatches;
      }
  };
  const filteredData = getFilteredMatches();
  const visibleData = filteredData.slice(0, visibleCount);
  const strictQuery = result ? `${result.technicalDna.silhouette} ${result.technicalDna.neckline} pattern` : '';

  // --- RENDERIZADORES ---
  const renderFab = () => {
      let icon = <Camera size={24} className="text-white" />;
      let label: string | null = null;
      let className = "bg-vingi-900 border-2 border-vingi-700 shadow-xl shadow-black/40 w-16 h-16 rounded-full active:scale-95 hover:bg-vingi-800 transition-transform z-50";

      if (state === AppState.ANALYZING) {
          icon = <Loader2 size={24} className="text-white animate-spin" />;
          className = "bg-gray-800 border-gray-700 cursor-wait w-14 h-14 rounded-full";
      } else if (state === AppState.SUCCESS) {
          icon = <RefreshCw size={20} className="text-white" />;
          label = "NOVA BUSCA";
          className = "bg-gray-900 border-gray-700 w-auto px-6 h-12 rounded-full hover:bg-black shadow-xl shadow-black/50";
      } else if (state === AppState.IDLE && uploadedImage) {
          icon = <ScanLine size={20} className="text-white animate-pulse" />;
          label = "PESQUISAR";
          className = "bg-vingi-600 hover:bg-vingi-500 border-2 border-white shadow-xl shadow-vingi-900/50 w-auto px-8 h-14 rounded-full animate-bounce-subtle z-50 ring-4 ring-black/10 scale-105";
      }
      return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 md:hidden z-[60]">
             <button onClick={handleFabClick} className={`flex items-center justify-center gap-2 transition-all duration-300 ease-out transform ${className}`}>
                {icon}
                {label && <span className="text-white font-bold text-sm tracking-wide whitespace-nowrap animate-fade-in">{label}</span>}
             </button>
        </div>
      );
  };

  return (
    <div className="h-full flex flex-col relative overflow-y-auto overflow-x-hidden touch-pan-y" ref={scrollRef}>
        {state === AppState.SUCCESS && uploadedImage && ( <FloatingComparisonModal image={uploadedImage} /> )}
        
        {state !== AppState.ANALYZING && state !== AppState.ERROR && (
            <ModuleHeader 
                icon={ScanLine} 
                title="Caçador de Moldes" 
                subtitle="Engenharia Reversa"
                onAction={state === AppState.SUCCESS ? resetApp : undefined}
                actionLabel="Nova Busca"
            />
        )}

        <div className="max-w-[1800px] mx-auto p-4 md:p-6 min-h-full flex flex-col w-full">
            <input type="file" ref={fileInputRef} onChange={handleMainUpload} accept="image/*" className="hidden" />
            <input type="file" ref={cameraInputRef} onChange={handleMainUpload} accept="image/*" capture="environment" className="hidden" />
            <input type="file" ref={secondaryInputRef} onChange={handleSecondaryUpload} accept="image/*" className="hidden" />

            {state === AppState.IDLE && !uploadedImage && (
                <ModuleLandingPage 
                    icon={ScanLine}
                    title="Caçador de Moldes"
                    description="Faça a engenharia reversa de qualquer roupa. Carregue uma foto para a IA identificar o DNA técnico e encontrar moldes de costura reais para compra ou download."
                    primaryActionLabel="Carregar Foto"
                    onPrimaryAction={() => fileInputRef.current?.click()}
                    features={["DNA Técnico", "Burda Style", "Etsy", "Mood Fabrics"]}
                    partners={["BURDA STYLE", "ETSY PATTERNS", "MOOD FABRICS", "THE FOLD LINE"]}
                    secondaryAction={
                        <div className="h-full flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-2 h-2 rounded-full bg-vingi-500"></span>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Opcional</h3>
                            </div>
                            <button onClick={() => secondaryInputRef.current?.click()} className="w-full h-40 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-white hover:border-vingi-400 transition-all gap-2 bg-white">
                                <Plus size={24} className="opacity-50" />
                                <span className="text-xs font-bold">Adicionar Costas/Detalhe</span>
                            </button>
                        </div>
                    }
                />
            )}

            {state === AppState.IDLE && uploadedImage && (
                // PREVIEW STATE (Ready to Scan)
                <div className="min-h-[80vh] flex flex-col items-center justify-center animate-fade-in">
                    <div className="w-full max-w-lg bg-white p-6 rounded-2xl shadow-xl border border-gray-100 text-center">
                        <div className="relative group mb-6 inline-block w-full">
                            <img src={uploadedImage} alt="Preview" className="w-full h-80 object-contain rounded-xl bg-gray-50 border border-gray-100" />
                            <button onClick={() => setUploadedImage(null)} className="absolute top-3 right-3 p-2 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"><X size={16} /></button>
                            <div className="absolute bottom-3 left-3 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow"><CheckCircle2 size={10} className="inline mr-1"/> PRONTO PARA SCAN</div>
                        </div>
                        
                        <div className="flex justify-center gap-4">
                            <button onClick={() => secondaryInputRef.current?.click()} className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors flex items-center gap-2">
                                {uploadedSecondaryImage ? <CheckCircle2 size={14} className="text-green-500"/> : <Plus size={14}/>} 
                                {uploadedSecondaryImage ? 'Foto Secundária OK' : 'Add Foto Extra'}
                            </button>
                            <button onClick={startAnalysis} className="flex-1 py-3 bg-vingi-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-vingi-800 transition-all flex items-center justify-center gap-2">
                                <FileSearch size={16} /> INICIAR VARREDURA
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {state === AppState.ANALYZING && (
                <div className="flex flex-col items-center justify-center h-[70vh] w-full p-6 animate-fade-in">
                     <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl border-4 border-white ring-1 ring-slate-200 bg-slate-900">
                        <img src={uploadedImage || ''} className="w-full h-full object-cover opacity-60 blur-[2px]" />
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,100,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,100,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
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

            {state === AppState.SUCCESS && result && (
                <div className="animate-fade-in space-y-8 pb-20">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden flex flex-col md:flex-row">
                        <div className="w-full md:w-1/3 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 p-6 flex items-center justify-center">
                            {uploadedImage && <img src={uploadedImage} className="max-h-64 object-contain rounded-lg shadow-md mix-blend-multiply" />}
                        </div>
                        <div className="flex-1 p-6">
                             <div className="mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-0.5 bg-vingi-900 text-white text-[10px] font-bold rounded uppercase tracking-wide">Identificado</span>
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-1">{result.patternName}</h2>
                                <p className="text-sm text-gray-500 max-w-xl">{result.technicalDna.silhouette} with {result.technicalDna.neckline} and {result.technicalDna.sleeve}</p>
                             </div>
                             
                             <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Info size={12}/> Especificações Técnicas</h4>
                             <div className="flex flex-wrap gap-3">
                                 <SpecBadge label="Silhueta" value={result.technicalDna.silhouette} icon={Scissors} />
                                 <SpecBadge label="Decote" value={result.technicalDna.neckline} icon={Shirt} />
                                 <SpecBadge label="Comprimento" value={result.technicalDna.length} icon={Ruler} />
                                 <SpecBadge label="Tecido" value={result.technicalDna.fabric} icon={Layers} />
                                 <SpecBadge label="Ajuste" value={result.technicalDna.fit} icon={Move} />
                             </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between overflow-x-auto pb-2 sticky top-16 bg-[#f8fafc]/90 backdrop-blur z-20 py-2">
                        <h3 className="text-lg font-bold text-gray-800 mr-4 whitespace-nowrap">Resultados ({filteredData.length})</h3>
                        <div className="flex gap-2">
                            <FilterTab label="Todos" count={allMatches.length} active={activeTab === 'ALL'} onClick={() => { setActiveTab('ALL'); setVisibleCount(10); }} icon={Layers} />
                            <FilterTab label="Exatos" count={exactMatches.length} active={activeTab === 'EXACT'} onClick={() => { setActiveTab('EXACT'); setVisibleCount(10); }} icon={CheckCircle2} />
                            <FilterTab label="Estilo" count={closeMatches.length} active={activeTab === 'CLOSE'} onClick={() => { setActiveTab('CLOSE'); setVisibleCount(10); }} icon={Sparkles} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {visibleData.map((match, i) => (
                            match ? <PatternVisualCard key={i} match={match} userReferenceImage={uploadedImage} /> : null
                        ))}
                    </div>
                    
                    {visibleCount < filteredData.length && (
                        <div className="mt-8 flex justify-center flex-col items-center">
                            <p className="text-xs text-gray-400 mb-2">Exibindo {visibleCount} de {filteredData.length} resultados encontrados</p>
                            <button 
                                onClick={() => setVisibleCount(p => p + 10)} 
                                className="px-8 py-3 bg-white border border-gray-300 rounded-xl font-bold shadow-sm hover:bg-gray-50 hover:border-gray-400 text-gray-600 transition-all transform hover:-translate-y-1 flex items-center gap-2"
                            >
                                <Plus size={16}/> Carregar Mais (+10)
                            </button>
                        </div>
                    )}

                    <div className="mt-8 bg-white p-6 rounded-xl border border-gray-200">
                        <h4 className="font-bold mb-4 flex items-center gap-2 text-sm text-gray-500 uppercase tracking-widest"><Globe size={14}/> Pesquisa Global Manual</h4>
                        <div className="flex gap-2 flex-wrap justify-center md:justify-start">
                            <ExternalSearchButton name="Google Imagens" url={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(strictQuery)}`} colorClass="bg-blue-600" icon={Globe} />
                            <ExternalSearchButton name="Pinterest" url={`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(strictQuery)}`} colorClass="bg-red-600" icon={Share2} />
                            <ExternalSearchButton name="Etsy Global" url={`https://www.etsy.com/search?q=${encodeURIComponent(strictQuery + ' sewing pattern')}`} colorClass="bg-orange-500" icon={ShoppingBag} />
                        </div>
                    </div>
                </div>
            )}
        </div>
        {renderFab()}
    </div>
  );
};
