
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, Wand2, UploadCloud, Layers, Move, Eraser, Check, Loader2, Image as ImageIcon, Shirt, RefreshCw, X, Download, MousePointer2, ChevronRight, RotateCw, Sun, Droplets, Zap, Sliders, Sparkles, Brush, PenTool, Focus } from 'lucide-react';
import { ModuleHeader, ModuleLandingPage } from '../components/Shared';

// --- HELPERS (COLOR & MASKING) ---

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
    
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return null;

    const p = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    const [l0, a0, b0] = rgbToLab(data[p], data[p+1], data[p+2]);
    
    const stack = [[Math.floor(startX), Math.floor(startY)]];
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let pixelCount = 0;

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
            pixelCount++;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;

            if (x>0) stack.push([x-1,y]); if (x<width-1) stack.push([x+1,y]);
            if (y>0) stack.push([x,y-1]); if (y<height-1) stack.push([x,y+1]);
        }
    }
    
    if (pixelCount < 50) return null;

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
    
    // MASKING STATES
    const [appliedMasks, setAppliedMasks] = useState<any[]>([]); // Wand masks
    const [drawingCanvas, setDrawingCanvas] = useState<HTMLCanvasElement | null>(null); // Manual drawing
    
    // Controls
    const [activeTool, setActiveTool] = useState<'WAND' | 'BRUSH' | 'ERASER'>('WAND');
    const [brushSize, setBrushSize] = useState(20);
    const [patternScale, setPatternScale] = useState(0.5);
    const [patternRotation, setPatternRotation] = useState(0);
    const [patternOpacity, setPatternOpacity] = useState(1); 
    const [shadowIntensity, setShadowIntensity] = useState(0.8);
    const [wandTolerance, setWandTolerance] = useState(30);
    const [edgeFeather, setEdgeFeather] = useState(2); // Suavização
    
    const refInputRef = useRef<HTMLInputElement>(null);
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef<{x:number, y:number}|null>(null);

    // --- AUTO-MAGIC MASKING ---
    useEffect(() => {
        if (step === 'STUDIO' && baseImgObj && patternImgObj && appliedMasks.length === 0 && canvasRef.current) {
            // Initialize Drawing Canvas
            const dCanvas = document.createElement('canvas');
            dCanvas.width = canvasRef.current.width;
            dCanvas.height = canvasRef.current.height;
            setDrawingCanvas(dCanvas);

            setTimeout(() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const points = [ { x: cx, y: cy }, { x: cx, y: cy * 0.8 }, { x: cx, y: cy * 1.2 } ];

                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(baseImgObj, 0, 0, canvas.width, canvas.height);
                
                const cCtx = document.createElement('canvas').getContext('2d')!;
                cCtx.canvas.width = canvas.width; cCtx.canvas.height = canvas.height;
                cCtx.drawImage(baseImgObj, 0, 0, canvas.width, canvas.height);

                for (const p of points) {
                    const pixel = ctx.getImageData(p.x, p.y, 1, 1).data;
                    const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
                    if (brightness > 180) {
                        const res = createMockupMask(cCtx, canvas.width, canvas.height, p.x, p.y, 40);
                        if (res && res.bounds.w > canvas.width * 0.1) {
                            setAppliedMasks(prev => [...prev, res]);
                            break;
                        }
                    }
                }
            }, 500);
        }
    }, [step, baseImgObj, patternImgObj]);

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
        setLoadingMessage("Detectando Contraste...");

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
            
            if (data.success && data.queries) {
                setLoadingMessage("Filtrando Bases Claras...");
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
                setWhiteBases(Array.from(uniqueImages) as string[]);
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
                pImg.onload = () => { setPatternImgObj(pImg); setStep('STUDIO'); };
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
                pImg.onload = () => { setPatternImgObj(pImg); setStep('STUDIO'); };
            };
            reader.readAsDataURL(file);
        }
    };

    // --- RENDER ENGINE WITH MANUAL MASKING ---
    useEffect(() => {
        if (step === 'STUDIO' && canvasRef.current && baseImgObj) {
            const canvas = canvasRef.current;
            // Resize canvas only if dimensions change to avoid clearing drawingCanvas
            if (canvas.width !== Math.min(baseImgObj.width, 1200)) {
                const maxW = 1200;
                const ratio = baseImgObj.width / baseImgObj.height;
                canvas.width = Math.min(baseImgObj.width, maxW);
                canvas.height = canvas.width / ratio;
                // Reset drawing canvas to match
                if(drawingCanvas) {
                    drawingCanvas.width = canvas.width;
                    drawingCanvas.height = canvas.height;
                }
            }
            renderCanvas();
        }
    }, [step, baseImgObj, patternImgObj, appliedMasks, drawingCanvas, patternScale, patternRotation, patternOpacity, shadowIntensity, edgeFeather]);

    const renderCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas || !baseImgObj) return;
        const ctx = canvas.getContext('2d')!;
        const w = canvas.width;
        const h = canvas.height;
        
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(baseImgObj, 0, 0, w, h);

        if (patternImgObj) {
            // 1. COMPOSITE MASKS (Wand + Manual)
            const finalMaskCanvas = document.createElement('canvas');
            finalMaskCanvas.width = w; finalMaskCanvas.height = h;
            const fmCtx = finalMaskCanvas.getContext('2d')!;
            
            // Add Wand Masks
            appliedMasks.forEach(mask => {
                fmCtx.drawImage(mask.maskCanvas, 0, 0);
            });
            // Add Manual Drawing
            if (drawingCanvas) {
                fmCtx.drawImage(drawingCanvas, 0, 0);
            }

            // 2. RENDER PATTERN
            const patternLayer = document.createElement('canvas');
            patternLayer.width = w; patternLayer.height = h;
            const pCtx = patternLayer.getContext('2d')!;
            
            // Apply Softness (Feather)
            if (edgeFeather > 0) {
                pCtx.filter = `blur(${edgeFeather}px)`;
            }
            pCtx.drawImage(finalMaskCanvas, 0, 0);
            pCtx.filter = 'none';
            pCtx.globalCompositeOperation = 'source-in';
            
            pCtx.save();
            // Centering logic approx
            pCtx.translate(w/2, h/2);
            pCtx.rotate((patternRotation * Math.PI) / 180); 
            pCtx.scale(patternScale, patternScale);         
            const pat = pCtx.createPattern(patternImgObj, 'repeat');
            if (pat) {
                pCtx.fillStyle = pat;
                pCtx.fillRect(-4000, -4000, 8000, 8000); 
            }
            pCtx.restore();

            // Apply to Main Canvas
            ctx.save();
            ctx.globalAlpha = patternOpacity; 
            ctx.drawImage(patternLayer, 0, 0);
            ctx.restore();

            // 3. SHADOWS (Multiply)
            const shadowLayer = document.createElement('canvas');
            shadowLayer.width = w; shadowLayer.height = h;
            const sCtx = shadowLayer.getContext('2d')!;
            if (edgeFeather > 0) sCtx.filter = `blur(${edgeFeather}px)`;
            sCtx.drawImage(finalMaskCanvas, 0, 0);
            sCtx.filter = 'none';
            sCtx.globalCompositeOperation = 'source-in';
            sCtx.filter = 'grayscale(100%) contrast(150%) brightness(110%)'; 
            sCtx.drawImage(baseImgObj, 0, 0, w, h);
            
            ctx.save();
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = shadowIntensity; 
            ctx.drawImage(shadowLayer, 0, 0);
            ctx.restore();

            // 4. HIGHLIGHTS (Screen)
            const highlightLayer = document.createElement('canvas');
            highlightLayer.width = w; highlightLayer.height = h;
            const hCtx = highlightLayer.getContext('2d')!;
            if (edgeFeather > 0) hCtx.filter = `blur(${edgeFeather}px)`;
            hCtx.drawImage(finalMaskCanvas, 0, 0);
            hCtx.filter = 'none';
            hCtx.globalCompositeOperation = 'source-in';
            hCtx.drawImage(baseImgObj, 0, 0, w, h);
            
            ctx.save();
            ctx.globalCompositeOperation = 'soft-light'; 
            ctx.globalAlpha = 0.4; 
            ctx.drawImage(highlightLayer, 0, 0);
            ctx.restore();
        }
    };

    // --- INTERACTION HANDLERS ---
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (activeTool === 'WAND') {
            if (!baseImgObj) return;
            const cCtx = document.createElement('canvas').getContext('2d')!;
            cCtx.canvas.width = canvasRef.current.width;
            cCtx.canvas.height = canvasRef.current.height;
            cCtx.drawImage(baseImgObj, 0, 0, cCtx.canvas.width, cCtx.canvas.height);
            const result = createMockupMask(cCtx, cCtx.canvas.width, cCtx.canvas.height, x, y, wandTolerance);
            if (result && result.bounds.w > 5) setAppliedMasks(prev => [...prev, result]);
        } else {
            isDrawingRef.current = true;
            lastPosRef.current = { x, y };
            draw(x, y);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawingRef.current || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        draw(x, y);
        lastPosRef.current = { x, y };
    };

    const handleMouseUp = () => {
        isDrawingRef.current = false;
        lastPosRef.current = null;
        renderCanvas(); // Re-render final result
    };

    const draw = (x: number, y: number) => {
        if (!drawingCanvas) return;
        const ctx = drawingCanvas.getContext('2d')!;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brushSize;
        
        if (activeTool === 'BRUSH') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = 'white'; // Mask color
        } else {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'black';
        }

        ctx.beginPath();
        if (lastPosRef.current) {
            ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        } else {
            ctx.moveTo(x, y);
        }
        ctx.lineTo(x, y);
        ctx.stroke();
        
        // Immediate visual feedback by calling render
        renderCanvas();
    };

    const clearMasks = () => {
        setAppliedMasks([]);
        if (drawingCanvas) {
            const ctx = drawingCanvas.getContext('2d')!;
            ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        }
        renderCanvas();
    };

    const downloadResult = () => {
        if (canvasRef.current) {
            const link = document.createElement('a');
            link.download = 'vingi-look.jpg';
            link.href = canvasRef.current.toDataURL('image/jpeg', 0.95);
            link.click();
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f0f2f5] overflow-hidden">
            <ModuleHeader icon={Camera} title="Provador Mágico" subtitle="Simulação Realista em Modelos" />
            
            {step === 'SEARCH_BASE' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in overflow-y-auto">
                    <div className="max-w-4xl w-full text-center space-y-8 pb-20">
                        <h2 className="text-3xl font-bold text-gray-800">Escolha o Modelo</h2>
                        <div className="relative max-w-xl mx-auto space-y-4">
                            <div className="relative">
                                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchModels()} placeholder="Ex: Vestido de Festa, Camisa Social..." disabled={!!referenceImage} className="w-full px-6 py-4 rounded-full border border-gray-300 shadow-sm focus:ring-2 focus:ring-vingi-500 outline-none text-lg pl-14 disabled:bg-gray-100 disabled:text-gray-400" />
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={24}/>
                                <button onClick={searchModels} className="absolute right-2 top-2 bottom-2 bg-vingi-900 text-white px-6 rounded-full font-bold text-sm hover:bg-vingi-800 transition-colors flex items-center gap-2">
                                    {isSearching ? <Loader2 className="animate-spin" size={16}/> : <><Sparkles size={16}/> BUSCAR</>}
                                </button>
                            </div>
                            <div className="flex items-center gap-4 justify-center"><span className="text-xs text-gray-400 font-bold uppercase">OU</span></div>
                            <button onClick={() => refInputRef.current?.click()} className={`w-full py-3 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${referenceImage ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 text-gray-500 hover:border-vingi-400 hover:bg-white'}`}>
                                <input type="file" ref={refInputRef} onChange={handleRefImageUpload} className="hidden" accept="image/*"/>
                                {referenceImage ? <><Check size={16}/> Imagem Carregada</> : <><ImageIcon size={16}/> Usar Foto de Referência</>}
                            </button>
                        </div>
                        {isSearching && <div className="animate-fade-in text-vingi-600 font-bold text-sm flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={16}/> {loadingMessage}</div>}
                        {whiteBases.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in mt-8 pb-10">
                                {whiteBases.map((url, i) => (
                                    <div key={i} onClick={() => handleBaseSelect(url)} className="aspect-[3/4] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:ring-4 hover:ring-vingi-500 transition-all group relative">
                                        <img src={url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                            <span className="bg-white text-vingi-900 px-3 py-1 rounded-full text-xs font-bold shadow">ESCOLHER</span>
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
                        <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6"><Layers size={32} className="text-purple-600"/></div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Selecione o Tecido</h2>
                        <div className="space-y-3 mt-6">
                            <label className="w-full py-4 border-2 border-dashed border-vingi-300 rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-vingi-50 transition-colors">
                                <UploadCloud size={20} className="text-vingi-500"/> <span className="font-bold text-vingi-700">Carregar Estampa</span>
                                <input type="file" onChange={handlePatternUpload} accept="image/*" className="hidden"/>
                            </label>
                            <button onClick={onNavigateToCreator} className="w-full py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"><Search size={20}/> Buscar no Radar (Creator)</button>
                        </div>
                    </div>
                </div>
            )}

            {step === 'STUDIO' && (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden animate-fade-in">
                    <div className="flex-1 bg-gray-200 relative flex items-center justify-center overflow-hidden cursor-crosshair group">
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                        <div className="relative shadow-2xl max-w-full max-h-full">
                            <canvas ref={canvasRef} 
                                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
                                className="block max-w-full max-h-[85vh] object-contain bg-white" 
                                style={{ cursor: activeTool === 'WAND' ? 'crosshair' : 'none' }}
                            />
                            {/* CUSTOM CURSOR FOR BRUSH */}
                            {activeTool !== 'WAND' && (
                                <div className="pointer-events-none fixed z-50 rounded-full border-2 border-black bg-white/30 mix-blend-difference" 
                                     style={{ width: brushSize, height: brushSize, transform: 'translate(-50%, -50%)', left: lastPosRef.current?.x, top: lastPosRef.current?.y }}
                                />
                            )}
                             {appliedMasks.length === 0 && !drawingCanvas && (
                                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white px-6 py-3 rounded-full text-sm font-bold pointer-events-none backdrop-blur animate-pulse flex items-center gap-2">
                                    <Sparkles size={16} /> Aplicando Automaticamente...
                                 </div>
                             )}
                        </div>
                    </div>

                    <div className="w-full md:w-80 bg-white border-l border-gray-200 flex flex-col z-20 shadow-xl h-64 md:h-full">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm"><Sliders size={16} className="text-vingi-600"/> Fit Studio</h3>
                            <button onClick={() => setStep('SEARCH_BASE')} className="text-[10px] bg-white border px-2 py-1 rounded hover:bg-gray-50">Trocar Modelo</button>
                        </div>
                        
                        <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                            {/* TOOLS PALETTE */}
                            <div className="bg-gray-100 p-1.5 rounded-xl flex gap-1 shadow-inner">
                                <button onClick={() => setActiveTool('WAND')} className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-1 text-[9px] font-bold transition-all ${activeTool==='WAND' ? 'bg-white shadow text-vingi-600' : 'text-gray-500 hover:bg-gray-200'}`}>
                                    <Wand2 size={18}/> Varinha
                                </button>
                                <button onClick={() => setActiveTool('BRUSH')} className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-1 text-[9px] font-bold transition-all ${activeTool==='BRUSH' ? 'bg-white shadow text-vingi-600' : 'text-gray-500 hover:bg-gray-200'}`}>
                                    <Brush size={18}/> Pincel
                                </button>
                                <button onClick={() => setActiveTool('ERASER')} className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-1 text-[9px] font-bold transition-all ${activeTool==='ERASER' ? 'bg-white shadow text-vingi-600' : 'text-gray-500 hover:bg-gray-200'}`}>
                                    <Eraser size={18}/> Borracha
                                </button>
                            </div>

                            {activeTool !== 'WAND' && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase"><span>Tamanho Pincel</span><span>{brushSize}px</span></div>
                                    <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none accent-vingi-600"/>
                                </div>
                            )}

                            {activeTool === 'WAND' && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase"><span>Tolerância</span><span>{wandTolerance}</span></div>
                                    <input type="range" min="5" max="100" value={wandTolerance} onChange={(e) => setWandTolerance(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none accent-vingi-600"/>
                                </div>
                            )}

                            <div className="w-full h-px bg-gray-100 my-2"></div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between mb-1"><span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><Focus size={10}/> Suavizar Borda</span><span className="text-[10px] font-bold text-gray-600">{edgeFeather}px</span></div>
                                    <input type="range" min="0" max="10" step="0.5" value={edgeFeather} onChange={(e) => setEdgeFeather(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none accent-purple-500"/>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><Move size={10}/> Tamanho</span><span className="text-[10px] font-bold text-gray-600">{Math.round(patternScale * 100)}%</span></div>
                                    <input type="range" min="0.1" max="2" step="0.05" value={patternScale} onChange={(e) => setPatternScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none accent-vingi-500"/>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><RotateCw size={10}/> Rotação</span><span className="text-[10px] font-bold text-gray-600">{patternRotation}°</span></div>
                                    <input type="range" min="0" max="360" value={patternRotation} onChange={(e) => setPatternRotation(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none accent-vingi-500"/>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><span className="text-[10px] font-bold text-gray-600 uppercase flex items-center gap-1"><Sun size={10}/> Sombras (Realismo)</span><span className="text-[10px] font-bold text-gray-600">{Math.round(shadowIntensity * 100)}%</span></div>
                                    <input type="range" min="0" max="1" step="0.05" value={shadowIntensity} onChange={(e) => setShadowIntensity(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none accent-gray-800"/>
                                </div>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-gray-100">
                                <button onClick={clearMasks} disabled={appliedMasks.length === 0 && !drawingCanvas} className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 flex items-center justify-center gap-2 disabled:opacity-50"><Eraser size={14}/> Limpar Tudo</button>
                                <button onClick={downloadResult} className="w-full py-4 bg-vingi-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-vingi-800 flex items-center justify-center gap-2 mt-2"><Download size={16}/> Salvar Mockup</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
