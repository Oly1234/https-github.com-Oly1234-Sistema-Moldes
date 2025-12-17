
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, Wand2, UploadCloud, Layers, Move, Eraser, Check, Loader2, Image as ImageIcon, Shirt, RefreshCw, X, Download, MousePointer2, ChevronRight, RotateCw, Sun, Droplets, Zap, Sliders, Sparkles, Brush, PenTool, Focus, ShieldCheck } from 'lucide-react';
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
    const r0 = data[startPos];
    const g0 = data[startPos+1];
    const b0 = data[startPos+2];

    const visited = new Uint8Array(width * height);
    const stack = [[Math.floor(startX), Math.floor(startY)]];

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
            maskData[pos] = 255;
            maskData[pos+1] = 255;
            maskData[pos+2] = 255;
            maskData[pos+3] = 255;

            if (x > 0) stack.push([x-1, y]);
            if (x < width - 1) stack.push([x+1, y]);
            if (y > 0) stack.push([x, y-1]);
            if (y < height - 1) stack.push([x, y+1]);
        }
    }

    maskCtx.putImageData(maskImgData, 0, 0);
    return { maskCanvas, referenceColor: {r: r0, g: g0, b: b0} };
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
    const [isMaskReady, setIsMaskReady] = useState(false);
    
    // --- STATE: STUDIO ENGINE ---
    const canvasRef = useRef<HTMLCanvasElement>(null); // Visual Canvas (Base + Pattern)
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); // Hidden Mask Canvas (Grayscale)
    const [baseImgObj, setBaseImgObj] = useState<HTMLImageElement | null>(null);
    const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);
    
    // Controls
    const [activeTool, setActiveTool] = useState<'WAND' | 'BRUSH' | 'ERASER'>('WAND');
    const [smartBrush, setSmartBrush] = useState(true); // Default to Smart
    const [brushSize, setBrushSize] = useState(20);
    const [patternScale, setPatternScale] = useState(0.5);
    const [patternRotation, setPatternRotation] = useState(0);
    const [patternOpacity, setPatternOpacity] = useState(1); 
    const [shadowIntensity, setShadowIntensity] = useState(0.8);
    const [wandTolerance, setWandTolerance] = useState(30);
    const [edgeFeather, setEdgeFeather] = useState(2);
    
    // SMART BRUSH REFERENCE
    const targetColorRef = useRef<{r:number, g:number, b:number} | null>(null);

    // Drawing & Interaction State
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef<{x:number, y:number}|null>(null);
    const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);
    
    const refInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Add Image Loading Effects
    useEffect(() => {
        if (referenceImage) {
            const img = new Image();
            img.src = referenceImage;
            img.crossOrigin = "anonymous";
            img.onload = () => setBaseImgObj(img);
        }
    }, [referenceImage]);

    useEffect(() => {
        if (selectedPattern) {
            const img = new Image();
            img.src = selectedPattern;
            img.crossOrigin = "anonymous";
            img.onload = () => setPatternImgObj(img);
        }
    }, [selectedPattern]);

    // --- AUTO-MAGIC MASKING (INITIAL) ---
    useEffect(() => {
        if (step === 'STUDIO' && baseImgObj && patternImgObj && !maskCanvasRef.current) {
            // Inicializar Canvas de Máscara (Mesmo tamanho da imagem base)
            const mCanvas = document.createElement('canvas');
            mCanvas.width = baseImgObj.width;
            mCanvas.height = baseImgObj.height;
            maskCanvasRef.current = mCanvas;

            // Auto-Magic: Tenta achar a roupa branca
            setTimeout(() => {
                const ctx = mCanvas.getContext('2d')!;
                // Desenhar imagem base no canvas auxiliar para ler pixels
                const tempC = document.createElement('canvas');
                tempC.width = baseImgObj.width; tempC.height = baseImgObj.height;
                const tCtx = tempC.getContext('2d')!;
                tCtx.drawImage(baseImgObj, 0, 0);
                
                // Pontos de amostragem centrais (Chute inicial inteligente)
                const cx = baseImgObj.width / 2;
                const cy = baseImgObj.height / 2;
                const points = [ { x: cx, y: cy }, { x: cx, y: cy * 0.8 }, { x: cx, y: cy * 1.2 } ];

                let found = false;
                for (const p of points) {
                    const pixel = tCtx.getImageData(p.x, p.y, 1, 1).data;
                    const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
                    
                    // Se for claro (branco), tenta flood fill
                    if (brightness > 180) {
                        found = true;
                        // Capture initial target color
                        targetColorRef.current = { r: pixel[0], g: pixel[1], b: pixel[2] };
                        break;
                    }
                }
                setIsMaskReady(true);
                if (canvasRef.current) renderCanvas();
            }, 500);
        }
    }, [step, baseImgObj, patternImgObj]);

    // Transfer Listener
    useEffect(() => {
        const transferPattern = localStorage.getItem('vingi_mockup_pattern') || localStorage.getItem('vingi_runway_pattern');
        if (transferPattern) {
            setSelectedPattern(transferPattern);
            localStorage.removeItem('vingi_mockup_pattern');
            localStorage.removeItem('vingi_runway_pattern');
            setStep('SEARCH_BASE'); 
        }
    }, []);

    // --- RENDER ENGINE ---
    useEffect(() => {
        if (step === 'STUDIO' && canvasRef.current && baseImgObj) {
            // Resize display canvas to match logic canvas (but controlled via CSS)
            // Mantemos a resolução interna alta (da imagem)
            if (canvasRef.current.width !== baseImgObj.width) {
                canvasRef.current.width = baseImgObj.width;
                canvasRef.current.height = baseImgObj.height;
            }
            renderCanvas();
        }
    }, [step, baseImgObj, patternImgObj, patternScale, patternRotation, patternOpacity, shadowIntensity, edgeFeather]);

    const renderCanvas = () => {
        const canvas = canvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!canvas || !baseImgObj || !maskCanvas) return;
        
        const ctx = canvas.getContext('2d')!;
        const w = canvas.width;
        const h = canvas.height;
        
        // 1. Limpa e desenha Base
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(baseImgObj, 0, 0, w, h);

        if (patternImgObj) {
            // 2. Prepara Camada de Estampa
            const patternLayer = document.createElement('canvas');
            patternLayer.width = w; patternLayer.height = h;
            const pCtx = patternLayer.getContext('2d')!;
            
            // Desenha a máscara atual (resultante de Wand + Brush + Eraser)
            if (edgeFeather > 0) pCtx.filter = `blur(${edgeFeather}px)`;
            pCtx.drawImage(maskCanvas, 0, 0);
            pCtx.filter = 'none';
            
            // Recorta (Source-In): Onde tem máscara, desenha estampa
            pCtx.globalCompositeOperation = 'source-in';
            pCtx.save();
            pCtx.translate(w/2, h/2);
            pCtx.rotate((patternRotation * Math.PI) / 180); 
            pCtx.scale(patternScale, patternScale);         
            const pat = pCtx.createPattern(patternImgObj, 'repeat');
            if (pat) {
                pCtx.fillStyle = pat;
                pCtx.fillRect(-4000, -4000, 8000, 8000); 
            }
            pCtx.restore();

            // Aplica ao Canvas Principal
            ctx.save();
            ctx.globalAlpha = patternOpacity; 
            ctx.drawImage(patternLayer, 0, 0);
            ctx.restore();

            // 3. Sombras (Multiply) para Realismo
            // Usamos a mesma máscara para recortar a imagem original e aplicar como multiply
            const shadowLayer = document.createElement('canvas');
            shadowLayer.width = w; shadowLayer.height = h;
            const sCtx = shadowLayer.getContext('2d')!;
            if (edgeFeather > 0) sCtx.filter = `blur(${edgeFeather}px)`;
            sCtx.drawImage(maskCanvas, 0, 0);
            sCtx.filter = 'none';
            sCtx.globalCompositeOperation = 'source-in';
            // Aumentamos o contraste da base para extrair sombras
            sCtx.filter = 'grayscale(100%) contrast(150%) brightness(110%)'; 
            sCtx.drawImage(baseImgObj, 0, 0, w, h);
            
            ctx.save();
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = shadowIntensity; 
            ctx.drawImage(shadowLayer, 0, 0);
            ctx.restore();

            // 4. Highlight (Soft Light)
            const highlightLayer = document.createElement('canvas');
            highlightLayer.width = w; highlightLayer.height = h;
            const hCtx = highlightLayer.getContext('2d')!;
            if (edgeFeather > 0) hCtx.filter = `blur(${edgeFeather}px)`;
            hCtx.drawImage(maskCanvas, 0, 0);
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

    // --- INTERACTION LOGIC (WAND, BRUSH, ERASER) ---
    
    // Mapeamento de coordenadas preciso (compensando object-contain CSS)
    const getPointerPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        // Calcula a escala real de exibição
        // Como usamos object-contain, o canvas pode não ocupar todo o rect
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        // Coordenadas relativas ao canvas interno (resolução real)
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        
        return { x, y, clientX, clientY };
    };

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        // Previne scroll em mobile ao desenhar
        if (activeTool !== 'WAND') e.preventDefault();
        
        const { x, y, clientX, clientY } = getPointerPos(e);
        
        if (activeTool === 'WAND') {
            performFloodFill(x, y);
        } else {
            isDrawingRef.current = true;
            lastPosRef.current = { x, y };
            drawStroke(x, y); // Ponto inicial
        }
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        const { x, y, clientX, clientY } = getPointerPos(e);
        
        // Atualiza Cursor Visual
        setCursorPos({ x: clientX, y: clientY });

        if (!isDrawingRef.current) return;
        
        // Previne scroll
        if (e.cancelable) e.preventDefault();
        
        drawStroke(x, y);
        lastPosRef.current = { x, y };
    };

    const handlePointerUp = () => {
        isDrawingRef.current = false;
        lastPosRef.current = null;
    };

    const drawStroke = (x: number, y: number) => {
        const maskCanvas = maskCanvasRef.current;
        if (!maskCanvas || !baseImgObj) return;
        const ctx = maskCanvas.getContext('2d')!;
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brushSize * 2; // Radius to Diameter
        
        if (smartBrush && targetColorRef.current) {
            // SMART BRUSH LOGIC (Pixel-by-pixel check)
            // Instead of standard stroke, we need to manually process the area under the brush.
            // For performance, we only do this when moving or clicking.
            
            // 1. Get Base Image Data under brush area
            const r = brushSize;
            const startX = Math.floor(x - r);
            const startY = Math.floor(y - r);
            const diam = Math.ceil(r * 2);
            
            // Create a temporary canvas to read base image data efficiently
            const tempC = document.createElement('canvas');
            tempC.width = diam; tempC.height = diam;
            const tCtx = tempC.getContext('2d')!;
            tCtx.drawImage(baseImgObj, startX, startY, diam, diam, 0, 0, diam, diam);
            const baseData = tCtx.getImageData(0, 0, diam, diam).data;
            
            // Get Mask Data
            const maskDataImg = ctx.getImageData(startX, startY, diam, diam);
            const maskData = maskDataImg.data;
            
            const target = targetColorRef.current;
            const tol = wandTolerance * 2; // Allow some flex
            
            for (let i = 0; i < diam; i++) { // y inside patch
                for (let j = 0; j < diam; j++) { // x inside patch
                    const dx = j - r;
                    const dy = i - r;
                    if (dx*dx + dy*dy <= r*r) { // Inside brush circle
                        const pIdx = (i * diam + j) * 4;
                        const br = baseData[pIdx];
                        const bg = baseData[pIdx+1];
                        const bb = baseData[pIdx+2];
                        
                        const diff = Math.abs(br - target.r) + Math.abs(bg - target.g) + Math.abs(bb - target.b);
                        
                        if (diff <= tol) {
                            // Pixel belongs to garment, apply brush action
                            if (activeTool === 'BRUSH') {
                                maskData[pIdx] = 255; maskData[pIdx+1] = 255; maskData[pIdx+2] = 255; maskData[pIdx+3] = 255;
                            } else {
                                maskData[pIdx+3] = 0; // Erase alpha
                            }
                        }
                    }
                }
            }
            ctx.putImageData(maskDataImg, startX, startY);

        } else {
            // STANDARD DUMB BRUSH
            if (activeTool === 'BRUSH') {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = 'white'; 
                ctx.fillStyle = 'white';
            } else {
                ctx.globalCompositeOperation = 'destination-out'; 
                ctx.strokeStyle = 'black'; 
                ctx.fillStyle = 'black';
            }

            ctx.beginPath();
            if (lastPosRef.current) {
                ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
            } else {
                ctx.moveTo(x, y); 
            }
            ctx.lineTo(x, y);
            ctx.stroke();
            
            // Dot for single click
            if (!lastPosRef.current || (lastPosRef.current.x === x && lastPosRef.current.y === y)) {
                ctx.beginPath();
                ctx.arc(x, y, brushSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        renderCanvas(); 
    };

    const performFloodFill = (startX: number, startY: number) => {
        const maskCanvas = maskCanvasRef.current;
        if (!baseImgObj || !maskCanvas) return;
        
        // Ler dados da imagem base
        const tempC = document.createElement('canvas');
        tempC.width = baseImgObj.width; tempC.height = baseImgObj.height;
        const tCtx = tempC.getContext('2d')!;
        tCtx.drawImage(baseImgObj, 0, 0);
        
        // Gera máscara baseada na tolerância de cor
        const res = createMockupMask(tCtx, tempC.width, tempC.height, startX, startY, wandTolerance);
        
        if (res) {
            // STORE REFERENCE COLOR FOR SMART BRUSH
            if (res.referenceColor) targetColorRef.current = res.referenceColor;

            // Desenha a nova área na máscara existente
            const mCtx = maskCanvas.getContext('2d')!;
            mCtx.globalCompositeOperation = 'source-over'; // Adiciona (União)
            mCtx.drawImage(res.maskCanvas, 0, 0);
            renderCanvas();
        }
    };

    const clearMasks = () => {
        const maskCanvas = maskCanvasRef.current;
        if (maskCanvas) {
            const ctx = maskCanvas.getContext('2d')!;
            ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
            targetColorRef.current = null; // Reset smart color
            renderCanvas();
        }
    };

    // --- OTHER HANDLERS ---
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

    const downloadResult = () => {
        if (canvasRef.current) {
            const link = document.createElement('a');
            link.download = 'vingi-look.jpg';
            link.href = canvasRef.current.toDataURL('image/jpeg', 0.95);
            link.click();
        }
    };

    // --- NEW FUNCTIONS ---
    
    // UNIFIED SEARCH LOGIC
    const performSearch = async (overridePrompt?: string, overrideImage?: string) => {
        setIsSearching(true);
        setLoadingMessage("Detectando estrutura...");
        setWhiteBases([]);

        const promptToSend = overridePrompt || searchQuery;
        const imageToSend = overrideImage || (referenceImage && !searchQuery ? referenceImage.split(',')[1] : null);

        try {
            // 1. Get Queries (Contextual to High Contrast)
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'FIND_WHITE_MODELS',
                    prompt: promptToSend,
                    mainImageBase64: imageToSend
                })
            });
            const data = await response.json();

            if (data.success && data.queries) {
                setLoadingMessage("Buscando modelos com contraste ideal...");
                const queries = data.queries;
                
                const promises = queries.map(async (q: string) => {
                    try {
                        const res = await fetch('/api/analyze', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                action: 'GET_LINK_PREVIEW',
                                targetUrl: '',
                                backupSearchTerm: q
                            })
                        });
                        const d = await res.json();
                        return d.success ? d.image : null;
                    } catch { return null; }
                });
                const results = await Promise.all(promises);
                const validResults = results.filter((url: string | null) => url !== null) as string[];
                setWhiteBases(validResults);
                
                if (validResults.length === 0) {
                     setLoadingMessage("Nenhum modelo compatível encontrado.");
                }
            }
        } catch (e) {
            console.error("Search failed", e);
            setLoadingMessage("Erro na conexão.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleFindSimilarWhite = () => {
        if (!referenceImage) return;
        // Strip prefix for sending
        const base64 = referenceImage.split(',')[1];
        performSearch(undefined, base64);
    };

    const handleBaseSelect = (url: string) => {
        setReferenceImage(url);
        setSelectedBase(url);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePatternUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setSelectedPattern(ev.target?.result as string);
                setStep('STUDIO');
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f0f2f5] overflow-hidden">
            {step !== 'SEARCH_BASE' && <ModuleHeader icon={Camera} title="Provador Mágico" subtitle="Simulação Realista em Modelos" />}
            
            {step === 'SEARCH_BASE' && (
                <div className="flex-1 overflow-y-auto">
                    <ModuleLandingPage 
                        icon={Camera}
                        title="Provador Mágico 3D"
                        description="Visualize suas estampas em modelos reais instantaneamente. Use a tecnologia 'Contrast Hunter' para simular caimento, luz e sombra em roupas brancas."
                        features={["Simulação de Caimento", "Máscara Automática", "Luz & Sombra Realista", "Modelos Diversos"]}
                        partners={["CLO3D", "MARVELOUS DESIGNER", "BROWZWEAR", "OPTITEX"]}
                        customContent={
                            <div className="mt-8 space-y-6 w-full max-w-xl pb-16">
                                {/* Search Section Enhanced for Mobile */}
                                <div className="space-y-3 bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-2 mb-1">Passo 1: Encontrar Base</h3>
                                    <div className="relative group">
                                        <input 
                                            ref={searchInputRef}
                                            type="text" 
                                            value={searchQuery} 
                                            onChange={(e) => setSearchQuery(e.target.value)} 
                                            onKeyDown={(e) => e.key === 'Enter' && performSearch()} 
                                            placeholder="Descreva o Modelo (Ex: Vestido Longo Branco)" 
                                            // Disabled only if searching
                                            disabled={isSearching} 
                                            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 shadow-inner focus:border-vingi-500 focus:ring-4 focus:ring-vingi-500/10 outline-none text-base pl-12 disabled:bg-gray-100 disabled:text-gray-400 transition-all bg-gray-50/50" 
                                        />
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-vingi-500 transition-colors" size={20}/>
                                    </div>
                                    <button 
                                        onClick={() => performSearch()} 
                                        disabled={!searchQuery || isSearching}
                                        className={`w-full py-4 text-white rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 shadow-lg ${isSearching ? 'bg-gray-400 cursor-wait' : 'bg-vingi-900 hover:bg-vingi-800 shadow-vingi-900/20'}`}
                                    >
                                        {isSearching ? <Loader2 className="animate-spin" size={18}/> : <><Sparkles size={18}/> BUSCAR MODELOS</>}
                                    </button>
                                </div>
                                
                                {isSearching && <div className="text-vingi-600 font-bold text-xs flex items-center justify-center gap-2 py-4 animate-pulse"><Loader2 className="animate-spin" size={16}/> {loadingMessage}</div>}
                                
                                {whiteBases.length > 0 && (
                                    <div className="space-y-2 animate-fade-in">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Bases Sugeridas (Pele Morena + Fundo Escuro):</p>
                                        <div className="grid grid-cols-2 gap-3 pb-10">
                                            {whiteBases.map((url, i) => (
                                                <div key={i} onClick={() => handleBaseSelect(url)} className="aspect-[3/4] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer active:scale-95 transition-all group relative hover:ring-4 ring-vingi-500/30">
                                                    <img src={url} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                        <span className="bg-white text-vingi-900 px-3 py-1 rounded-full text-xs font-bold shadow-lg transform scale-110">USAR MODELO</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-4 justify-center py-2 opacity-50">
                                    <div className="h-px bg-gray-300 w-full"></div>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase whitespace-nowrap">OU USE SUA FOTO</span>
                                    <div className="h-px bg-gray-300 w-full"></div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button 
                                        onClick={() => refInputRef.current?.click()} 
                                        className={`w-full py-5 border-2 border-dashed rounded-2xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${referenceImage ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 text-gray-500 hover:border-vingi-400 hover:bg-white active:bg-gray-50'}`}
                                    >
                                        <input type="file" ref={refInputRef} onChange={handleRefImageUpload} className="hidden" accept="image/*"/>
                                        {referenceImage ? <><Check size={18}/> Imagem Carregada</> : <><ImageIcon size={20}/> Carregar Foto de Referência</>}
                                    </button>

                                    {referenceImage && !isSearching && (
                                        <button 
                                            onClick={handleFindSimilarWhite}
                                            className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-purple-700 flex items-center justify-center gap-2 animate-fade-in"
                                        >
                                            <Sparkles size={14}/> ENCONTRAR VERSÃO BRANCA PARA MOCKUP
                                        </button>
                                    )}
                                </div>
                                
                                {referenceImage && (
                                    <button 
                                        onClick={() => setStep('SELECT_PATTERN')}
                                        className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-green-700 transition-all animate-bounce-subtle flex items-center justify-center gap-2"
                                    >
                                        USAR ESTA BASE E CONTINUAR <ChevronRight size={18}/>
                                    </button>
                                )}
                            </div>
                        }
                    />
                </div>
            )}

            {step === 'SELECT_PATTERN' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
                    <div className="max-w-md w-full text-center bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                        <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6"><Layers size={32} className="text-purple-600"/></div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Passo 2: Selecione o Tecido</h2>
                        <p className="text-gray-500 text-sm mb-6">Escolha a estampa que será aplicada sobre a roupa branca.</p>
                        <div className="space-y-3 mt-6">
                            <label className="w-full py-4 border-2 border-dashed border-vingi-300 rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-vingi-50 transition-colors">
                                <UploadCloud size={20} className="text-vingi-500"/> <span className="font-bold text-vingi-700">Carregar Arquivo</span>
                                <input type="file" onChange={handlePatternUpload} accept="image/*" className="hidden"/>
                            </label>
                            <button onClick={onNavigateToCreator} className="w-full py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"><Search size={20}/> Buscar no Radar (Creator)</button>
                        </div>
                    </div>
                </div>
            )}

            {step === 'STUDIO' && (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden animate-fade-in">
                    <div className="flex-1 bg-gray-200 relative flex items-center justify-center overflow-hidden cursor-crosshair group touch-none">
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                        <div className="relative shadow-2xl max-w-full max-h-full flex items-center justify-center">
                            <canvas ref={canvasRef} 
                                onMouseDown={handlePointerDown} 
                                onMouseMove={handlePointerMove} 
                                onMouseUp={handlePointerUp}
                                onTouchStart={handlePointerDown}
                                onTouchMove={handlePointerMove}
                                onTouchEnd={handlePointerUp}
                                className="block max-w-full max-h-[85vh] object-contain bg-white" 
                                style={{ cursor: 'none' }} // Esconde cursor nativo
                            />
                            
                            {/* CUSTOM TOOL CURSOR */}
                            {activeTool !== 'WAND' && cursorPos && (
                                <div className="pointer-events-none fixed z-50 rounded-full border border-black/50 bg-white/30 backdrop-invert" 
                                     style={{ 
                                         width: brushSize * 2, 
                                         height: brushSize * 2, 
                                         left: cursorPos.x, 
                                         top: cursorPos.y,
                                         transform: 'translate(-50%, -50%)',
                                         boxShadow: '0 0 0 1px rgba(255,255,255,0.5)'
                                     }}
                                />
                            )}
                            
                             {!isMaskReady && (
                                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white px-6 py-3 rounded-full text-sm font-bold pointer-events-none backdrop-blur animate-pulse flex items-center gap-2">
                                    <Sparkles size={16} /> Ajustando Modelo...
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
                                <div className="space-y-3">
                                    {/* SMART BRUSH TOGGLE */}
                                    <div onClick={() => setSmartBrush(!smartBrush)} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${smartBrush ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck size={16} className={smartBrush ? 'text-blue-600' : 'text-gray-400'}/>
                                            <div>
                                                <span className={`text-[10px] font-bold uppercase block ${smartBrush ? 'text-blue-800' : 'text-gray-500'}`}>Proteção de Borda</span>
                                                <span className="text-[9px] text-gray-400 leading-tight">Impede pintar fora da roupa</span>
                                            </div>
                                        </div>
                                        <div className={`w-8 h-4 rounded-full relative transition-colors ${smartBrush ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${smartBrush ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase"><span>Tamanho Pincel</span><span>{brushSize}px</span></div>
                                        <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none accent-vingi-600"/>
                                    </div>
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
                                <button onClick={clearMasks} className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 flex items-center justify-center gap-2 disabled:opacity-50"><Eraser size={14}/> Limpar Tudo</button>
                                <button onClick={downloadResult} className="w-full py-4 bg-vingi-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-vingi-800 flex items-center justify-center gap-2 mt-2"><Download size={16}/> Salvar Mockup</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
