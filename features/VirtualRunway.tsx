
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Search, Wand2, UploadCloud, Layers, Move, Eraser, Check, Loader2, Image as ImageIcon, Shirt, RefreshCw, X, Download, MousePointer2, ChevronRight, RotateCw, Sun, Droplets, Zap, Sliders, Sparkles, Brush, PenTool, Focus, ShieldCheck, Hand, ZoomIn, ZoomOut, RotateCcw, BrainCircuit, Maximize, Undo2, Grid, ScanLine, ArrowLeft, MoreHorizontal, CheckCircle2 } from 'lucide-react';
import { ModuleHeader, ModuleLandingPage } from '../components/Shared';

// --- HELPERS MATEMÁTICOS & VISÃO ---

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
    if (startPos < 0 || startPos >= data.length) return null;

    const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];
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
        const diff = Math.abs(data[pos] - r0) + Math.abs(data[pos+1] - g0) + Math.abs(data[pos+2] - b0);

        if (diff <= tolerance * 3) {
            maskData[pos] = 255; maskData[pos+1] = 255; maskData[pos+2] = 255; maskData[pos+3] = 255;
            pixelCount++;
            if(x<minX) minX=x; if(x>maxX) maxX=x; if(y<minY) minY=y; if(y>maxY) maxY=y;
            if (x > 0) stack.push([x-1, y]); if (x < width - 1) stack.push([x+1, y]);
            if (y > 0) stack.push([x, y-1]); if (y < height - 1) stack.push([x, y+1]);
        }
    }

    if (pixelCount < 50) return null;
    maskCtx.putImageData(maskImgData, 0, 0);
    return { maskCanvas, bounds: { minX, minY, maxX, maxY } };
};

const performAutoSegmentation = (baseImg: HTMLImageElement) => {
    const w = baseImg.width, h = baseImg.height;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(baseImg, 0, 0);
    
    const imgData = ctx.getImageData(0, 0, w, h).data;
    let bestX = w/2, bestY = h/2, maxLum = 0;
    const centerX = Math.floor(w/2), centerY = Math.floor(h/2);
    
    // Heurística de Contraste: Procura o ponto mais "branco" (roupa) no centro da imagem
    // Evita o 255 puro (geralmente fundo branco queimado)
    for(let y = centerY - Math.floor(h*0.3); y < centerY + Math.floor(h*0.3); y+=10) {
        for(let x = centerX - Math.floor(w*0.2); x < centerX + Math.floor(w*0.2); x+=10) {
            const idx = (y * w + x) * 4;
            const lum = (imgData[idx] + imgData[idx+1] + imgData[idx+2]) / 3;
            if (lum > maxLum && lum < 250) { 
                maxLum = lum; bestX = x; bestY = y;
            }
        }
    }
    return createMockupMask(ctx, w, h, bestX, bestY, 45);
};

const compressImage = (base64Str: string, maxWidth = 800): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
    });
};

interface VirtualRunwayProps {
    onNavigateToCreator: () => void;
}

