
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
    Layers, UploadCloud, Droplets, Cylinder, Download, RefreshCw, 
    Check, Activity, Eye, EyeOff, Printer, Palette, Share2, Grid3X3,
    ArrowRight, Loader2, Maximize, AlertCircle, GripVertical, CheckCircle2,
    ZoomIn, ZoomOut, Move, RotateCcw, Wand2, Eraser, ScanLine, FileDown,
    LayoutGrid, ChevronUp, ChevronDown
} from 'lucide-react';
import { ModuleLandingPage } from '../components/Shared';
import { PantoneColor } from '../types';

// --- MATH UTILS ---
const hexToRgb = (hex: string) => {
    const bigint = parseInt(hex.replace('#', ''), 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
};

// --- TEXTILE REVISOR ENGINE ---
const applyTextileRevision = (
    masks: Uint8Array[], 
    width: number, 
    height: number,
    colors: PantoneColor[]
): Uint8Array[] => {
    const newMasks = masks.map(m => new Uint8Array(m));
    const totalPixels = width * height;

    // 1. DESPECKLE
    for (let m = 0; m < newMasks.length; m++) {
        const mask = newMasks[m];
        if (colors[m].group?.includes('Fundo')) continue;

        for (let i = 0; i < totalPixels; i++) {
            if (mask[i] > 0 && mask[i] < 255) {
                const x = i % width;
                const up = i - width > 0 ? mask[i - width] : 0;
                const down = i + width < totalPixels ? mask[i + width] : 0;
                const left = x > 0 ? mask[i - 1] : 0;
                const right = x < width - 1 ? mask[i + 1] : 0;
                const neighbors = (up > 0 ? 1 : 0) + (down > 0 ? 1 : 0) + (left > 0 ? 1 : 0) + (right > 0 ? 1 : 0);
                if (neighbors < 2) mask[i] = 0;
            }
        }
    }

    // 2. SMART TRAPPING
    const compositeMap = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
        for (let m = 0; m < newMasks.length; m++) {
            if (newMasks[m][i] > 10) compositeMap[i] = 1;
        }
    }

    for (let i = 0; i < totalPixels; i++) {
        if (compositeMap[i] === 0) {
            const x = i % width;
            let bestMaskIdx = -1;
            let maxWeight = 0;

            for (let m = 0; m < newMasks.length; m++) {
                const mask = newMasks[m];
                const up = i - width > 0 ? mask[i - width] : 0;
                const down = i + width < totalPixels ? mask[i + width] : 0;
                const left = x > 0 ? mask[i - 1] : 0;
                const right = x < width - 1 ? mask[i + 1] : 0;
                
                const weight = up + down + left + right;
                if (weight > maxWeight) {
                    maxWeight = weight;
                    bestMaskIdx = m;
                }
            }

            if (bestMaskIdx !== -1) {
                newMasks[bestMaskIdx][i] = 255;
            }
        }
    }

    return newMasks;
};

