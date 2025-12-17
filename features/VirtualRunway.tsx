
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, Wand2, UploadCloud, Layers, Move, Eraser, Check, Loader2, Image as ImageIcon, Shirt, RefreshCw, X, Download, MousePointer2, ChevronRight, RotateCw, Sun, Droplets, Zap, Sliders, Sparkles, Brush, PenTool, Focus, ShieldCheck, Hand, ZoomIn, ZoomOut, RotateCcw, BrainCircuit, Maximize, Undo2, Grid } from 'lucide-react';
import { ModuleHeader, ModuleLandingPage } from '../components/Shared';

// --- HELPERS MATEMÁTICOS ---

const createMockupMask = (ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number, tolerance: number) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d')!;
    const maskImgData = maskCtx.createImageData(width, height);
    const maskData = maskImgData.data;

    const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    // Proteção contra clique fora
    if (startPos < 0 || startPos >= data.length) return null;

    const r0 = data[startPos];
    const g0 = data[startPos+1];
    const b0 = data[startPos+2];

    const visited = new Uint8Array(width * height);
    const stack = [[Math.floor(startX), Math.floor(startY)]];

    let minX = width, maxX = 0, minY = height, maxY = 0;
    let pixelCount = 0;

    while (stack.length) {
        const [x, y] = stack.pop()!;
        const idx = y * width + x;
        if (visited[idx]) continue;
        visited[idx] = 1;

        const pos = idx * 4;
        const r = data[pos];
        const g = data[pos+1];
        const b = data[pos+2];

        const diff = Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0);

        if (diff <= tolerance * 3) {
            maskData[pos] = 255;     // R
            maskData[pos+1] = 255;   // G
            maskData[pos+2] = 255;   // B
            maskData[pos+3] = 255;   // Alpha

            pixelCount++;
            if(x<minX) minX=x; if(x>maxX) maxX=x; if(y<minY) minY=y; if(y>maxY) maxY=y;

            if (x > 0) stack.push([x-1, y]);
            if (x < width - 1) stack.push([x+1, y]);
            if (y > 0) stack.push([x, y-1]);
            if (y < height - 1) stack.push([x, y+1]);
        }
    }

    if (pixelCount < 50) return null; // Ruído

    maskCtx.putImageData(maskImgData, 0, 0);
    return { maskCanvas, referenceColor: {r: r0, g: g0, b: b0}, bounds: { minX, minY, maxX, maxY } };
};

// Algoritmo Auto-Fit (Simulação de IA de Segmentação)
const performAutoSegmentation = (baseImg: HTMLImageElement) => {
    const w = baseImg.width;
    const h = baseImg.height;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(baseImg, 0, 0);
    
    // Heurística: Roupas para mockup geralmente estão no centro e são claras (para contraste)
    // Escaneia uma grade central para encontrar o ponto mais "branco/claro"
    const imgData = ctx.getImageData(0, 0, w, h).data;
    let bestX = w/2, bestY = h/2;
    let maxLum = 0;

    const centerX = Math.floor(w/2);
    const centerY = Math.floor(h/2);
    const rangeX = Math.floor(w * 0.2); // 20% do centro
    const rangeY = Math.floor(h * 0.4); // 40% da altura central

    for(let y = centerY - rangeY; y < centerY + rangeY; y+=10) {
        for(let x = centerX - rangeX; x < centerX + rangeX; x+=10) {
            const idx = (y * w + x) * 4;
            const lum = (imgData[idx] + imgData[idx+1] + imgData[idx+2]) / 3;
            // Procura alta luminosidade (branco) mas não estourada (255 puro as vezes é fundo)
            if (lum > maxLum && lum < 250) {
                maxLum = lum;
                bestX = x;
                bestY = y;
            }
        }
    }

    // Executa o Flood Fill a partir desse "melhor ponto"
    return createMockupMask(ctx, w, h, bestX, bestY, 40); // Tolerância média
};

interface VirtualRunwayProps {
    onNavigateToCreator: () => void;
}