export const VirtualRunway: React.FC<VirtualRunwayProps> = ({ onNavigateToCreator }) => {
    const [step, setStep] = useState<'SEARCH_BASE' | 'SELECT_PATTERN' | 'STUDIO'>('SEARCH_BASE');
    
    // Assets & Data
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
    const [whiteBases, setWhiteBases] = useState<string[]>([]);
    
    // Search Engine State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchImage, setSearchImage] = useState<string | null>(null); // Imagem usada para buscar modelo
    const [isSearching, setIsSearching] = useState(false);
    const [searchStatus, setSearchStatus] = useState('');
    const [detectedStructure, setDetectedStructure] = useState<string | null>(null);

    // Studio Core
    const canvasRef = useRef<HTMLCanvasElement>(null); 
    const containerRef = useRef<HTMLDivElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); 
    const [baseImgObj, setBaseImgObj] = useState<HTMLImageElement | null>(null);
    const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);
    const [history, setHistory] = useState<ImageData[]>([]);

    // Viewport State (Zoom & Pan - Robust Mobile/Desktop)
    const [view, setView] = useState({ x: 0, y: 0, k: 1 });
    const isPanning = useRef(false);
    const isPinching = useRef(false);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);
    const lastPinchDist = useRef<number>(0);

    // Tools
    const [activeTool, setActiveTool] = useState<'WAND' | 'BRUSH' | 'ERASER' | 'HAND' | 'AUTO'>('AUTO');
    const [brushSize, setBrushSize] = useState(40);
    const [wandTolerance, setWandTolerance] = useState(30);
    
    // Render Parameters
    const [patternScale, setPatternScale] = useState(0.5);
    const [patternRotation, setPatternRotation] = useState(0);
    const [shadowIntensity, setShadowIntensity] = useState(0.8);
    const [highlightIntensity, setHighlightIntensity] = useState(0.4);
    const [patternOpacity, setPatternOpacity] = useState(0.96);
    const [edgeFeather, setEdgeFeather] = useState(1.5);

    // Interaction Refs
    const isDrawingRef = useRef(false);
    const lastDrawPos = useRef<{x: number, y: number} | null>(null);
    const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);
    
    const refInputRef = useRef<HTMLInputElement>(null);
    const searchImageInputRef = useRef<HTMLInputElement>(null);

    // --- TRANSFER CHECK ---
    useEffect(() => {
        const storedPattern = localStorage.getItem('vingi_mockup_pattern');
        if (storedPattern) {
            setSelectedPattern(storedPattern);
            localStorage.removeItem('vingi_mockup_pattern');
            // Se já temos modelo e estampa, vai pro estúdio.
            // Se só tem estampa, fica na busca para escolher modelo.
            if (referenceImage) setStep('STUDIO');
        }
    }, []);

    // --- IMAGE LOADING ---
    useEffect(() => {
        if (referenceImage) {
            const img = new Image(); img.src = referenceImage; img.crossOrigin = "anonymous";
            img.onload = () => {
                setBaseImgObj(img);
                const mCanvas = document.createElement('canvas');
                mCanvas.width = img.width; mCanvas.height = img.height;
                maskCanvasRef.current = mCanvas;
                setHistory([]);
                
                // Auto Fit Viewport Logic
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const k = Math.min(rect.width / img.width, rect.height / img.height) * 0.9;
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

    // --- AUTO DETECT ON ENTER ---
    useEffect(() => {
        if (step === 'STUDIO' && baseImgObj && activeTool === 'AUTO') {
            const timer = setTimeout(() => handleAutoFit(), 500); 
            return () => clearTimeout(timer);
        }
    }, [step, baseImgObj]);

    // --- RENDER LOOP ---
    const renderCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!canvas || !baseImgObj || !maskCanvas) return;
        
        if (canvas.width !== baseImgObj.width) {
            canvas.width = baseImgObj.width; canvas.height = baseImgObj.height;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const w = canvas.width, h = canvas.height;
        
        // 1. Base Image
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(baseImgObj, 0, 0, w, h);

        if (!patternImgObj) return;

        // 2. Pattern Layer (Masked)
        const tempC = document.createElement('canvas'); tempC.width = w; tempC.height = h;
        const tCtx = tempC.getContext('2d')!;
        
        // Draw Mask
        if (edgeFeather > 0) tCtx.filter = `blur(${edgeFeather}px)`;
        tCtx.drawImage(maskCanvas, 0, 0);
        tCtx.filter = 'none';
        
        // Clip & Draw Pattern
        tCtx.globalCompositeOperation = 'source-in';
        tCtx.save();
        tCtx.translate(w/2, h/2);
        tCtx.rotate((patternRotation * Math.PI) / 180);
        tCtx.scale(patternScale, patternScale);
        const pat = tCtx.createPattern(patternImgObj, 'repeat');
        if (pat) { tCtx.fillStyle = pat; tCtx.fillRect(-w*4, -h*4, w*8, h*8); }
        tCtx.restore();

        // 3. Composite Pattern
        ctx.save();
        ctx.globalAlpha = patternOpacity;
        ctx.drawImage(tempC, 0, 0);
        ctx.restore();

        // 4. Realism (Shadows - Multiply)
        const shadowC = document.createElement('canvas'); shadowC.width = w; shadowC.height = h;
        const sCtx = shadowC.getContext('2d')!;
        if (edgeFeather > 0) sCtx.filter = `blur(${edgeFeather}px)`;
        sCtx.drawImage(maskCanvas, 0, 0);
        sCtx.filter = `grayscale(100%) contrast(140%) brightness(110%)`;
        sCtx.globalCompositeOperation = 'source-in';
        sCtx.drawImage(baseImgObj, 0, 0);
        
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = shadowIntensity;
        ctx.drawImage(shadowC, 0, 0);
        ctx.restore();

        // 5. Realism (Highlights/Folds - Soft Light/Screen)
        const lightC = document.createElement('canvas'); lightC.width = w; lightC.height = h;
        const lCtx = lightC.getContext('2d')!;
        if (edgeFeather > 0) lCtx.filter = `blur(${edgeFeather}px)`;
        lCtx.drawImage(maskCanvas, 0, 0);
        lCtx.filter = `grayscale(100%) contrast(120%)`;
        lCtx.globalCompositeOperation = 'source-in';
        lCtx.drawImage(baseImgObj, 0, 0);

        ctx.save();
        ctx.globalCompositeOperation = 'hard-light'; 
        ctx.globalAlpha = highlightIntensity;
        ctx.drawImage(lightC, 0, 0);
        ctx.restore();

    }, [baseImgObj, patternImgObj, patternScale, patternRotation, patternOpacity, shadowIntensity, highlightIntensity, edgeFeather]);

    useEffect(() => { requestAnimationFrame(renderCanvas); }, [renderCanvas]);

    // --- TOOLS ACTIONS ---
    const saveHistory = () => {
        if (!maskCanvasRef.current) return;
        const ctx = maskCanvasRef.current.getContext('2d')!;
        const data = ctx.getImageData(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
        setHistory(prev => [...prev.slice(-15), data]);
    };

    const undoMask = () => {
        if (history.length > 0 && maskCanvasRef.current) {
            const prev = history[history.length - 1];
            const ctx = maskCanvasRef.current.getContext('2d')!;
            ctx.putImageData(prev, 0, 0);
            setHistory(h => h.slice(0, -1));
            requestAnimationFrame(renderCanvas);
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
        ctx.globalCompositeOperation = activeTool === 'ERASER' ? 'destination-out' : 'source-over';
        ctx.fillStyle = 'white'; ctx.strokeStyle = 'white';

        ctx.beginPath();
        if (isDrag && lastDrawPos.current) {
            ctx.moveTo(lastDrawPos.current.x, lastDrawPos.current.y);
            ctx.lineTo(x, y);
            ctx.stroke();
        } else {
            ctx.arc(x, y, brushSize/2, 0, Math.PI*2);
            ctx.fill();
        }
        renderCanvas();
    };

    // --- POINTER & ZOOM LOGIC (ROBUST HYBRID) ---
    const getCanvasCoords = (clientX: number, clientY: number) => {
        if (!canvasRef.current || !containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const cx = rect.width / 2; const cy = rect.height / 2;
        const mx = clientX - rect.left - cx; const my = clientY - rect.top - cy;
        const px = (mx - view.x) / view.k + canvasRef.current.width / 2;
        const py = (my - view.y) / view.k + canvasRef.current.height / 2;
        return { x: px, y: py };
    };

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        lastPointerPos.current = { x: clientX, y: clientY };

        // 1. PINCH START (Mobile)
        if ('touches' in e && e.touches.length === 2) {
            isPinching.current = true;
            lastPinchDist.current = Math.sqrt((e.touches[0].clientX - e.touches[1].clientX)**2 + (e.touches[0].clientY - e.touches[1].clientY)**2);
            return;
        }

        // 2. PAN START
        if (activeTool === 'HAND' || ('button' in e && e.button === 1)) {
            isPanning.current = true;
            return;
        }

        // 3. TOOL ACTION (Paint/Erase/Wand)
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

        // 1. PINCH MOVE (Mobile Zoom)
        if (isPinching.current && 'touches' in e && e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.sqrt((e.touches[0].clientX - e.touches[1].clientX)**2 + (e.touches[0].clientY - e.touches[1].clientY)**2);
            const scale = dist / lastPinchDist.current;
            const newK = Math.min(Math.max(0.1, view.k * scale), 8);
            setView(v => ({ ...v, k: newK }));
            lastPinchDist.current = dist;
            return;
        }

        // 2. PAN MOVE
        if (isPanning.current && lastPointerPos.current) {
            const dx = clientX - lastPointerPos.current.x;
            const dy = clientY - lastPointerPos.current.y;
            setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
            lastPointerPos.current = { x: clientX, y: clientY };
            return;
        }

        // 3. DRAW MOVE
        if (isDrawingRef.current) {
            const { x, y } = getCanvasCoords(clientX, clientY);
            handleStroke(x, y, true);
            lastDrawPos.current = { x, y };
        }
    };

    const handlePointerUp = () => {
        isPanning.current = false;
        isDrawingRef.current = false;
        isPinching.current = false;
        lastPointerPos.current = null;
        lastDrawPos.current = null;
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!isPanning.current && !isDrawingRef.current) {
            const s = Math.exp(-e.deltaY * 0.001);
            setView(v => ({ ...v, k: Math.min(Math.max(0.1, v.k * s), 8) }));
        }
    };

    // --- ENGINE DE BUSCA CONTEXTUAL ---
    const handleSearchImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const raw = ev.target?.result as string;
                if (raw) {
                    const compressed = await compressImage(raw);
                    setSearchImage(compressed);
                    setSearchQuery(''); // Limpa texto se usar imagem
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const performSearch = async () => {
        if (!searchQuery.trim() && !searchImage) return;
        
        setIsSearching(true);
        setSearchStatus('Iniciando Inteligência Visual...');
        setWhiteBases([]);
        setDetectedStructure(null);
        
        try {
            // STEP 1: GERAR QUERIES (Inteligência Híbrida: Texto ou Imagem)
            setSearchStatus('Analisando silhueta da roupa...');
            
            let payload: any = { action: 'FIND_WHITE_MODELS' };
            
            if (searchImage) {
                // Se tem imagem, manda pro backend analisar a estrutura e gerar query
                // O backend vai ignorar a estampa e focar no shape
                const base64 = searchImage.split(',')[1];
                payload.mainImageBase64 = base64;
                payload.mainMimeType = 'image/jpeg';
            } else {
                // Se é texto, usa direto
                payload.prompt = searchQuery;
            }

            const response = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload) 
            });
            const data = await response.json();
            
            if (data.success && data.queries) {
                setDetectedStructure(data.detectedStructure || searchQuery);
                const totalQueries = data.queries.length;
                setSearchStatus(`Raspando bancos de imagem (${totalQueries} variações)...`);
                
                // STEP 2: BUSCAR IMAGENS (Scraping em Lotes)
                // Disparamos 30+ requests de proxy para cobrir todas as variações visuais
                
                const fetchBatch = async (batchQueries: string[]) => {
                    const promises = batchQueries.map(q => 
                        fetch('/api/analyze', { 
                            method: 'POST', 
                            headers: {'Content-Type': 'application/json'}, 
                            body: JSON.stringify({ 
                                action: 'GET_LINK_PREVIEW', 
                                targetUrl: '', 
                                backupSearchTerm: q, 
                                linkType: 'SEARCH_QUERY' 
                            }) 
                        }).then(r=>r.json()).then(d=>d.success ? d.image : null)
                    );
                    return (await Promise.all(promises)).filter(u => u);
                };

                // Lote 1 (Imediato)
                const batch1 = await fetchBatch(data.queries.slice(0, 12));
                setWhiteBases(prev => [...prev, ...batch1]);

                // Lote 2 (Background)
                setTimeout(async () => {
                    const batch2 = await fetchBatch(data.queries.slice(12, 30));
                    setWhiteBases(prev => [...prev, ...batch2]);
                }, 800);
            }
        } catch(e) {
            console.error(e);
        } finally {
            setIsSearching(false);
            setSearchStatus('');
        }
    };

    const selectModel = (url: string) => {
        setReferenceImage(url);
        // Preserva a estampa selecionada, só muda o modelo
        setStep('STUDIO');
    };

    return (
        <div className="flex flex-col h-full bg-[#000000] text-white overflow-hidden">
            {step !== 'SEARCH_BASE' && (
                <div className="bg-[#111111] px-4 py-2 flex items-center justify-between border-b border-gray-900 shrink-0 z-50 h-14">
                    <div className="flex items-center gap-2">
                        {step === 'STUDIO' && <button onClick={() => setStep('SEARCH_BASE')} className="md:hidden mr-2 text-gray-400"><ArrowLeft size={20}/></button>}
                        <Camera size={18} className="text-vingi-400"/><span className="font-bold text-sm hidden md:inline">Provador Mágico</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setStep('SEARCH_BASE')} className="text-[10px] bg-gray-800 px-3 py-1.5 rounded hover:bg-gray-700 font-medium border border-gray-700 flex items-center gap-2">
                            <RefreshCw size={12}/> <span className="hidden md:inline">Trocar Modelo</span>
                        </button>
                        <button onClick={() => { if(canvasRef.current){ const l=document.createElement('a'); l.download='vingi-look.jpg'; l.href=canvasRef.current.toDataURL('image/jpeg',0.9); l.click(); } }} className="text-[10px] bg-vingi-900 text-white px-3 py-1.5 rounded font-bold hover:bg-vingi-800 flex items-center gap-1 border border-vingi-700"><Download size={12}/> Salvar</button>
                    </div>
                </div>
            )}

            {step === 'SEARCH_BASE' && (
                <div className="flex-1 bg-[#f0f2f5] overflow-y-auto text-gray-800 custom-scrollbar">
                    <ModuleHeader 
                        icon={Camera} title="Provador Mágico" subtitle="Base Model Finder" 
                        onAction={() => selectedPattern ? setStep('STUDIO') : onNavigateToCreator()} 
                        actionLabel={selectedPattern ? "Voltar ao Provador" : "Voltar"} 
                    />
                    
                    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
                        {/* SEARCH CARD */}
                        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><BrainCircuit size={64} className="text-vingi-500"/></div>
                            
                            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2 text-lg"><Sparkles size={20} className="text-purple-500"/> Encontrar Modelo (Base Branca)</h3>
                            <p className="text-gray-500 text-sm mb-6 max-w-2xl">A IA pode encontrar modelos base ideais para o provador. Descreva o que busca ou envie uma foto de referência para encontrarmos a mesma silhueta em branco.</p>

                            <div className="flex flex-col md:flex-row gap-4 items-start">
                                {/* TEXT INPUT */}
                                <div className="flex-1 w-full">
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={searchQuery} 
                                            onChange={e => { setSearchQuery(e.target.value); setSearchImage(null); }} 
                                            onKeyDown={e => e.key === 'Enter' && performSearch()} 
                                            placeholder="Ex: Vestido Longo Alça Fina, Camiseta Básica..." 
                                            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-vingi-500 transition-all text-base shadow-inner focus:bg-white"
                                        />
                                        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
                                    </div>
                                </div>

                                {/* IMAGE INPUT (NEW FEATURE) */}
                                <div className="shrink-0">
                                    <input type="file" ref={searchImageInputRef} onChange={handleSearchImageUpload} className="hidden" accept="image/*" />
                                    <button 
                                        onClick={() => searchImageInputRef.current?.click()}
                                        className={`h-[58px] px-6 rounded-2xl border-2 border-dashed flex items-center gap-2 transition-all ${searchImage ? 'border-vingi-500 bg-vingi-50 text-vingi-700' : 'border-gray-300 text-gray-500 hover:border-vingi-400 hover:bg-gray-50'}`}
                                    >
                                        {searchImage ? (
                                            <>
                                                <div className="w-8 h-8 rounded bg-gray-200 overflow-hidden"><img src={searchImage} className="w-full h-full object-cover"/></div>
                                                <span className="text-xs font-bold">Imagem Carregada</span>
                                                <X size={14} className="ml-2 hover:text-red-500" onClick={(e) => { e.stopPropagation(); setSearchImage(null); }}/>
                                            </>
                                        ) : (
                                            <>
                                                <Camera size={20}/>
                                                <span className="text-xs font-bold">Usar Foto Ref.</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                <button onClick={performSearch} disabled={isSearching || (!searchQuery && !searchImage)} className="bg-vingi-900 text-white h-[58px] px-8 rounded-2xl font-bold hover:bg-vingi-800 disabled:opacity-50 transition-all shadow-lg hover:scale-105 active:scale-95 shrink-0 flex items-center gap-2">
                                    {isSearching ? <Loader2 className="animate-spin"/> : <ArrowLeft className="rotate-180" size={20}/>}
                                    <span className="hidden md:inline">Buscar</span>
                                </button>
                            </div>

                            {searchStatus && <p className="text-xs text-vingi-600 font-mono mt-3 animate-pulse flex items-center gap-2"><Loader2 size={10} className="animate-spin"/> {searchStatus}</p>}
                            {detectedStructure && !isSearching && <p className="text-xs text-green-600 font-bold mt-3 flex items-center gap-1"><CheckCircle2 size={12}/> Estrutura Detectada: "{detectedStructure}"</p>}
                        </div>

                        {/* RESULTS GRID */}
                        {whiteBases.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-20 animate-fade-in">
                                {whiteBases.map((url, i) => (
                                    <div key={i} onClick={() => selectModel(url)} className="aspect-[3/4] bg-white rounded-xl overflow-hidden cursor-pointer hover:ring-4 ring-vingi-500/50 transition-all relative group shadow-md hover:-translate-y-1 border border-gray-100">
                                        <img src={url} className="w-full h-full object-cover" loading="lazy" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 flex flex-col justify-end items-center pb-4 transition-opacity duration-300">
                                            <span className="bg-white text-vingi-900 text-xs font-bold px-4 py-2 rounded-full shadow-xl flex items-center gap-2 transform scale-90 group-hover:scale-100 transition-transform">
                                                <Check size={14}/> Provar
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            !isSearching && (
                                <div className="text-center opacity-50 py-10">
                                    <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4"><ScanLine size={32} className="text-gray-400"/></div>
                                    <p className="text-sm font-bold text-gray-400">Nenhum modelo encontrado. Tente buscar algo como "Vestido Midi Branco".</p>
                                    
                                    <div className="mt-8">
                                        <p className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">OU CARREGUE SEU ARQUIVO</p>
                                        <button onClick={() => refInputRef.current?.click()} className="px-6 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:bg-white hover:border-vingi-400 hover:text-vingi-600 transition-all font-bold text-xs flex items-center gap-2 mx-auto bg-white">
                                            <UploadCloud size={16}/> Upload Manual
                                            <input type="file" ref={refInputRef} onChange={e => { const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=ev=>selectModel(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden"/>
                                        </button>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}

            {step === 'SELECT_PATTERN' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#f0f2f5] text-gray-800">
                    <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-sm w-full border border-gray-100">
                        <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"><Layers size={32}/></div>
                        <h2 className="text-xl font-bold mb-2">Selecione a Estampa</h2>
                        <div className="space-y-3 mt-6">
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
                        onTouchStart={handlePointerDown}
                        onTouchMove={handlePointerMove}
                        onTouchEnd={handlePointerUp}
                    >
                        {/* Background Grid */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px', transform: `scale(${view.k})`, transformOrigin: 'center' }} />
                        
                        <div className="relative shadow-2xl transition-transform duration-75 ease-out origin-center" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: baseImgObj.width, height: baseImgObj.height }}>
                            <canvas ref={canvasRef} className="block bg-white" />
                        </div>

                        {/* Enhanced Brush Cursor */}
                        {(activeTool === 'BRUSH' || activeTool === 'ERASER') && cursorPos && (
                            <div 
                                className="fixed pointer-events-none rounded-full border-2 border-white mix-blend-difference z-50 flex items-center justify-center"
                                style={{ 
                                    left: cursorPos.x, 
                                    top: cursorPos.y, 
                                    width: brushSize * view.k, 
                                    height: brushSize * view.k, 
                                    transform: 'translate(-50%, -50%)',
                                    boxShadow: '0 0 10px rgba(0,0,0,0.5)'
                                }}
                            >
                                <div className="w-1 h-1 bg-white rounded-full"></div>
                            </div>
                        )}
                        
                        {/* Status Overlay */}
                        {activeTool === 'AUTO' && history.length === 0 && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse">
                                <BrainCircuit size={14}/> Auto-Detect Ready
                            </div>
                        )}
                    </div>

                    {/* CONTEXTUAL SLIDERS */}
                    <div className="absolute bottom-20 left-0 right-0 px-4 flex justify-center z-40 pointer-events-none">
                        <div className="bg-black/90 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-2xl w-full max-w-md pointer-events-auto animate-slide-up flex flex-col gap-3">
                            {(activeTool === 'BRUSH' || activeTool === 'ERASER') ? (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase"><span>Tamanho do Pincel</span><span>{brushSize}px</span></div>
                                    <input type="range" min="5" max="200" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-white"/>
                                </div>
                            ) : (
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
                                        <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase"><span>Sombra</span><span>{Math.round(shadowIntensity*100)}%</span></div>
                                        <input type="range" min="0" max="1" step="0.05" value={shadowIntensity} onChange={e => setShadowIntensity(parseFloat(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-white"/>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase"><span>Brilho</span><span>{Math.round(highlightIntensity*100)}%</span></div>
                                        <input type="range" min="0" max="1" step="0.05" value={highlightIntensity} onChange={e => setHighlightIntensity(parseFloat(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-white"/>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BOTTOM TOOLBAR */}
                    <div className="bg-[#111] border-t border-white/10 shrink-0 z-50 pb-[env(safe-area-inset-bottom)]">
                        <div className="flex items-center justify-between px-2 py-2 overflow-x-auto no-scrollbar gap-2">
                            <button onClick={handleAutoFit} className={`flex flex-col items-center justify-center min-w-[56px] h-14 rounded-lg gap-1 transition-all active:scale-95 ${activeTool==='AUTO' ? 'bg-gradient-to-br from-vingi-600 to-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-gray-400 hover:text-white'}`}>
                                <Sparkles size={18}/> <span className="text-[9px] font-bold">Auto</span>
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
    <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center justify-center min-w-[56px] h-14 rounded-lg gap-1 transition-all active:scale-95 ${disabled ? 'opacity-30' : ''} ${active ? 'text-white bg-white/10' : 'text-gray-500 hover:text-white'}`}>
        <Icon size={18} strokeWidth={active ? 2.5 : 1.5} /> <span className="text-[9px] font-medium">{label}</span>
    </button>
);