// --- SEPARATION ENGINE ---
const processAdvancedSeparation = (
    imgData: ImageData, 
    palette: PantoneColor[]
): Promise<{ masks: string[], rawMasks: Uint8Array[] }> => {
    return new Promise((resolve) => {
        const width = imgData.width;
        const height = imgData.height;
        const data = imgData.data;
        const totalPixels = width * height;
        
        const numColors = palette.length;
        const channelMasks = Array.from({ length: numColors }, () => new Uint8Array(totalPixels));
        const rgbPalette = palette.map(c => hexToRgb(c.hex));

        for (let i = 0; i < totalPixels; i++) {
            const pos = i * 4;
            const r = data[pos], g = data[pos+1], b = data[pos+2];
            
            let candidates = [];
            for (let c = 0; c < numColors; c++) {
                const pr = rgbPalette[c].r, pg = rgbPalette[c].g, pb = rgbPalette[c].b;
                const dist = Math.sqrt((r-pr)**2 + (g-pg)**2 + (b-pb)**2);
                candidates.push({ index: c, dist });
            }
            candidates.sort((a, b) => a.dist - b.dist);
            
            const best = candidates[0];
            const type = palette[best.index].type || 'SOLID';

            if (type === 'SOLID' || type === 'DETAIL') {
                if (best.dist < 100) channelMasks[best.index][i] = 255;
            } 
            else if (type === 'GRADIENT') {
                const intensity = Math.max(0, 255 - (best.dist * 2.5)); 
                channelMasks[best.index][i] = intensity;
            }
            else {
                channelMasks[best.index][i] = 255;
            }
        }

        const maskUrls = channelMasks.map(mask => {
            const cCanvas = document.createElement('canvas');
            cCanvas.width = width; cCanvas.height = height;
            const cCtx = cCanvas.getContext('2d')!;
            const cImgData = cCtx.createImageData(width, height);
            for (let j = 0; j < totalPixels; j++) {
                const val = 255 - mask[j];
                cImgData.data[j*4] = val; cImgData.data[j*4+1] = val; cImgData.data[j*4+2] = val; cImgData.data[j*4+3] = 255;
            }
            cCtx.putImageData(cImgData, 0, 0);
            return cCanvas.toDataURL('image/png');
        });

        resolve({ masks: maskUrls, rawMasks: channelMasks });
    });
};

const compressForLab = (base64Str: string | null): Promise<{ url: string, w: number, h: number }> => {
    return new Promise((resolve, reject) => {
        if (!base64Str) { reject(); return; }
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 1500;
            let w = img.width, h = img.height;
            if (w > maxSize || h > maxSize) {
                if (w > h) { h = Math.round((h * maxSize)/w); w = maxSize; }
                else { w = Math.round((w * maxSize)/h); h = maxSize; }
            }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, w, h);
            resolve({ url: canvas.toDataURL('image/jpeg', 0.9), w, h });
        };
    });
};