export const VirtualRunway: React.FC<VirtualRunwayProps> = ({ onNavigateToCreator }) => {
    const [step, setStep] = useState<'SEARCH_BASE' | 'SELECT_PATTERN' | 'STUDIO'>('SEARCH_BASE');
    
    // Assets
    const [referenceImage, setReferenceImage] = useState<string | null>(null); // Base Model
    const [selectedPattern, setSelectedPattern] = useState<string | null>(null); // Texture
    const [whiteBases, setWhiteBases] = useState<string[]>([]);
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    
    // Studio State
    const canvasRef = useRef<HTMLCanvasElement>(null); 
    const containerRef = useRef<HTMLDivElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); 
    const [baseImgObj, setBaseImgObj] = useState<HTMLImageElement | null>(null);
    const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);
    const [history, setHistory] = useState<ImageData[]>([]); // UndoMask history

    // Viewport (Zoom/Pan)
    const [view, setView] = useState({ x: 0, y: 0, k: 1 });
    const isPanning = useRef(false);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);
    const lastDistRef = useRef<number>(0);

    // Tools & Params
    const [activeTool, setActiveTool] = useState<'WAND' | 'BRUSH' | 'ERASER' | 'HAND' | 'AUTO'>('AUTO');
    const [brushSize, setBrushSize] = useState(30);
    const [wandTolerance, setWandTolerance] = useState(30);
    const [smartBrush, setSmartBrush] = useState(true);
    
    // Rendering Params
    const [patternScale, setPatternScale] = useState(0.5);
    const [patternRotation, setPatternRotation] = useState(0);
    const [shadowIntensity, setShadowIntensity] = useState(0.7); // Multiply
    const [highlightIntensity, setHighlightIntensity] = useState(0.3); // Soft Light
    const [patternOpacity, setPatternOpacity] = useState(0.95);
    const [edgeFeather, setEdgeFeather] = useState(1);

    // Interaction Refs
    const isDrawingRef = useRef(false);
    const lastDrawPos = useRef<{x: number, y: number} | null>(null);
    const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null); // Screen coords for div cursor
    const refInputRef = useRef<HTMLInputElement>(null);

    // --- INITIALIZATION ---
    useEffect(() => {
        if (referenceImage) {
            const img = new Image(); img.src = referenceImage; img.crossOrigin = "anonymous";
            img.onload = () => {
                setBaseImgObj(img);
                // Reset Mask
                const mCanvas = document.createElement('canvas');
                mCanvas.width = img.width; mCanvas.height = img.height;
                maskCanvasRef.current = mCanvas;
                setHistory([]);
                
                // Auto Zoom Fit
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const k = Math.min(rect.width / img.width, rect.height / img.height) * 0.85;
                    setView({ x: 0, y: 0, k });
                }
            };
        }
    }, [referenceImage]);

    useEffect(() => {
        if (selectedPattern) {
            const img = new Image(); img.src = selectedPattern; img.crossOrigin = "anonymous";
            img.onload = () => setPatternImgObj(img);
        }
    }, [selectedPattern]);

    // --- AUTO FIT ON ENTER STUDIO ---
    useEffect(() => {
        if (step === 'STUDIO' && baseImgObj && !history.length && activeTool === 'AUTO') {
            handleAutoFit();
        }
    }, [step, baseImgObj, activeTool]);

    // --- RENDER ENGINE ---
    const renderCanvas = () => {
        const canvas = canvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!canvas || !baseImgObj || !maskCanvas) return;
        
        // Sync Dimensions
        if (canvas.width !== baseImgObj.width) {
            canvas.width = baseImgObj.width; canvas.height = baseImgObj.height;
        }

        const ctx = canvas.getContext('2d')!;
        const w = canvas.width; const h = canvas.height;
        
        // 1. Draw Base
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(baseImgObj, 0, 0, w, h);

        if (!patternImgObj) return;

        // 2. Prepare Pattern Layer (Clipped by Mask)
        const patCanvas = document.createElement('canvas'); patCanvas.width = w; patCanvas.height = h;
        const pCtx = patCanvas.getContext('2d')!;
        
        // Draw Mask with Feather
        if (edgeFeather > 0) pCtx.filter = `blur(${edgeFeather}px)`;
        pCtx.drawImage(maskCanvas, 0, 0);
        pCtx.filter = 'none';
        
        // Composite Pattern Source-In
        pCtx.globalCompositeOperation = 'source-in';
        pCtx.save();
        pCtx.translate(w/2, h/2);
        pCtx.rotate((patternRotation * Math.PI) / 180);
        pCtx.scale(patternScale, patternScale);
        const pat = pCtx.createPattern(patternImgObj, 'repeat');
        if (pat) { pCtx.fillStyle = pat; pCtx.fillRect(-w*2, -h*2, w*4, h*4); }
        pCtx.restore();

        // 3. Draw Pattern Layer to Main
        ctx.save();
        ctx.globalAlpha = patternOpacity;
        ctx.drawImage(patCanvas, 0, 0);
        ctx.restore();

        // 4. Realism: Shadows (Multiply)
        const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = w; shadowCanvas.height = h;
        const sCtx = shadowCanvas.getContext('2d')!;
        if (edgeFeather > 0) sCtx.filter = `blur(${edgeFeather}px)`;
        sCtx.drawImage(maskCanvas, 0, 0);
        sCtx.filter = 'none';
        sCtx.globalCompositeOperation = 'source-in';
        // Enhance shadows contrast
        sCtx.filter = 'grayscale(100%) contrast(150%) brightness(120%)';
        sCtx.drawImage(baseImgObj, 0, 0);
        
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = shadowIntensity;
        ctx.drawImage(shadowCanvas, 0, 0);
        ctx.restore();

        // 5. Realism: Highlights/Folds (Soft Light or Screen)
        // Helps preserve the fabric sheen
        const lightCanvas = document.createElement('canvas'); lightCanvas.width = w; lightCanvas.height = h;
        const lCtx = lightCanvas.getContext('2d')!;
        if (edgeFeather > 0) lCtx.filter = `blur(${edgeFeather}px)`;
        lCtx.drawImage(maskCanvas, 0, 0);
        lCtx.filter = 'none';
        lCtx.globalCompositeOperation = 'source-in';
        lCtx.filter = 'grayscale(100%) contrast(120%)';
        lCtx.drawImage(baseImgObj, 0, 0);

        ctx.save();
        ctx.globalCompositeOperation = 'soft-light'; // Soft light is better for folds than screen
        ctx.globalAlpha = highlightIntensity;
        ctx.drawImage(lightCanvas, 0, 0);
        ctx.restore();
    };

    useEffect(() => { requestAnimationFrame(renderCanvas); }, [baseImgObj, patternImgObj, patternScale, patternRotation, patternOpacity, shadowIntensity, highlightIntensity, edgeFeather]);

    // --- ACTIONS ---
    const saveHistory = () => {
        if (!maskCanvasRef.current) return;
        const ctx = maskCanvasRef.current.getContext('2d')!;
        const data = ctx.getImageData(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
        setHistory(prev => [...prev.slice(-10), data]);
    };

    const undoMask = () => {
        if (history.length > 0 && maskCanvasRef.current) {
            const prev = history[history.length - 1];
            const ctx = maskCanvasRef.current.getContext('2d')!;
            ctx.putImageData(prev, 0, 0);
            setHistory(h => h.slice(0, -1));
            renderCanvas();
        }
    };

    const handleAutoFit = () => {
        if (!baseImgObj || !maskCanvasRef.current) return;
        saveHistory();
        const res = performAutoSegmentation(baseImgObj);
        if (res) {
            const ctx = maskCanvasRef.current.getContext('2d')!;
            ctx.drawImage(res.maskCanvas, 0, 0);
            renderCanvas();
            
            // Auto Adjust View to Bounds
            if (containerRef.current && res.bounds) {
                const rect = containerRef.current.getBoundingClientRect();
                const contentW = res.bounds.maxX - res.bounds.minX;
                const contentH = res.bounds.maxY - res.bounds.minY;
                const k = Math.min(rect.width / contentW, rect.height / contentH) * 0.6;
                // Center on the garment
                const cx = (res.bounds.minX + res.bounds.maxX) / 2;
                const cy = (res.bounds.minY + res.bounds.maxY) / 2;
                // This view logic is simplified, full implementation needs viewport math
            }
        }
    };

    const handleFloodFill = (x: number, y: number) => {
        if (!baseImgObj || !maskCanvasRef.current) return;
        saveHistory();
        const tempC = document.createElement('canvas'); tempC.width = baseImgObj.width; tempC.height = baseImgObj.height;
        tempC.getContext('2d')!.drawImage(baseImgObj, 0, 0);
        const res = createMockupMask(tempC.getContext('2d')!, tempC.width, tempC.height, x, y, wandTolerance);
        if (res) {
            const ctx = maskCanvasRef.current.getContext('2d')!;
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(res.maskCanvas, 0, 0);
            renderCanvas();
        }
    };

    const handleStroke = (x: number, y: number, isDrag: boolean) => {
        if (!maskCanvasRef.current) return;
        const ctx = maskCanvasRef.current.getContext('2d')!;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = brushSize;
        
        ctx.globalCompositeOperation = activeTool === 'BRUSH' ? 'source-over' : 'destination-out';
        ctx.strokeStyle = 'white'; ctx.fillStyle = 'white';

        ctx.beginPath();
        if (isDrag && lastDrawPos.current) {
            ctx.moveTo(lastDrawPos.current.x, lastDrawPos.current.y);
            ctx.lineTo(x, y);
            ctx.stroke();
        } else {
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        renderCanvas();
    };

    // --- INTERACTION ---
    const getCanvasCoords = (clientX: number, clientY: number) => {
        if (!canvasRef.current || !containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        // Mouse relative to Container Center
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const mx = clientX - rect.left - cx;
        const my = clientY - rect.top - cy;
        
        // Apply Inverse View Transform
        // View: translate(view.x, view.y) scale(view.k)
        // Canvas Center is (W/2, H/2)
        const px = (mx - view.x) / view.k + canvasRef.current.width / 2;
        const py = (my - view.y) / view.k + canvasRef.current.height / 2;
        
        return { x: px, y: py };
    };

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        lastPointerPos.current = { x: clientX, y: clientY };

        if (activeTool === 'HAND' || ('buttons' in e && e.buttons === 4)) {
            isPanning.current = true;
            return;
        }

        const { x, y } = getCanvasCoords(clientX, clientY);

        if (activeTool === 'WAND') {
            handleFloodFill(x, y);
        } else if (activeTool === 'BRUSH' || activeTool === 'ERASER') {
            saveHistory();
            isDrawingRef.current = true;
            lastDrawPos.current = { x, y };
            handleStroke(x, y, false);
        }
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        setCursorPos({ x: clientX, y: clientY });

        if (isPanning.current && lastPointerPos.current) {
            const dx = clientX - lastPointerPos.current.x;
            const dy = clientY - lastPointerPos.current.y;
            setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
            lastPointerPos.current = { x: clientX, y: clientY };
            return;
        }

        if (isDrawingRef.current) {
            const { x, y } = getCanvasCoords(clientX, clientY);
            handleStroke(x, y, true);
            lastDrawPos.current = { x, y };
        }
    };

    const handlePointerUp = () => {
        isPanning.current = false;
        isDrawingRef.current = false;
        lastPointerPos.current = null;
        lastDrawPos.current = null;
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || activeTool === 'HAND') {
            e.preventDefault();
            const s = Math.exp(-e.deltaY * 0.001);
            setView(v => ({ ...v, k: Math.min(Math.max(0.1, v.k * s), 8) }));
        }
    };

    // --- CHANGE MODEL WITHOUT RESETTING PATTERN ---
    const changeModel = (url: string) => {
        setReferenceImage(url);
        // Force reset mask but keep pattern
        if (maskCanvasRef.current && baseImgObj) {
            const ctx = maskCanvasRef.current.getContext('2d')!;
            ctx.clearRect(0, 0, baseImgObj.width, baseImgObj.height);
        }
        setStep('STUDIO'); // Go back to studio immediately
    };

    // --- SEARCH ---
    const performSearch = async () => {
        if (!searchQuery) return;
        setIsSearching(true);
        setWhiteBases([]);
        try {
            // Find White Models via Backend
            const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'FIND_WHITE_MODELS', prompt: searchQuery }) });
            const data = await response.json();
            if (data.success && data.queries) {
                const promises = data.queries.map((q: string) => fetch('/api/analyze', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ action: 'GET_LINK_PREVIEW', targetUrl: '', backupSearchTerm: q }) }).then(r=>r.json()).then(d=>d.success ? d.image : null));
                const results = await Promise.all(promises);
                setWhiteBases(results.filter(u => u));
            }
        } catch(e) {}
        setIsSearching(false);
    };

    return (
        <div className="flex flex-col h-full bg-[#000000] text-white overflow-hidden">
            {step !== 'SEARCH_BASE' && (
                <div className="bg-[#111111] px-4 py-2 flex items-center justify-between border-b border-gray-900 shrink-0 z-50 h-14">
                    <div className="flex items-center gap-2"><Camera size={18} className="text-vingi-400"/><span className="font-bold text-sm">Provador Mágico</span></div>
                    <div className="flex gap-2">
                        <button onClick={() => setStep('SEARCH_BASE')} className="text-[10px] bg-gray-800 px-3 py-1.5 rounded hover:bg-gray-700 font-medium border border-gray-700">Trocar Modelo</button>
                        <button onClick={() => { if(canvasRef.current){ const l=document.createElement('a'); l.download='vingi-look.jpg'; l.href=canvasRef.current.toDataURL('image/jpeg',0.9); l.click(); } }} className="text-[10px] bg-vingi-900 text-white px-3 py-1.5 rounded font-bold hover:bg-vingi-800 flex items-center gap-1 border border-vingi-700"><Download size={12}/> Salvar</button>
                    </div>
                </div>
            )}

            {step === 'SEARCH_BASE' && (
                <div className="flex-1 bg-[#f0f2f5] overflow-y-auto text-gray-800">
                    <ModuleHeader icon={Camera} title="Provador Mágico" onAction={() => selectedPattern ? setStep('STUDIO') : onNavigateToCreator()} actionLabel="Voltar" />
                    <div className="max-w-2xl mx-auto p-6 pb-20 space-y-6">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Sparkles size={16} className="text-purple-500"/> Encontrar Modelo (Contrast Hunter)</h3>
                            <div className="flex gap-2 mb-4">
                                <div className="relative flex-1">
                                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && performSearch()} placeholder="Ex: Vestido Longo Branco" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-vingi-500 transition-all"/>
                                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                </div>
                                <button onClick={performSearch} disabled={isSearching || !searchQuery} className="bg-vingi-900 text-white px-6 rounded-xl font-bold hover:bg-vingi-800 disabled:opacity-50">{isSearching ? <Loader2 className="animate-spin"/> : 'Buscar'}</button>
                            </div>
                            
                            {whiteBases.length > 0 && (
                                <div className="grid grid-cols-3 gap-3">
                                    {whiteBases.map((url, i) => (
                                        <div key={i} onClick={() => changeModel(url)} className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-4 ring-vingi-500/50 transition-all relative group">
                                            <img src={url} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <span className="bg-white text-black text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">Selecionar</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="text-center opacity-50 text-xs font-bold text-gray-400 uppercase">OU</div>
                        
                        <button onClick={() => refInputRef.current?.click()} className="w-full py-6 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center text-gray-500 hover:bg-white hover:border-vingi-400 transition-all gap-2 bg-gray-50">
                            <UploadCloud size={24}/>
                            <span>Carregar Foto Própria</span>
                            <input type="file" ref={refInputRef} onChange={e => { const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=ev=>changeModel(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden"/>
                        </button>
                    </div>
                </div>
            )}

            {step === 'SELECT_PATTERN' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#f0f2f5] text-gray-800">
                    <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-sm w-full border border-gray-100">
                        <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"><Layers size={32}/></div>
                        <h2 className="text-xl font-bold mb-2">Selecione a Estampa</h2>
                        <p className="text-gray-500 text-sm mb-6">Qual tecido você quer aplicar no modelo?</p>
                        <div className="space-y-3">
                            <label className="block w-full py-3 bg-vingi-900 text-white rounded-xl font-bold cursor-pointer hover:bg-vingi-800 transition-colors">
                                Carregar Arquivo
                                <input type="file" onChange={e => { const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=ev=>{ setSelectedPattern(ev.target?.result as string); setStep('STUDIO'); }; r.readAsDataURL(f); } }} className="hidden" accept="image/*"/>
                            </label>
                            <button onClick={onNavigateToCreator} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">Buscar no Radar</button>
                        </div>
                    </div>
                </div>
            )}

            {step === 'STUDIO' && baseImgObj && (
                <div className="flex-1 flex flex-col relative overflow-hidden bg-[#050505]">
                    
                    {/* CANVAS VIEWPORT */}
                    <div 
                        ref={containerRef}
                        className={`flex-1 relative overflow-hidden flex items-center justify-center touch-none ${activeTool === 'HAND' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onWheel={handleWheel}
                    >
                        {/* Background Grid */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px', transform: `scale(${view.k})`, transformOrigin: '0 0' }} />
                        
                        <div className="relative shadow-2xl transition-transform duration-75 ease-out" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: baseImgObj.width, height: baseImgObj.height }}>
                            <canvas ref={canvasRef} className="block bg-white" />
                        </div>

                        {/* Floating Cursor for Brush/Eraser */}
                        {(activeTool === 'BRUSH' || activeTool === 'ERASER') && cursorPos && (
                            <div 
                                className="fixed pointer-events-none rounded-full border border-white/80 bg-white/10 z-50 backdrop-invert"
                                style={{ 
                                    left: cursorPos.x, 
                                    top: cursorPos.y, 
                                    width: brushSize * view.k, // Scale cursor visual with zoom
                                    height: brushSize * view.k, 
                                    transform: 'translate(-50%, -50%)',
                                    boxShadow: '0 0 0 1px rgba(0,0,0,0.5)'
                                }}
                            />
                        )}
                        
                        {/* Status Overlay */}
                        {activeTool === 'AUTO' && history.length === 0 && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse">
                                <BrainCircuit size={14}/> Auto-Detect Ready
                            </div>
                        )}
                    </div>

                    {/* CONTEXTUAL SLIDERS (ABOVE TOOLBAR) */}
                    {(activeTool === 'WAND' || activeTool === 'BRUSH' || activeTool === 'AUTO') && (
                        <div className="absolute bottom-16 left-0 right-0 px-4 pb-2 flex justify-center z-40 pointer-events-none">
                            <div className="bg-black/90 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-2xl w-full max-w-md pointer-events-auto animate-slide-up">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase"><span>Escala</span><span>{Math.round(patternScale*100)}%</span></div>
                                        <input type="range" min="0.1" max="2" step="0.05" value={patternScale} onChange={e => setPatternScale(parseFloat(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-white"/>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase"><span>Rotação</span><span>{patternRotation}°</span></div>
                                        <input type="range" min="0" max="360" value={patternRotation} onChange={e => setPatternRotation(parseInt(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-white"/>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase"><span>Sombras</span><span>{Math.round(shadowIntensity*100)}%</span></div>
                                        <input type="range" min="0" max="1" step="0.05" value={shadowIntensity} onChange={e => setShadowIntensity(parseFloat(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-white"/>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase"><span>Luzes/Dobras</span><span>{Math.round(highlightIntensity*100)}%</span></div>
                                        <input type="range" min="0" max="1" step="0.05" value={highlightIntensity} onChange={e => setHighlightIntensity(parseFloat(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-white"/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* BOTTOM TOOLBAR (INSHOT STYLE) */}
                    <div className="bg-[#111] border-t border-white/10 shrink-0 z-50 pb-[env(safe-area-inset-bottom)]">
                        <div className="flex items-center justify-between px-2 py-2 overflow-x-auto no-scrollbar gap-2">
                            
                            <button onClick={handleAutoFit} className={`flex flex-col items-center justify-center min-w-[56px] h-14 rounded-lg gap-1 transition-all active:scale-95 ${activeTool==='AUTO' ? 'bg-gradient-to-br from-vingi-600 to-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-gray-400 hover:text-white'}`}>
                                <Sparkles size={18}/>
                                <span className="text-[9px] font-bold">Auto</span>
                            </button>

                            <div className="w-px h-8 bg-white/10 mx-1"></div>

                            <ToolBtn icon={Wand2} label="Varinha" active={activeTool==='WAND'} onClick={() => setActiveTool('WAND')} />
                            <ToolBtn icon={Brush} label="Pincel" active={activeTool==='BRUSH'} onClick={() => setActiveTool('BRUSH')} />
                            <ToolBtn icon={Eraser} label="Borracha" active={activeTool==='ERASER'} onClick={() => setActiveTool('ERASER')} />
                            <ToolBtn icon={Hand} label="Mover" active={activeTool==='HAND'} onClick={() => setActiveTool('HAND')} />
                            
                            <div className="w-px h-8 bg-white/10 mx-1"></div>

                            <ToolBtn icon={Undo2} label="Desfazer" onClick={undoMask} disabled={history.length === 0} />
                            <ToolBtn icon={RefreshCw} label="Estampa" onClick={() => setStep('SELECT_PATTERN')} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick, disabled }: any) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className={`flex flex-col items-center justify-center min-w-[56px] h-14 rounded-lg gap-1 transition-all active:scale-95 ${disabled ? 'opacity-30' : ''} ${active ? 'text-white bg-white/10' : 'text-gray-500 hover:text-white'}`}
    >
        <Icon size={18} strokeWidth={active ? 2.5 : 1.5} />
        <span className="text-[9px] font-medium">{label}</span>
    </button>
);
