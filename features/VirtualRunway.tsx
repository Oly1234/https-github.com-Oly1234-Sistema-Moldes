
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, Wand2, UploadCloud, Layers, Move, Eraser, Check, Loader2, Image as ImageIcon, Shirt, RefreshCw, X, Download, MousePointer2, ChevronRight, RotateCw, Sun, Droplets, Zap, Sliders, Sparkles } from 'lucide-react';
import { ModuleHeader, ModuleLandingPage } from '../components/Shared';

// --- HELPERS AVANÇADOS (COLOR PRESERVATION) ---

const rgbToLab = (r: number, g: number, b: number) => {
    let r1 = r / 255, g1 = g / 255, b1 = b / 255;
    r1 = (r1 > 0.04045) ? Math.pow((r1 + 0.055) / 1.055, 2.4) : r1 / 12.92;
    g1 = (g1 > 0.04045) ? Math.pow((g1 + 0.055) / 1.055, 2.4) : g1 / 12.92;
    b1 = (b1 > 0.04045) ? Math.pow((b1 + 0.055) / 1.055, 2.4) : b1 / 12.92;
    let x = (r1 * 0.4124 + g1 * 0.3576 + b1 * 0.1805) / 0.95047;
    let y = (r1 * 0.2126 + g1 * 0.7152 + b1 * 0.0722) / 1.00000;
    let z = (r1 * 0.0193 + g1 * 0.1192 + b1 * 0.9505) / 1.08883;
    x = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
    y = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
    z = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;
    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
};

const createMockupMask = (ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number, toleranceVal: number) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const mask = new Uint8Array(width * height);
    const visited = new Uint8Array(width * height);
    
    const p = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    const [l0, a0, b0] = rgbToLab(data[p], data[p+1], data[p+2]);
    
    const stack = [[Math.floor(startX), Math.floor(startY)]];
    let minX = width, maxX = 0, minY = height, maxY = 0;

    while (stack.length) {
        const [x, y] = stack.pop()!;
        const idx = y * width + x;
        if (visited[idx]) continue;
        visited[idx] = 1;

        const pos = idx * 4;
        const [l, a, b] = rgbToLab(data[pos], data[pos+1], data[pos+2]);
        const dist = Math.sqrt((l-l0)**2 + (a-a0)**2 + (b-b0)**2);

        if (dist < toleranceVal) {
            mask[idx] = 255;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;

            if (x>0) stack.push([x-1,y]); if (x<width-1) stack.push([x+1,y]);
            if (y>0) stack.push([x,y-1]); if (y<height-1) stack.push([x,y+1]);
        }
    }
    
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width; maskCanvas.height = height;
    const mCtx = maskCanvas.getContext('2d')!;
    const mData = mCtx.createImageData(width, height);
    for(let i=0; i<mask.length; i++) {
        if (mask[i]) {
            mData.data[i*4] = 0; mData.data[i*4+1] = 0; mData.data[i*4+2] = 0; mData.data[i*4+3] = 255;
        }
    }
    mCtx.putImageData(mData, 0, 0);

    return { 
        maskCanvas,
        bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
        centerX: minX + (maxX - minX)/2,
        centerY: minY + (maxY - minY)/2
    };
};

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

interface VirtualRunwayProps {
    onNavigateToCreator: () => void;
}