export const ColorLab: React.FC = () => {
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [originalDims, setOriginalDims] = useState<{w:number, h:number} | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [status, setStatus] = useState('');
    const [colors, setColors] = useState<PantoneColor[]>([]);
    const [masks, setMasks] = useState<string[]>([]);
    const [rawMasks, setRawMasks] = useState<Uint8Array[]>([]);
    const [layerVisibility, setLayerVisibility] = useState<boolean[]>([]);
    const [viewMode, setViewMode] = useState<'COMPOSITE' | 'SINGLE'>('COMPOSITE');
    const [activeChannel, setActiveChannel] = useState<number | null>(null);
    const [halftoneMode, setHalftoneMode] = useState(false);
    const [isRevised, setIsRevised] = useState(false);
    const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    
    const isDragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const lastDistRef = useRef<number>(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- AUTO FIT EFFECT ---
    useEffect(() => {
        if (originalDims && containerRef.current) {
            const { w, h } = originalDims;
            const container = containerRef.current.getBoundingClientRect();
            // Calcula escala para caber com 90% do espaço
            if (container.width && container.height) {
                const scaleX = (container.width * 0.9) / w;
                const scaleY = (container.height * 0.9) / h;
                const k = Math.min(scaleX, scaleY);
                setTransform({ k: k || 0.5, x: 0, y: 0 });
            }
        }
    }, [originalDims]);

    // --- RENDERIZADOR COMPOSTO ---
    useEffect(() => {
        if (colors.length === 0 || masks.length === 0 || !originalDims) return;
        const renderComposite = async () => {
            const canvas = compositeCanvasRef.current;
            if (!canvas) return;
            if (canvas.width !== originalDims.w) {
                canvas.width = originalDims.w;
                canvas.height = originalDims.h;
            }
            const ctx = canvas.getContext('2d')!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (rawMasks.length > 0) {
                const w = canvas.width;
                const h = canvas.height;
                const finalImgData = ctx.createImageData(w, h);
                const pData = finalImgData.data;

                for (let i = 0; i < w * h; i++) {
                    let r = 255, g = 255, b = 255, a = 0;
                    for (let c = 0; c < colors.length; c++) {
                        if (viewMode === 'SINGLE' && activeChannel !== c) continue;
                        if (viewMode === 'COMPOSITE' && !layerVisibility[c]) continue;

                        const alphaMask = rawMasks[c][i];
                        if (alphaMask === 0) continue;

                        const rgb = hexToRgb(colors[c].hex);
                        const alphaFloat = alphaMask / 255;
                        let effectiveAlpha = alphaFloat;
                        if (halftoneMode && colors[c].type === 'GRADIENT') {
                            const noise = Math.random();
                            effectiveAlpha = alphaFloat > noise ? 1 : 0;
                        }

                        if (effectiveAlpha > 0) {
                            r = (r * rgb.r) / 255;
                            g = (g * rgb.g) / 255;
                            b = (b * rgb.b) / 255;
                            a = 255;
                        }
                    }
                    pData[i*4] = r; pData[i*4+1] = g; pData[i*4+2] = b; pData[i*4+3] = a;
                }
                ctx.putImageData(finalImgData, 0, 0);
            }
        };
        requestAnimationFrame(() => renderComposite());
    }, [colors, masks, rawMasks, layerVisibility, viewMode, activeChannel, halftoneMode, originalDims]);

    // --- ACTIONS ---
    const startSeparation = async (imgBase64: string) => {
        try {
            setStatus("IA: Analisando Grupos Semânticos...");
            const cleanBase64 = imgBase64.split(',')[1];
            const res = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ action: 'ANALYZE_SEPARATION', mainImageBase64: cleanBase64, mainMimeType: 'image/jpeg' }) 
            });
            const data = await res.json();
            if (!data.success || !data.colors) throw new Error("Falha na análise de cor.");
            setColors(data.colors);
            setLayerVisibility(new Array(data.colors.length).fill(true));
            setIsRevised(false);
            setStatus("CPU: Unmixing de Canais (Degradês & Filetes)...");
            const img = new Image(); img.src = imgBase64;
            img.onload = async () => {
                const cvs = document.createElement('canvas'); cvs.width = img.width; cvs.height = img.height;
                const ctx = cvs.getContext('2d')!; ctx.drawImage(img, 0, 0);
                const imgData = ctx.getImageData(0, 0, img.width, img.height);
                const result = await processAdvancedSeparation(imgData, data.colors);
                setMasks(result.masks); setRawMasks(result.rawMasks); setIsAnalyzing(false);
            };
        } catch (e) { console.error(e); setIsAnalyzing(false); alert("Erro no processo de separação."); }
    };

    const runRevisor = async () => {
        if (rawMasks.length === 0 || !originalDims) return;
        setIsAnalyzing(true);
        setStatus("REVISOR TÊXTIL: Limpando ruídos e fazendo trapping...");
        setTimeout(() => {
            const revisedRaw = applyTextileRevision(rawMasks, originalDims.w, originalDims.h, colors);
            setRawMasks(revisedRaw); setIsRevised(true); setIsAnalyzing(false);
        }, 100);
    };

    const downloadChannel = (index: number) => {
        const mask = rawMasks[index];
        const canvas = document.createElement('canvas');
        canvas.width = originalDims!.w; canvas.height = originalDims!.h;
        const ctx = canvas.getContext('2d')!;
        const imgData = ctx.createImageData(canvas.width, canvas.height);
        for (let j = 0; j < mask.length; j++) {
            const val = 255 - mask[j];
            imgData.data[j*4] = val; imgData.data[j*4+1] = val; imgData.data[j*4+2] = val; imgData.data[j*4+3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
        const link = document.createElement('a');
        link.download = `Cilindro_${index+1}_${colors[index].name.replace(/\s/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const downloadAllChannels = async () => {
        if (rawMasks.length === 0) return;
        const confirm = window.confirm(`Baixar ${colors.length} cilindros separadamente?`);
        if (!confirm) return;
        
        setIsAnalyzing(true);
        setStatus("Gerando arquivos...");
        
        for (let i = 0; i < colors.length; i++) {
            downloadChannel(i);
            // Pequeno delay para não travar o navegador
            await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        setIsAnalyzing(false);
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsAnalyzing(true);
            setStatus("Otimizando imagem...");
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const raw = ev.target?.result as string;
                const compressed = await compressForLab(raw);
                setOriginalImage(compressed.url);
                setOriginalDims({ w: compressed.w, h: compressed.h });
                startSeparation(compressed.url);
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleLayer = (index: number) => {
        setLayerVisibility(prev => { const next = [...prev]; next[index] = !next[index]; return next; });
    };

    // ZOOM HANDLERS
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey || e.deltaY) {
            e.preventDefault();
            const scaleChange = -e.deltaY * 0.001;
            const newScale = Math.min(Math.max(0.1, transform.k + scaleChange), 10);
            setTransform(p => ({ ...p, k: newScale }));
        }
    };
    const handlePointerDown = (e: React.PointerEvent) => { isDragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); };
    const handlePointerMove = (e: React.PointerEvent) => { if (!isDragging.current) return; const dx = e.clientX - lastPos.current.x; const dy = e.clientY - lastPos.current.y; setTransform(p => ({ ...p, x: p.x + dx, y: p.y + dy })); lastPos.current = { x: e.clientX, y: e.clientY }; };
    const handlePointerUp = (e: React.PointerEvent) => { isDragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId); };
    const resetView = () => setTransform({ k: 1, x: 0, y: 0 });

    // --- MOBILE PINCH ZOOM HANDLERS ---
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            lastDistRef.current = dist;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (lastDistRef.current > 0) {
                const scaleFactor = dist / lastDistRef.current;
                setTransform(p => ({ ...p, k: Math.max(0.1, Math.min(p.k * scaleFactor, 10)) }));
            }
            lastDistRef.current = dist;
        }
    };

    const groupedColors = useMemo(() => {
        const groups: Record<string, { color: PantoneColor, index: number }[]> = {};
        colors.forEach((c, i) => { const gName = c.group || "Geral"; if (!groups[gName]) groups[gName] = []; groups[gName].push({ color: c, index: i }); });
        return groups;
    }, [colors]);

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white select-none">
            {/* HEADER */}
            <div className="h-14 bg-black border-b border-white/5 flex items-center justify-between px-4 shrink-0 z-50">
                <div className="flex items-center gap-3">
                    <button onClick={() => setOriginalImage(null)} className="md:hidden text-gray-400 hover:text-white"><Layers size={20}/></button>
                    <div>
                        <h1 className="text-xs font-black uppercase tracking-widest text-white leading-none">Color Lab <span className="text-[8px] bg-blue-900 text-blue-300 px-1 rounded ml-1">V3.0</span></h1>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tight">Cylinder Separation Engine</p>
                    </div>
                </div>
                {originalImage && !isAnalyzing && (
                    <div className="flex gap-2">
                        <button onClick={() => { setOriginalImage(null); setMasks([]); setRawMasks([]); setColors([]); }} className="text-[10px] bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 font-bold">Novo</button>
                        <button onClick={downloadAllChannels} className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1"><Download size={12}/> <span className="hidden md:inline">Baixar Tudo</span></button>
                    </div>
                )}
            </div>

            {!originalImage ? (
                <div className="flex-1 bg-[#050505] overflow-y-auto">
                    <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" id="cl-up"/>
                    <ModuleLandingPage icon={Cylinder} title="Separação de Cores IA" description="Engine de separação para cilindros e fotolitos com suporte a degradês e retícula estocástica." primaryActionLabel="Carregar Estampa" onPrimaryAction={() => fileInputRef.current?.click()} features={["Spectral Unmixing", "Degradês & Sombras", "Filetes Nítidos", "Simulação de Retícula"]} versionLabel="COLOR ENGINE 3.0" />
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                    {/* CANVAS AREA */}
                    <div className="flex-1 relative bg-[#080808] overflow-hidden flex flex-col">
                        <div 
                            ref={containerRef} 
                            className="flex-1 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing touch-none" 
                            onWheel={handleWheel} 
                            onPointerDown={handlePointerDown} 
                            onPointerMove={handlePointerMove} 
                            onPointerUp={handlePointerUp}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                        >
                            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                            {isAnalyzing ? (
                                <div className="text-center animate-pulse relative z-50">
                                    <Loader2 size={48} className="text-blue-500 animate-spin mx-auto mb-4"/>
                                    <h3 className="text-xl font-bold text-white">{status}</h3>
                                </div>
                            ) : (
                                <div 
                                    className="relative shadow-2xl transition-transform duration-75 ease-linear will-change-transform bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-[#111] shrink-0" 
                                    style={{ 
                                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`, 
                                        width: originalDims?.w, 
                                        height: originalDims?.h 
                                    }}
                                >
                                    <canvas ref={compositeCanvasRef} className="w-full h-full block" />
                                    {viewMode === 'SINGLE' && activeChannel !== null && <div className="absolute inset-0 border-4 border-blue-500/50 mix-blend-screen pointer-events-none"></div>}
                                </div>
                            )}
                            <div className="absolute bottom-6 left-6 flex gap-2 z-30">
                                <button onClick={() => setTransform(p => ({...p, k: p.k * 1.2}))} className="bg-black/80 p-2 rounded-lg text-white border border-white/10"><ZoomIn size={16}/></button>
                                <button onClick={() => setTransform(p => ({...p, k: p.k * 0.8}))} className="bg-black/80 p-2 rounded-lg text-white border border-white/10"><ZoomOut size={16}/></button>
                                <button onClick={resetView} className="bg-black/80 p-2 rounded-lg text-white border border-white/10"><RotateCcw size={16}/></button>
                            </div>
                        </div>
                    </div>

                    {/* MOBILE BOTTOM SHEET CONTROLS */}
                    {isMobile ? (
                        <div className="bg-[#0a0a0a] border-t border-white/10 z-[150] shadow-2xl safe-area-bottom flex flex-col shrink-0 animate-slide-up">
                            {/* CILINDROS HORIZONTAL */}
                            <div className="h-24 px-4 py-2 flex items-center gap-3 overflow-x-auto no-scrollbar border-b border-white/5 bg-black">
                                {colors.map((color, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => { setActiveChannel(idx); setViewMode('SINGLE'); }}
                                        className={`min-w-[64px] h-[72px] rounded-xl border-2 transition-all relative bg-[#111] shrink-0 flex flex-col items-center justify-center gap-1 ${activeChannel === idx && viewMode === 'SINGLE' ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'border-white/10 opacity-80'}`}
                                    >
                                        <div className="w-8 h-8 rounded-full shadow-inner border border-white/10" style={{ backgroundColor: color.hex }}></div>
                                        <span className="text-[8px] font-black uppercase text-gray-400 truncate w-full text-center px-1">{color.name.split(' ')[0]}</span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleLayer(idx); }} 
                                            className={`absolute top-1 right-1 p-0.5 rounded-full ${layerVisibility[idx] ? 'bg-blue-500 text-white' : 'bg-red-500/50 text-white'}`}
                                        >
                                            {layerVisibility[idx] ? <Eye size={8}/> : <EyeOff size={8}/>}
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* TOOLS ROW */}
                            <div className="h-16 px-4 flex items-center justify-between gap-2 bg-[#0a0a0a]">
                                <button onClick={() => { setViewMode('COMPOSITE'); setActiveChannel(null); }} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase border transition-all ${viewMode === 'COMPOSITE' ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/5 text-gray-500 border-white/10'}`}>Composto</button>
                                <button onClick={() => setHalftoneMode(!halftoneMode)} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase border transition-all ${halftoneMode ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-500 border-white/10'}`}>Retícula</button>
                                <button onClick={runRevisor} disabled={isRevised} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase border transition-all flex items-center justify-center gap-1 ${isRevised ? 'bg-green-900/30 text-green-400 border-green-500/30' : 'bg-purple-600 text-white border-purple-500'}`}>
                                    {isRevised ? <CheckCircle2 size={12}/> : <ScanLine size={12}/>} {isRevised ? 'Ok' : 'Revisar'}
                                </button>
                                <button onClick={downloadAllChannels} className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400"><FileDown size={16}/></button>
                            </div>
                        </div>
                    ) : (
                        /* DESKTOP SIDEBAR */
                        <div className="w-80 bg-[#0a0a0a] border-l border-white/5 flex flex-col z-20 shadow-2xl shrink-0">
                            <div className="p-5 border-b border-white/5">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2"><Palette size={12}/> Cilindros ({colors.length})</h3>
                                <button onClick={runRevisor} disabled={isRevised} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all mb-2 ${isRevised ? 'bg-green-900/30 text-green-400 border border-green-500/30 cursor-default' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'}`}>
                                    {isRevised ? <CheckCircle2 size={14}/> : <ScanLine size={14}/>} {isRevised ? "Revisão Concluída" : "Revisão Têxtil AI"}
                                </button>
                                <div className="flex gap-2 justify-between">
                                    <button onClick={() => setLayerVisibility(new Array(colors.length).fill(true))} className="text-[9px] text-blue-500 hover:underline">Mostrar Todos</button>
                                    <button onClick={() => setLayerVisibility(new Array(colors.length).fill(false))} className="text-[9px] text-red-500 hover:underline">Ocultar Todos</button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                                {Object.entries(groupedColors).map(([groupName, groupItems]) => (
                                    <div key={groupName} className="space-y-2">
                                        <div className="text-[9px] font-black uppercase text-gray-600 px-1 flex items-center gap-2"><div className="h-px bg-white/10 flex-1"></div>{groupName}<div className="h-px bg-white/10 flex-1"></div></div>
                                        {(groupItems as { color: PantoneColor, index: number }[]).map(({ color, index }) => (
                                            <div key={index} className={`group relative p-2 rounded-xl border transition-all flex items-center gap-3 ${activeChannel === index && viewMode === 'SINGLE' ? 'bg-white/10 border-blue-500/50' : 'bg-black border-white/5 hover:bg-white/5'}`}>
                                                <button onClick={(e) => { e.stopPropagation(); toggleLayer(index); }} className={`p-1.5 rounded-lg transition-colors ${layerVisibility[index] ? 'text-blue-400 bg-blue-900/20' : 'text-gray-600 bg-white/5'}`}>{layerVisibility[index] ? <Eye size={14}/> : <EyeOff size={14}/>}</button>
                                                <div className="flex-1 flex items-center gap-3 cursor-pointer" onClick={() => { setActiveChannel(index); setViewMode('SINGLE'); }}>
                                                    <div className="w-8 h-8 rounded-lg shrink-0 shadow-inner border border-white/10 relative overflow-hidden" style={{ backgroundColor: color.hex }}></div>
                                                    <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[10px] font-bold text-gray-300 truncate">{color.name}</span></div><p className="text-[9px] text-gray-500 font-mono">{color.code}</p></div>
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); downloadChannel(index); }} className="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-colors"><Download size={14}/></button>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 border-t border-white/5 bg-[#050505]">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Modo Visualização</span>
                                    <div className="flex bg-white/5 rounded-lg p-0.5"><button onClick={() => { setViewMode('COMPOSITE'); setActiveChannel(null); }} className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase ${viewMode==='COMPOSITE'?'bg-blue-600 text-white':'text-gray-500'}`}>Full</button><button onClick={() => setHalftoneMode(!halftoneMode)} className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase ${halftoneMode?'bg-white text-black':'text-gray-500'}`}>Retícula</button></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
