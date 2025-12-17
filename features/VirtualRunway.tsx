
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Search, Wand2, UploadCloud, Layers, Move, Eraser, Check, Loader2, Image as ImageIcon, Shirt, RefreshCw, X, Download, MousePointer2, ChevronRight, RotateCw, Sun, Droplets, Zap, Sliders, Sparkles, Brush, PenTool, Focus, ShieldCheck, Hand, ZoomIn, ZoomOut, RotateCcw, BrainCircuit, Maximize, Undo2, Grid, ScanLine, ArrowLeft, MoreHorizontal, CheckCircle2, Play, Plus, MinusCircle, PlusCircle } from 'lucide-react';
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
    
    // UI Flows
    const [showPatternModal, setShowPatternModal] = useState(false);
    const [showStudioToast, setShowStudioToast] = useState(false);
    
    // Search Engine State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchImage, setSearchImage] = useState<string | null>(null);
    const [detectedStructure, setDetectedStructure] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchStatus, setSearchStatus] = useState('');
    const [visibleResults, setVisibleResults] = useState(10); // Pagination limit

    // Studio Core
    const canvasRef = useRef<HTMLCanvasElement>(null); 
    const containerRef = useRef<HTMLDivElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); 
    const [baseImgObj, setBaseImgObj] = useState<HTMLImageElement | null>(null);
    const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);
    const [history, setHistory] = useState<ImageData[]>([]);

    // Viewport
    const [view, setView] = useState({ x: 0, y: 0, k: 1 });
    const isPanning = useRef(false);
    const isPinching = useRef(false);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);
    const lastPinchDist = useRef<number>(0);

    // Tools
    const [activeTool, setActiveTool] = useState<'WAND' | 'BRUSH' | 'ERASER' | 'HAND' | 'AUTO'>('HAND');
    const [brushSize, setBrushSize] = useState(40);
    const [wandTolerance, setWandTolerance] = useState(30);
    const [wandMode, setWandMode] = useState<'ADD' | 'SUB'>('ADD');
    const [showMaskHighlight, setShowMaskHighlight] = useState(false); // New visual feedback
    
    // Render Params
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
    const patternInputRef = useRef<HTMLInputElement>(null);

    // --- TRANSFER CHECK ---
    useEffect(() => {
        const storedPattern = localStorage.getItem('vingi_mockup_pattern');
        if (storedPattern) {
            setSelectedPattern(storedPattern);
            localStorage.removeItem('vingi_mockup_pattern');
        }
    }, []);

    // --- STUDIO ENTRY TOAST ---
    useEffect(() => {
        if (step === 'STUDIO') {
            setShowStudioToast(true);
            const t = setTimeout(() => setShowStudioToast(false), 4000);
            return () => clearTimeout(t);
        }
    }, [step]);

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
                
                // Auto Fit Viewport
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

        // Highlight Mode (Mask Feedback)
        if (showMaskHighlight) {
            const tempM = document.createElement('canvas'); tempM.width = w; tempM.height = h;
            const tmCtx = tempM.getContext('2d')!;
            tmCtx.drawImage(maskCanvas, 0, 0);
            tmCtx.globalCompositeOperation = 'source-in';
            tmCtx.fillStyle = wandMode === 'SUB' ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 255, 255, 0.5)'; // Red for subtract, Cyan for add
            tmCtx.fillRect(0,0,w,h);
            
            ctx.save();
            ctx.drawImage(tempM, 0, 0);
            ctx.restore();
        }

        if (!patternImgObj) return;

        // 2. Pattern Layer (Masked)
        const tempC = document.createElement('canvas'); tempC.width = w; tempC.height = h;
        const tCtx = tempC.getContext('2d')!;
        
        if (edgeFeather > 0) tCtx.filter = `blur(${edgeFeather}px)`;
        tCtx.drawImage(maskCanvas, 0, 0);
        tCtx.filter = 'none';
        
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

        // 4. Realism (Shadows & Lights)
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

    }, [baseImgObj, patternImgObj, patternScale, patternRotation, patternOpacity, shadowIntensity, highlightIntensity, edgeFeather, showMaskHighlight, wandMode]);

    useEffect(() => { requestAnimationFrame(renderCanvas); }, [renderCanvas]);

    // --- ACTIONS ---
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
            setShowMaskHighlight(true); // Flash selection
            setTimeout(() => setShowMaskHighlight(false), 600);
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
            // Use Wand Mode: Add or Subtract
            ctx.globalCompositeOperation = wandMode === 'SUB' ? 'destination-out' : 'source-over';
            ctx.drawImage(res.maskCanvas, 0, 0);
            setShowMaskHighlight(true);
            setTimeout(() => setShowMaskHighlight(false), 400);
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
        setShowMaskHighlight(true); // Keep highlighted while drawing
        renderCanvas();
    };

    // --- INTERACTION ---
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

        if ('touches' in e && e.touches.length === 2) {
            isPinching.current = true;
            lastPinchDist.current = Math.sqrt((e.touches[0].clientX - e.touches[1].clientX)**2 + (e.touches[0].clientY - e.touches[1].clientY)**2);
            return;
        }

        if (activeTool === 'HAND' || ('button' in e && e.button === 1)) {
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

        if (isPinching.current && 'touches' in e && e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.sqrt((e.touches[0].clientX - e.touches[1].clientX)**2 + (e.touches[0].clientY - e.touches[1].clientY)**2);
            const scale = dist / lastPinchDist.current;
            const newK = Math.min(Math.max(0.1, view.k * scale), 8);
            setView(v => ({ ...v, k: newK }));
            lastPinchDist.current = dist;
            return;
        }

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
        isPinching.current = false;
        lastPointerPos.current = null;
        lastDrawPos.current = null;
        setShowMaskHighlight(false); // Stop highlight on release
        renderCanvas();
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || activeTool === 'HAND') {
            e.preventDefault();
            const s = Math.exp(-e.deltaY * 0.001);
            const newK = Math.min(Math.max(0.1, view.k * s), 8);
            setView(v => ({ ...v, k: newK }));
        }
    };

    // --- SEARCH ENGINE ---
    const handleSearchImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const raw = ev.target?.result as string;
                if (raw) {
                    const compressed = await compressImage(raw);
                    setSearchImage(compressed);
                    setSearchQuery('');
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const performSearch = async () => {
        if (!searchQuery.trim() && !searchImage) return;
        
        setIsSearching(true);
        setSearchStatus('Ativando Rede Neural...');
        setWhiteBases([]);
        setDetectedStructure(null);
        setVisibleResults(10);
        
        try {
            setSearchStatus('Decodificando DNA da peça...');
            
            let payload: any = { action: 'FIND_WHITE_MODELS' };
            if (searchImage) {
                const base64 = searchImage.split(',')[1];
                payload.mainImageBase64 = base64;
                payload.mainMimeType = 'image/jpeg';
            } else {
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
                setSearchStatus(`Renderizando variações (${totalQueries} modelos)...`);
                
                // Fetch in Batches (up to 50 results)
                const fetchBatch = async (batchQueries: string[]) => {
                    const promises = batchQueries.map(q => 
                        fetch('/api/analyze', { 
                            method: 'POST', 
                            headers: {'Content-Type': 'application/json'}, 
                            body: JSON.stringify({ action: 'GET_LINK_PREVIEW', targetUrl: '', backupSearchTerm: q, linkType: 'SEARCH_QUERY' }) 
                        }).then(r=>r.json()).then(d=>d.success ? d.image : null)
                    );
                    return (await Promise.all(promises)).filter(u => u);
                };

                // Rapid Sequence Loading (Batch 1, 2, 3...)
                const batchSize = 15;
                for (let i = 0; i < data.queries.length; i += batchSize) {
                    const batch = data.queries.slice(i, i + batchSize);
                    const results = await fetchBatch(batch);
                    setWhiteBases(prev => [...prev, ...results]);
                    if (i === 0) setIsSearching(false); // Show results asap
                }
            }
        } catch(e) {
            console.error(e);
        } finally {
            setIsSearching(false);
            setSearchStatus('');
        }
    };

    const handleModelClick = (url: string) => {
        setReferenceImage(url);
        setShowPatternModal(true); // Open modal immediately
    };

    const confirmPatternUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setSelectedPattern(ev.target?.result as string);
                setShowPatternModal(false);
                setStep('STUDIO');
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#000000] text-white overflow-hidden">
            {/* STUDIO HEADER */}
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

            {/* MODAL: MANDATORY PATTERN UPLOAD */}
            {showPatternModal && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-[#1a1a1a] border border-gray-800 rounded-3xl p-8 max-w-md w-full text-center relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-vingi-500 to-purple-600"></div>
                        <button onClick={() => setShowPatternModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20}/></button>
                        
                        <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-800 shadow-inner">
                            <Layers size={32} className="text-vingi-400 animate-pulse"/>
                        </div>
                        
                        <h3 className="text-2xl font-bold text-white mb-2">Qual é a Estampa?</h3>
                        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                            A modelo está pronta. Agora envie o arquivo da estampa ou tecido para iniciarmos a simulação neural.
                        </p>
                        
                        <button onClick={() => patternInputRef.current?.click()} className="w-full py-4 bg-gradient-to-r from-vingi-600 to-purple-600 text-white rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-3">
                            <UploadCloud size={24}/> CARREGAR ARQUIVO
                        </button>
                        <input type="file" ref={patternInputRef} onChange={confirmPatternUpload} accept="image/*" className="hidden" />
                        
                        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-gray-600 uppercase tracking-widest font-bold">
                            <ShieldCheck size={12}/> Ambiente Seguro Vingi AI
                        </div>
                    </div>
                </div>
            )}

            {/* SEARCH VIEW */}
            {step === 'SEARCH_BASE' && (
                <div className="flex-1 bg-[#f0f2f5] overflow-y-auto text-gray-800 custom-scrollbar">
                    <ModuleHeader 
                        icon={Camera} title="Provador Mágico" subtitle="Visual AI Adaptation" 
                        onAction={() => selectedPattern ? setStep('STUDIO') : onNavigateToCreator()} 
                        actionLabel={selectedPattern ? "Voltar ao Provador" : "Voltar"} 
                    />
                    
                    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
                        {/* SEARCH CARD - MARKETING COPY */}
                        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5 transform rotate-12 pointer-events-none"><Sparkles size={120} className="text-vingi-600"/></div>
                            
                            <h3 className="font-black text-3xl text-gray-900 mb-3 flex items-center gap-3">
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-vingi-600 to-purple-600">Desfile Virtual</span>
                                <span className="text-sm bg-black text-white px-3 py-1 rounded-full font-bold uppercase tracking-widest align-middle">Beta</span>
                            </h3>
                            <p className="text-gray-500 text-base mb-8 max-w-2xl leading-relaxed">
                                Transforme qualquer ideia em realidade. Envie uma referência e nossa <strong className="text-vingi-700">IA Generativa</strong> adaptará a modelagem matematicamente para um desfile virtual hiper-realista. O resultado é indistinguível da realidade.
                            </p>

                            <div className="flex flex-col md:flex-row gap-4 items-start">
                                <div className="flex-1 w-full">
                                    <div className="relative group">
                                        <input 
                                            type="text" 
                                            value={searchQuery} 
                                            onChange={e => { setSearchQuery(e.target.value); setSearchImage(null); }} 
                                            onKeyDown={e => e.key === 'Enter' && performSearch()} 
                                            placeholder="Descreva o look: Ex: Vestido de seda longo, decote costas..." 
                                            className="w-full pl-14 pr-4 py-5 bg-gray-50 border-2 border-gray-100 group-hover:border-vingi-200 rounded-2xl outline-none focus:border-vingi-500 transition-all text-lg shadow-inner focus:bg-white text-gray-700 font-medium placeholder-gray-400"
                                        />
                                        <Search size={24} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-vingi-500 transition-colors"/>
                                    </div>
                                </div>

                                <div className="shrink-0">
                                    <input type="file" ref={searchImageInputRef} onChange={handleSearchImageUpload} className="hidden" accept="image/*" />
                                    <button 
                                        onClick={() => searchImageInputRef.current?.click()}
                                        className={`h-[72px] px-6 rounded-2xl border-2 border-dashed flex items-center gap-3 transition-all ${searchImage ? 'border-vingi-500 bg-vingi-50 text-vingi-700' : 'border-gray-300 text-gray-500 hover:border-vingi-400 hover:bg-white'}`}
                                    >
                                        {searchImage ? (
                                            <>
                                                <div className="w-10 h-10 rounded-lg bg-gray-200 overflow-hidden shadow-sm"><img src={searchImage} className="w-full h-full object-cover"/></div>
                                                <span className="text-xs font-bold">Imagem Pronta</span>
                                                <X size={16} className="ml-1 hover:text-red-500" onClick={(e) => { e.stopPropagation(); setSearchImage(null); }}/>
                                            </>
                                        ) : (
                                            <>
                                                <Camera size={24}/>
                                                <span className="text-xs font-bold text-left leading-tight">Usar Foto<br/>Referência</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                <button onClick={performSearch} disabled={isSearching || (!searchQuery && !searchImage)} className="bg-vingi-900 text-white h-[72px] px-10 rounded-2xl font-bold text-lg hover:bg-vingi-800 disabled:opacity-50 transition-all shadow-xl hover:scale-105 active:scale-95 shrink-0 flex items-center gap-3">
                                    {isSearching ? <Loader2 className="animate-spin" size={24}/> : <Wand2 size={24}/>}
                                    <span className="hidden md:inline">Gerar Modelos</span>
                                </button>
                            </div>

                            {searchStatus && (
                                <div className="mt-6 flex items-center gap-3 bg-vingi-50 p-3 rounded-xl border border-vingi-100 inline-flex animate-fade-in">
                                    <Loader2 size={16} className="animate-spin text-vingi-600"/> 
                                    <span className="text-xs font-bold text-vingi-700">{searchStatus}</span>
                                </div>
                            )}
                        </div>

                        {/* RESULTS GRID (INFINITE SCROLL FEEL) */}
                        {whiteBases.length > 0 && (
                            <div className="animate-fade-in pb-20">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 ml-2">Bases Sugeridas pela IA</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {whiteBases.slice(0, visibleResults).map((url, i) => (
                                        <div key={i} onClick={() => handleModelClick(url)} className="aspect-[3/4] bg-white rounded-2xl overflow-hidden cursor-pointer hover:ring-4 ring-vingi-500 transition-all relative group shadow-md hover:-translate-y-2 border border-gray-100 duration-300">
                                            <img src={url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 flex flex-col justify-end items-center pb-6 transition-opacity duration-300">
                                                <span className="bg-white text-black text-xs font-bold px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform">
                                                    <Check size={14}/> ESCOLHER
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {visibleResults < whiteBases.length && (
                                    <div className="mt-12 flex justify-center">
                                        <button onClick={() => setVisibleResults(p => p + 10)} className="bg-white border border-gray-300 text-gray-600 px-8 py-3 rounded-full font-bold shadow-sm hover:bg-gray-50 flex items-center gap-2 transition-all hover:scale-105">
                                            <Plus size={16}/> Carregar Mais Opções
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {!isSearching && whiteBases.length === 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-30 pointer-events-none grayscale">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className="aspect-[3/4] bg-gray-200 rounded-2xl"></div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {step === 'STUDIO' && baseImgObj && (
                <div className="flex-1 flex flex-col relative overflow-hidden bg-[#050505]">
                    
                    {/* STARTUP TOAST */}
                    {showStudioToast && (
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] bg-vingi-900/90 text-white px-6 py-3 rounded-full shadow-2xl border border-vingi-500/30 flex items-center gap-3 animate-slide-down-fade backdrop-blur-md">
                            <div className="bg-green-500 rounded-full p-1"><Check size={12} className="text-black"/></div>
                            <span className="text-xs font-bold">Estampa Carregada no Núcleo Neural</span>
                        </div>
                    )}

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
                    <div className="absolute bottom-24 left-0 right-0 px-4 flex justify-center z-40 pointer-events-none">
                        <div className="bg-black/90 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-2xl w-full max-w-md pointer-events-auto animate-slide-up flex flex-col gap-3">
                            
                            {/* WAND SETTINGS */}
                            {activeTool === 'WAND' && (
                                <div className="space-y-4">
                                    <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                                        <button onClick={() => setWandMode('ADD')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-[10px] font-bold uppercase transition-colors ${wandMode === 'ADD' ? 'bg-vingi-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                                            <PlusCircle size={14} /> Adicionar
                                        </button>
                                        <button onClick={() => setWandMode('SUB')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-[10px] font-bold uppercase transition-colors ${wandMode === 'SUB' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                                            <MinusCircle size={14} /> Subtrair
                                        </button>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase"><span>Sensibilidade</span><span>{wandTolerance}%</span></div>
                                        <input type="range" min="1" max="100" value={wandTolerance} onChange={e => setWandTolerance(parseInt(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-white"/>
                                    </div>
                                </div>
                            )}

                            {(activeTool === 'BRUSH' || activeTool === 'ERASER') && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase"><span>Tamanho do Pincel</span><span>{brushSize}px</span></div>
                                    <input type="range" min="5" max="200" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-white"/>
                                </div>
                            )}
                            
                            {activeTool !== 'WAND' && activeTool !== 'BRUSH' && activeTool !== 'ERASER' && (
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

                    {/* BOTTOM TOOLBAR (HIGH CONTRAST ACTIVE STATES) */}
                    <div className="bg-[#111] border-t border-white/10 shrink-0 z-50 pb-[env(safe-area-inset-bottom)]">
                        <div className="flex items-center justify-between px-2 py-2 overflow-x-auto no-scrollbar gap-2">
                            <button onClick={handleAutoFit} className={`flex flex-col items-center justify-center min-w-[56px] h-14 rounded-lg gap-1 transition-all active:scale-95 ${activeTool==='AUTO' ? 'bg-gradient-to-br from-vingi-500 to-purple-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.5)] border border-white/20' : 'text-gray-400 hover:text-white'}`}>
                                <Sparkles size={18}/> <span className="text-[9px] font-bold">Auto</span>
                            </button>
                            <div className="w-px h-8 bg-white/10 mx-1"></div>
                            <ToolBtn icon={Hand} label="Mover" active={activeTool==='HAND'} onClick={() => setActiveTool('HAND')} />
                            <ToolBtn icon={Wand2} label="Varinha" active={activeTool==='WAND'} onClick={() => setActiveTool('WAND')} />
                            <ToolBtn icon={Brush} label="Pincel" active={activeTool==='BRUSH'} onClick={() => setActiveTool('BRUSH')} />
                            <ToolBtn icon={Eraser} label="Borracha" active={activeTool==='ERASER'} onClick={() => setActiveTool('ERASER')} />
                            <div className="w-px h-8 bg-white/10 mx-1"></div>
                            <ToolBtn icon={Undo2} label="Desfazer" onClick={undoMask} disabled={history.length === 0} />
                            <ToolBtn icon={RefreshCw} label="Estampa" onClick={() => setShowPatternModal(true)} />
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
        className={`flex flex-col items-center justify-center min-w-[56px] h-14 rounded-lg gap-1 transition-all active:scale-95 ${disabled ? 'opacity-30' : ''} ${active ? 'text-white bg-white/10 border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'text-gray-500 hover:text-white'}`}
    >
        <Icon size={18} strokeWidth={active ? 2.5 : 1.5} className={active ? 'drop-shadow-lg' : ''} /> 
        <span className="text-[9px] font-medium">{label}</span>
    </button>
);