export const VirtualRunway: React.FC<VirtualRunwayProps> = ({ onNavigateToCreator }) => {
    const [step, setStep] = useState<'SEARCH_BASE' | 'SELECT_PATTERN' | 'STUDIO'>('SEARCH_BASE');
    const [searchQuery, setSearchQuery] = useState('');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [whiteBases, setWhiteBases] = useState<string[]>([]);
    const [selectedBase, setSelectedBase] = useState<string | null>(null);
    const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    
    // --- STATE: STUDIO TOOLS ---
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [baseImgObj, setBaseImgObj] = useState<HTMLImageElement | null>(null);
    const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);
    const [appliedMasks, setAppliedMasks] = useState<any[]>([]);
    
    // Controls
    const [patternScale, setPatternScale] = useState(0.5);
    const [patternRotation, setPatternRotation] = useState(0);
    const [patternOpacity, setPatternOpacity] = useState(1); // Normal Mode Opacity
    const [shadowIntensity, setShadowIntensity] = useState(0.7); // Multiply Mode Opacity
    const [wandTolerance, setWandTolerance] = useState(30);
    
    const refInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const transferPattern = localStorage.getItem('vingi_mockup_pattern') || localStorage.getItem('vingi_runway_pattern');
        if (transferPattern) {
            setSelectedPattern(transferPattern);
            localStorage.removeItem('vingi_mockup_pattern');
            localStorage.removeItem('vingi_runway_pattern');
            setStep('SEARCH_BASE'); 
        }
    }, []);

    const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setReferenceImage(ev.target?.result as string);
                setSearchQuery('');
            };
            reader.readAsDataURL(file);
        }
    };

    const searchModels = async () => {
        if (!searchQuery.trim() && !referenceImage) return;
        
        setIsSearching(true);
        setWhiteBases([]);
        setLoadingMessage(referenceImage ? "Analisando Estrutura..." : "Buscando Modelos (Modo Extenso)...");

        try {
            let mainImageBase64 = null;
            if (referenceImage) {
                 const compressed = await compressImage(referenceImage);
                 mainImageBase64 = compressed.split(',')[1];
            }

            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'FIND_WHITE_MODELS', 
                    prompt: searchQuery,
                    mainImageBase64: mainImageBase64 
                })
            });
            const data = await res.json();
            
            if (data.success) {
                setLoadingMessage("Varrendo Acervos (20+ Variações)...");
                if (data.detectedStructure) setSearchQuery(data.detectedStructure);

                if (data.queries) {
                    // Split queries to fetch more results per query
                    const uniqueImages = new Set();
                    
                    const fetchWithRetry = async (q: string) => {
                        const r = await fetch('/api/analyze', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'GET_LINK_PREVIEW', backupSearchTerm: q })
                        });
                        const j = await r.json();
                        return j.image;
                    };

                    const promises = data.queries.map((q: string) => fetchWithRetry(q));
                    const results = await Promise.all(promises);
                    
                    results.forEach((img: any) => { if(img) uniqueImages.add(img); });
                    
                    // Fallback to generate even MORE variations if we don't have enough
                    if (uniqueImages.size < 8) {
                        const extraQueries = data.queries.flatMap((q: string) => [
                            q + " full body", q + " back view", q + " close up", q + " studio shot"
                        ]);
                        const extraPromises = extraQueries.slice(0, 12).map((q: string) => fetchWithRetry(q));
                        const extraResults = await Promise.all(extraPromises);
                        extraResults.forEach((img: any) => { if(img) uniqueImages.add(img); });
                    }

                    setWhiteBases(Array.from(uniqueImages) as string[]);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
            setLoadingMessage('');
        }
    };

    const handleBaseSelect = (imgUrl: string) => {
        setSelectedBase(imgUrl);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imgUrl;
        img.onload = () => {
            setBaseImgObj(img);
            if (selectedPattern) {
                const pImg = new Image();
                pImg.src = selectedPattern;
                pImg.onload = () => {
                    setPatternImgObj(pImg);
                    setStep('STUDIO');
                };
            } else {
                setStep('SELECT_PATTERN');
            }
        };
    };

    const handlePatternUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const res = ev.target?.result as string;
                setSelectedPattern(res);
                const pImg = new Image();
                pImg.src = res;
                pImg.onload = () => {
                    setPatternImgObj(pImg);
                    setStep('STUDIO');
                };
            };
            reader.readAsDataURL(file);
        }
    };

    // --- TRUE COLOR RENDER ENGINE ---
    // Uses Frequency Separation: Base -> Pattern (Normal) -> Shadows (Multiply) -> Highlights (Screen)
    useEffect(() => {
        if (step === 'STUDIO' && canvasRef.current && baseImgObj) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d')!;
            
            const maxW = 1200;
            const ratio = baseImgObj.width / baseImgObj.height;
            canvas.width = Math.min(baseImgObj.width, maxW);
            canvas.height = canvas.width / ratio;
            
            renderCanvas();
        }
    }, [step, baseImgObj, patternImgObj, appliedMasks, patternScale, patternRotation, patternOpacity, shadowIntensity]);

    const renderCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas || !baseImgObj) return;
        const ctx = canvas.getContext('2d')!;
        const w = canvas.width;
        const h = canvas.height;
        
        // 1. LAYER 1: BASE IMAGE (Unmodified color)
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(baseImgObj, 0, 0, w, h);

        if (patternImgObj && appliedMasks.length > 0) {
            appliedMasks.forEach(mask => {
                const maskCanvas = mask.maskCanvas;

                // 2. PATTERN FILL (NORMAL MODE) - Preserves Pattern Colors
                const patternLayer = document.createElement('canvas');
                patternLayer.width = w; patternLayer.height = h;
                const pCtx = patternLayer.getContext('2d')!;
                
                // Mask the pattern
                pCtx.drawImage(maskCanvas, 0, 0);
                pCtx.globalCompositeOperation = 'source-in';
                
                // Draw Pattern
                pCtx.save();
                pCtx.translate(mask.centerX, mask.centerY);
                pCtx.rotate((patternRotation * Math.PI) / 180); 
                pCtx.scale(patternScale, patternScale);         
                const pat = pCtx.createPattern(patternImgObj, 'repeat');
                if (pat) {
                    pCtx.fillStyle = pat;
                    pCtx.fillRect(-4000, -4000, 8000, 8000); 
                }
                pCtx.restore();

                // Apply Pattern to Main (Normal Mode with transparency)
                ctx.save();
                ctx.globalAlpha = patternOpacity; 
                ctx.drawImage(patternLayer, 0, 0);
                ctx.restore();

                // 3. SHADOW EXTRACTION (MULTIPLY) - Adds depth without killing color
                const shadowLayer = document.createElement('canvas');
                shadowLayer.width = w; shadowLayer.height = h;
                const sCtx = shadowLayer.getContext('2d')!;
                
                sCtx.drawImage(maskCanvas, 0, 0);
                sCtx.globalCompositeOperation = 'source-in';
                // Draw original image in Grayscale with Contrast Boost
                sCtx.filter = 'grayscale(100%) contrast(150%) brightness(110%)'; 
                sCtx.drawImage(baseImgObj, 0, 0, w, h);
                sCtx.filter = 'none';

                ctx.save();
                ctx.globalCompositeOperation = 'multiply';
                ctx.globalAlpha = shadowIntensity; // Control shadow darkness
                ctx.drawImage(shadowLayer, 0, 0);
                ctx.restore();

                // 4. HIGHLIGHT RECOVERY (SCREEN/SOFT LIGHT) - Adds shine back
                const highlightLayer = document.createElement('canvas');
                highlightLayer.width = w; highlightLayer.height = h;
                const hCtx = highlightLayer.getContext('2d')!;
                
                hCtx.drawImage(maskCanvas, 0, 0);
                hCtx.globalCompositeOperation = 'source-in';
                hCtx.drawImage(baseImgObj, 0, 0, w, h);
                // Isolate Highlights (Threshold logic simulated)
                
                ctx.save();
                ctx.globalCompositeOperation = 'soft-light'; // Soft light adds nice texture
                ctx.globalAlpha = 0.5; 
                ctx.drawImage(highlightLayer, 0, 0);
                ctx.restore();
            });
        }
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (!canvasRef.current || !baseImgObj || !patternImgObj) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const ctx = canvasRef.current.getContext('2d')!;
        
        // Draw base again to separate context for calculation
        const calcCanvas = document.createElement('canvas');
        calcCanvas.width = canvasRef.current.width; calcCanvas.height = canvasRef.current.height;
        const cCtx = calcCanvas.getContext('2d')!;
        cCtx.drawImage(baseImgObj, 0, 0, calcCanvas.width, calcCanvas.height);

        // Uses current Wand Tolerance
        const result = createMockupMask(cCtx, calcCanvas.width, calcCanvas.height, x, y, wandTolerance);
        
        if (result.bounds.w > 10 && result.bounds.h > 10) {
            setAppliedMasks(prev => [...prev, result]);
        }
    };

    const downloadResult = () => {
        if (canvasRef.current) {
            const link = document.createElement('a');
            link.download = 'vingi-magic-fitting.jpg';
            link.href = canvasRef.current.toDataURL('image/jpeg', 0.95);
            link.click();
        }
    };

    const undoLast = () => {
        setAppliedMasks(prev => prev.slice(0, -1));
    };

    // --- RENDER ---
    return (
        <div className="flex flex-col h-full bg-[#f0f2f5] overflow-hidden">
            <ModuleHeader icon={Camera} title="Provador Mágico" subtitle="Simulação True-Color com Sombras Reais" />
            
            {step === 'SEARCH_BASE' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in overflow-y-auto">
                    <div className="max-w-4xl w-full text-center space-y-8 pb-20">
                        <div className="space-y-4">
                            <h2 className="text-3xl font-bold text-gray-800">Escolha o Modelo</h2>
                            <p className="text-gray-500 max-w-lg mx-auto">
                                Buscaremos até 20 variações de modelos brancos (Mockups) prontos para uso.
                            </p>
                        </div>

                        <div className="relative max-w-xl mx-auto space-y-4">
                            <div className="flex flex-col gap-2">
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && searchModels()}
                                        placeholder="Ex: Vestido Longo de Festa, Camiseta Oversized..."
                                        disabled={!!referenceImage}
                                        className="w-full px-6 py-4 rounded-full border border-gray-300 shadow-sm focus:ring-2 focus:ring-vingi-500 outline-none text-lg pl-14 disabled:bg-gray-100 disabled:text-gray-400"
                                    />
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={24}/>
                                    
                                    <button 
                                        onClick={searchModels}
                                        className="absolute right-2 top-2 bottom-2 bg-vingi-900 text-white px-6 rounded-full font-bold text-sm hover:bg-vingi-800 transition-colors flex items-center gap-2"
                                    >
                                        {isSearching ? <Loader2 className="animate-spin" size={16}/> : <><Sparkles size={16}/> BUSCAR</>}
                                    </button>
                                </div>
                                
                                <div className="flex items-center gap-4 justify-center">
                                    <span className="text-xs text-gray-400 font-bold uppercase">OU</span>
                                </div>

                                <button 
                                    onClick={() => refInputRef.current?.click()}
                                    className={`w-full py-3 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${referenceImage ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 text-gray-500 hover:border-vingi-400 hover:bg-white'}`}
                                >
                                    <input type="file" ref={refInputRef} onChange={handleRefImageUpload} className="hidden" accept="image/*"/>
                                    {referenceImage ? <><Check size={16}/> Imagem Carregada (Toque para trocar)</> : <><ImageIcon size={16}/> Enviar Foto de Referência</>}
                                </button>
                            </div>
                        </div>
                        
                        {isSearching && (
                            <div className="animate-fade-in text-vingi-600 font-bold text-sm flex items-center justify-center gap-2">
                                <Loader2 className="animate-spin" size={16}/> {loadingMessage}
                            </div>
                        )}

                        {whiteBases.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in mt-8 pb-10">
                                {whiteBases.map((url, i) => (
                                    <div 
                                        key={i} 
                                        onClick={() => handleBaseSelect(url)}
                                        className="aspect-[3/4] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:ring-4 hover:ring-vingi-500 transition-all group relative"
                                    >
                                        <img src={url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                            <span className="bg-white text-vingi-900 px-3 py-1 rounded-full text-xs font-bold shadow">SELECIONAR</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {step === 'SELECT_PATTERN' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
                    <div className="max-w-md w-full text-center bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                        <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Layers size={32} className="text-purple-600"/>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Selecione a Estampa</h2>
                        <div className="space-y-3 mt-6">
                            <label className="w-full py-4 border-2 border-dashed border-vingi-300 rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-vingi-50 transition-colors">
                                <UploadCloud size={20} className="text-vingi-500"/>
                                <span className="font-bold text-vingi-700">Carregar Arquivo</span>
                                <input type="file" onChange={handlePatternUpload} accept="image/*" className="hidden"/>
                            </label>
                            
                            <button onClick={onNavigateToCreator} className="w-full py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                                <Search size={20}/> Buscar no Radar (Creator)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {step === 'STUDIO' && (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden animate-fade-in">
                    {/* CANVAS AREA */}
                    <div className="flex-1 bg-gray-200 relative flex items-center justify-center overflow-hidden cursor-crosshair group">
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                        <div className="relative shadow-2xl max-w-full max-h-full">
                            <canvas 
                                ref={canvasRef}
                                onClick={handleCanvasClick}
                                className="block max-w-full max-h-[85vh] object-contain bg-white"
                            />
                             {/* Floating Hint */}
                             <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-xs font-bold pointer-events-none backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                                <MousePointer2 size={14} className="animate-bounce"/> Toque na roupa para aplicar
                             </div>
                        </div>
                    </div>

                    {/* CONTROLS */}
                    <div className="w-full md:w-80 bg-white border-l border-gray-200 flex flex-col z-20 shadow-xl h-64 md:h-full">
                        <div className="p-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                                <Sliders size={16} className="text-vingi-600"/> Studio Control
                            </h3>
                        </div>
                        
                        <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                            {/* Pattern Preview */}
                            <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                <img src={selectedPattern!} className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">Estampa Ativa</p>
                                    <label className="text-xs text-vingi-600 font-bold cursor-pointer hover:underline">
                                        Trocar Arquivo
                                        <input type="file" onChange={handlePatternUpload} className="hidden"/>
                                    </label>
                                </div>
                            </div>

                            {/* Controls Group */}
                            <div className="space-y-5">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><Zap size={10}/> Tolerância (Corte)</span>
                                        <span className="text-[10px] font-bold text-gray-600">{wandTolerance}</span>
                                    </div>
                                    <input type="range" min="5" max="100" value={wandTolerance} onChange={(e) => setWandTolerance(parseInt(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none accent-vingi-500"/>
                                </div>

                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><Move size={10}/> Escala</span>
                                        <span className="text-[10px] font-bold text-gray-600">{Math.round(patternScale * 100)}%</span>
                                    </div>
                                    <input type="range" min="0.1" max="2" step="0.05" value={patternScale} onChange={(e) => setPatternScale(parseFloat(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none accent-vingi-500"/>
                                </div>

                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><RotateCw size={10}/> Rotação</span>
                                        <span className="text-[10px] font-bold text-gray-600">{patternRotation}°</span>
                                    </div>
                                    <input type="range" min="0" max="360" value={patternRotation} onChange={(e) => setPatternRotation(parseInt(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none accent-vingi-500"/>
                                </div>

                                <div className="pt-2 border-t border-gray-100">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase mb-3">Correção de Cor & Sombra</p>
                                    
                                    <div className="mb-4">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-[10px] font-bold text-gray-600 uppercase flex items-center gap-1"><Droplets size={10}/> Opacidade Estampa</span>
                                            <span className="text-[10px] font-bold text-gray-600">{Math.round(patternOpacity * 100)}%</span>
                                        </div>
                                        <input type="range" min="0.1" max="1" step="0.05" value={patternOpacity} onChange={(e) => setPatternOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none accent-blue-500"/>
                                    </div>

                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-[10px] font-bold text-gray-600 uppercase flex items-center gap-1"><Sun size={10}/> Intensidade Sombra</span>
                                            <span className="text-[10px] font-bold text-gray-600">{Math.round(shadowIntensity * 100)}%</span>
                                        </div>
                                        <input type="range" min="0" max="1" step="0.05" value={shadowIntensity} onChange={(e) => setShadowIntensity(parseFloat(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none accent-gray-800"/>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-2 pt-4 border-t border-gray-100">
                                <button onClick={undoLast} disabled={appliedMasks.length === 0} className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 flex items-center justify-center gap-2 disabled:opacity-50">
                                    <Eraser size={14}/> Desfazer Último
                                </button>
                                <button onClick={() => setStep('SEARCH_BASE')} className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 flex items-center justify-center gap-2">
                                    <RefreshCw size={14}/> Trocar Modelo
                                </button>
                                <button onClick={downloadResult} className="w-full py-4 bg-vingi-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-vingi-800 flex items-center justify-center gap-2 mt-2">
                                    <Download size={16}/> Baixar Foto
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
