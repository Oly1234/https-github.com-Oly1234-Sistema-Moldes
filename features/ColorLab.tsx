import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
    Layers, UploadCloud, Droplets, Cylinder, Download, RefreshCw, 
    Check, Activity, Eye, EyeOff, Printer, Palette, Share2, Grid3X3,
    ArrowRight, Loader2, Maximize, AlertCircle, GripVertical, CheckCircle2,
    ZoomIn, ZoomOut, Move, RotateCcw, Wand2, Eraser, ScanLine
} from 'lucide-react';
import { ModuleLandingPage } from '../components/Shared';
import { PantoneColor } from '../types';

// --- MATH UTILS ---
const hexToRgb = (hex: string) => {
    const bigint = parseInt(hex.replace('#', ''), 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
};

// --- TEXTILE REVISOR ENGINE (NOVO MOTOR DE LIMPEZA) ---
const applyTextileRevision = (
    masks: Uint8Array[], 
    width: number, 
    height: number,
    colors: PantoneColor[]
): Uint8Array[] => {
    // Clona as máscaras para não destruir o original
    const newMasks = masks.map(m => new Uint8Array(m));
    const totalPixels = width * height;

    // 1. DESPECKLE (Limpeza de Ruído Isolado)
    // Remove pixels solitários que são sujeira de digitalização ou compressão
    for (let m = 0; m < newMasks.length; m++) {
        const mask = newMasks[m];
        // Pula o canal de fundo (geralmente o primeiro ou maior área) para não criar buracos
        if (colors[m].group?.includes('Fundo')) continue;

        for (let i = 0; i < totalPixels; i++) {
            if (mask[i] > 0 && mask[i] < 255) { // Apenas pixels de borda/fracos
                // Verifica vizinhos (Cruz)
                const x = i % width;
                const up = i - width > 0 ? mask[i - width] : 0;
                const down = i + width < totalPixels ? mask[i + width] : 0;
                const left = x > 0 ? mask[i - 1] : 0;
                const right = x < width - 1 ? mask[i + 1] : 0;

                // Se o pixel está isolado (poucos vizinhos da mesma cor), mata ele ou funde
                const neighbors = (up > 0 ? 1 : 0) + (down > 0 ? 1 : 0) + (left > 0 ? 1 : 0) + (right > 0 ? 1 : 0);
                
                if (neighbors < 2) {
                    // É ruído. Apaga deste canal.
                    mask[i] = 0;
                    // Opcional: A lógica de preenchimento (Trapping) abaixo vai cuidar de preencher esse buraco com a cor vizinha dominante
                }
            }
        }
    }

    // 2. SMART TRAPPING (Preenchimento de Gaps)
    // Se um pixel não tem nenhuma tinta (buraco branco), expande o vizinho mais próximo
    const compositeMap = new Uint8Array(totalPixels); // Mapa de ocupação
    for (let i = 0; i < totalPixels; i++) {
        for (let m = 0; m < newMasks.length; m++) {
            if (newMasks[m][i] > 10) compositeMap[i] = 1; // Tem tinta
        }
    }

    for (let i = 0; i < totalPixels; i++) {
        if (compositeMap[i] === 0) { // BURACO (Branco indesejado)
            // Procura qual cor domina ao redor (Dilatação)
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

            // Se achou um vizinho dominante, preenche o buraco com ele (Trapping)
            if (bestMaskIdx !== -1) {
                newMasks[bestMaskIdx][i] = 255; // Preenchimento Sólido para segurança
            }
        }
    }

    return newMasks;
};

// --- ENGINE DE SEPARAÇÃO (SPECTRAL UNMIXING) ---
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
            
            // 1. Distância Euclidiana para cada cor da paleta
            let candidates = [];
            for (let c = 0; c < numColors; c++) {
                const pr = rgbPalette[c].r, pg = rgbPalette[c].g, pb = rgbPalette[c].b;
                const dist = Math.sqrt((r-pr)**2 + (g-pg)**2 + (b-pb)**2);
                candidates.push({ index: c, dist });
            }
            candidates.sort((a, b) => a.dist - b.dist);
            
            const best = candidates[0];
            const type = palette[best.index].type || 'SOLID';

            // LÓGICA DE CANAL (Opacity Preservation)
            if (type === 'SOLID' || type === 'DETAIL') {
                // Chapado rigoroso
                if (best.dist < 100) channelMasks[best.index][i] = 255;
            } 
            else if (type === 'GRADIENT') {
                // Degradê inteligente: Mantém a opacidade baseada na "força" da cor
                // Se a cor é muito parecida (dist < 20), é 100%. Se afasta, cai a opacidade.
                // Isso cria o "Tom sobre Tom" no mesmo canal.
                const intensity = Math.max(0, 255 - (best.dist * 2.5)); 
                channelMasks[best.index][i] = intensity;
            }
            else {
                channelMasks[best.index][i] = 255;
            }
        }

        // Gera URLs apenas para preview inicial, mas retorna RAW para o Revisor
        const maskUrls = channelMasks.map(mask => {
            const cCanvas = document.createElement('canvas');
            cCanvas.width = width; cCanvas.height = height;
            const cCtx = cCanvas.getContext('2d')!;
            const cImgData = cCtx.createImageData(width, height);
            for (let j = 0; j < totalPixels; j++) {
                const val = 255 - mask[j]; // Inverte para visualização (Tinta=Preto)
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
            const maxSize = 1500; // Aumentado para melhor detalhe
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
    const [masks, setMasks] = useState<string[]>([]); // URLs para visualização rápida
    const [rawMasks, setRawMasks] = useState<Uint8Array[]>([]); // Dados brutos para revisão
    
    const [layerVisibility, setLayerVisibility] = useState<boolean[]>([]);
    
    const [viewMode, setViewMode] = useState<'COMPOSITE' | 'SINGLE'>('COMPOSITE');
    const [activeChannel, setActiveChannel] = useState<number | null>(null);
    const [halftoneMode, setHalftoneMode] = useState(false);
    const [isRevised, setIsRevised] = useState(false);
    
    // ZOOM & PAN STATE
    const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
    const isDragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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
            // Limpa com transparência (Xadrez via CSS)
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Se estivermos usando RAW MASKS (mais rápido após revisão), usamos elas.
            // Se não, carregamos as imagens (URLs).
            // Para performance e consistência com o motor de revisão, vamos preferir usar rawMasks se disponível.
            
            if (rawMasks.length > 0) {
                const w = canvas.width;
                const h = canvas.height;
                const finalImgData = ctx.createImageData(w, h);
                const pData = finalImgData.data;

                // Para cada pixel, compomos as cores (Multiply Logic Manual)
                for (let i = 0; i < w * h; i++) {
                    // Começa com branco (papel)
                    let r = 255, g = 255, b = 255, a = 0;

                    // Itera camadas (de baixo pra cima ou ordem de impressão)
                    // Ordem de impressão: Geralmente do mais claro pro mais escuro ou Fundo primeiro.
                    // Vamos assumir a ordem do array colors.
                    
                    for (let c = 0; c < colors.length; c++) {
                        // Verifica visibilidade
                        if (viewMode === 'SINGLE' && activeChannel !== c) continue;
                        if (viewMode === 'COMPOSITE' && !layerVisibility[c]) continue;

                        const alphaMask = rawMasks[c][i]; // 0 a 255
                        if (alphaMask === 0) continue;

                        const rgb = hexToRgb(colors[c].hex);
                        const alphaFloat = alphaMask / 255;

                        // Simulação de Retícula (Estocástica simples)
                        let effectiveAlpha = alphaFloat;
                        if (halftoneMode && colors[c].type === 'GRADIENT') {
                            const noise = Math.random();
                            effectiveAlpha = alphaFloat > noise ? 1 : 0;
                        }

                        if (effectiveAlpha > 0) {
                            // Multiply Blend Mode Simples: Result = A * B / 255
                            r = (r * rgb.r) / 255;
                            g = (g * rgb.g) / 255;
                            b = (b * rgb.b) / 255;
                            a = 255; // Se tem tinta, tem alpha
                        }
                    }
                    
                    pData[i*4] = r;
                    pData[i*4+1] = g;
                    pData[i*4+2] = b;
                    pData[i*4+3] = a; // Alpha do canvas final
                }
                ctx.putImageData(finalImgData, 0, 0);
            } else {
                // Fallback para imagens (Modo legado ou carregamento inicial)
                // ... (código anterior de drawImage)
            }
        };
        
        requestAnimationFrame(() => renderComposite());

    }, [colors, masks, rawMasks, layerVisibility, viewMode, activeChannel, halftoneMode, originalDims]);

    // --- ZOOM HANDLERS ---
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey || e.deltaY) {
            e.preventDefault();
            const scaleChange = -e.deltaY * 0.001;
            const newScale = Math.min(Math.max(0.1, transform.k + scaleChange), 10);
            setTransform(p => ({ ...p, k: newScale }));
        }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        setTransform(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    const resetView = () => setTransform({ k: 1, x: 0, y: 0 });

    // --- ACTIONS ---
    const startSeparation = async (imgBase64: string) => {
        try {
            setStatus("IA: Analisando Grupos Semânticos...");
            const cleanBase64 = imgBase64.split(',')[1];
            
            const res = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    action: 'ANALYZE_SEPARATION', 
                    mainImageBase64: cleanBase64, 
                    mainMimeType: 'image/jpeg' 
                }) 
            });
            
            const data = await res.json();
            if (!data.success || !data.colors) throw new Error("Falha na análise de cor.");
            
            setColors(data.colors);
            setLayerVisibility(new Array(data.colors.length).fill(true));
            setIsRevised(false);
            
            setStatus("CPU: Unmixing de Canais (Degradês & Filetes)...");
            
            const img = new Image();
            img.src = imgBase64;
            img.onload = async () => {
                const cvs = document.createElement('canvas');
                cvs.width = img.width; cvs.height = img.height;
                const ctx = cvs.getContext('2d')!;
                ctx.drawImage(img, 0, 0);
                const imgData = ctx.getImageData(0, 0, img.width, img.height);
                
                const result = await processAdvancedSeparation(imgData, data.colors);
                setMasks(result.masks);
                setRawMasks(result.rawMasks);
                setIsAnalyzing(false);
            };

        } catch (e) {
            console.error(e);
            setIsAnalyzing(false);
            alert("Erro no processo de separação.");
        }
    };

    const runRevisor = async () => {
        if (rawMasks.length === 0 || !originalDims) return;
        setIsAnalyzing(true);
        setStatus("REVISOR TÊXTIL: Limpando ruídos e fazendo trapping...");
        
        // Timeout para UI atualizar
        setTimeout(() => {
            const revisedRaw = applyTextileRevision(rawMasks, originalDims.w, originalDims.h, colors);
            setRawMasks(revisedRaw);
            setIsRevised(true);
            setIsAnalyzing(false);
        }, 100);
    };

    const downloadChannel = (index: number) => {
        // Gera o PNG na hora a partir do RAW para garantir que baixamos a versão revisada
        const mask = rawMasks[index];
        const canvas = document.createElement('canvas');
        canvas.width = originalDims!.w;
        canvas.height = originalDims!.h;
        const ctx = canvas.getContext('2d')!;
        const imgData = ctx.createImageData(canvas.width, canvas.height);
        
        for (let j = 0; j < mask.length; j++) {
            const val = 255 - mask[j]; // Inverte: Tinta(255) -> Preto(0) para Fotolito
            imgData.data[j*4] = val; 
            imgData.data[j*4+1] = val; 
            imgData.data[j*4+2] = val; 
            imgData.data[j*4+3] = 255; 
        }
        ctx.putImageData(imgData, 0, 0);
        
        const link = document.createElement('a');
        link.download = `Cilindro_${index+1}_${colors[index].name.replace(/\s/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
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
        setLayerVisibility(prev => {
            const next = [...prev];
            next[index] = !next[index];
            return next;
        });
    };

    // Agrupamento para a UI
    const groupedColors = useMemo(() => {
        const groups: Record<string, { color: PantoneColor, index: number }[]> = {};
        colors.forEach((c, i) => {
            const gName = c.group || "Geral";
            if (!groups[gName]) groups[gName] = [];
            groups[gName].push({ color: c, index: i });
        });
        return groups;
    }, [colors]);

    return (
        <div className="flex flex-col h-full bg-[#080808] text-white">
            {/* HEADER */}
            <div className="h-16 bg-[#111] border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                        <Layers size={20} className="text-white"/>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold uppercase tracking-widest text-white">Color Lab <span className="text-[9px] bg-white/10 px-1 rounded ml-1 text-cyan-400">PRO</span></h1>
                        <p className="text-[10px] text-gray-500 font-mono">Advanced Separation Engine</p>
                    </div>
                </div>
                
                {originalImage && !isAnalyzing && (
                    <div className="flex gap-2">
                        <button onClick={() => { setOriginalImage(null); setMasks([]); setRawMasks([]); setColors([]); }} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-lg border border-white/10 transition-colors">Nova Imagem</button>
                    </div>
                )}
            </div>

            {/* MAIN CONTENT */}
            {!originalImage ? (
                <div className="flex-1 bg-[#050505] overflow-y-auto">
                    <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" />
                    <ModuleLandingPage 
                        icon={Cylinder} 
                        title="Separação de Cores IA" 
                        description="Converta estampas complexas em cilindros de impressão. A IA identifica grupos semânticos (Fundo, Floral, Sombras) e gera separações suaves com suporte a degradê e retícula." 
                        primaryActionLabel="Carregar Estampa" 
                        onPrimaryAction={() => fileInputRef.current?.click()} 
                        features={["Spectral Unmixing", "Degradês & Sombras", "Filetes Nítidos", "Simulação de Retícula"]}
                        versionLabel="COLOR ENGINE 3.0"
                    />
                </div>
            ) : (
                <div className="flex-1 flex overflow-hidden">
                    {/* VISUALIZER (LEFT) */}
                    <div className="flex-1 bg-[#020202] relative flex flex-col overflow-hidden">
                        {/* Toolbar View Mode */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-black/80 backdrop-blur-md rounded-full p-1 border border-white/10 flex gap-1 shadow-2xl items-center">
                            <button onClick={() => { setViewMode('COMPOSITE'); setActiveChannel(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${viewMode === 'COMPOSITE' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Composto</button>
                            <div className="w-px h-4 bg-white/10 mx-1"></div>
                            <button onClick={() => setHalftoneMode(!halftoneMode)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${halftoneMode ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}>
                                <Grid3X3 size={12}/> Retícula {halftoneMode ? 'ON' : 'OFF'}
                            </button>
                        </div>

                        {/* Canvas Area with Zoom/Pan */}
                        <div 
                            ref={containerRef}
                            className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#050505] cursor-grab active:cursor-grabbing touch-none"
                            onWheel={handleWheel}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerLeave={handlePointerUp}
                        >
                            {/* Grid Background */}
                            <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                            {isAnalyzing ? (
                                <div className="text-center animate-pulse relative z-50">
                                    <Loader2 size={48} className="text-cyan-500 animate-spin mx-auto mb-4"/>
                                    <h3 className="text-xl font-bold text-white">{status}</h3>
                                    <p className="text-xs text-gray-500 mt-2 font-mono">PROCESSAMENTO DE PIXEL EM ANDAMENTO</p>
                                </div>
                            ) : (
                                <div 
                                    className="relative shadow-2xl transition-transform duration-75 ease-linear will-change-transform bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-[#111]"
                                    style={{ 
                                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
                                        width: originalDims?.w, 
                                        height: originalDims?.h 
                                    }}
                                >
                                    <canvas 
                                        ref={compositeCanvasRef} 
                                        className="w-full h-full block"
                                    />
                                    
                                    {/* Indicador de Canal Único */}
                                    {viewMode === 'SINGLE' && activeChannel !== null && (
                                        <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none border-4 border-cyan-500/50 mix-blend-screen"></div>
                                    )}
                                </div>
                            )}

                            {/* Zoom Controls */}
                            <div className="absolute bottom-6 left-6 flex gap-2 z-30">
                                <button onClick={() => setTransform(p => ({...p, k: p.k * 1.2}))} className="bg-black/80 p-2 rounded-lg text-white hover:bg-cyan-600 transition-colors border border-white/10"><ZoomIn size={16}/></button>
                                <button onClick={() => setTransform(p => ({...p, k: p.k * 0.8}))} className="bg-black/80 p-2 rounded-lg text-white hover:bg-cyan-600 transition-colors border border-white/10"><ZoomOut size={16}/></button>
                                <button onClick={resetView} className="bg-black/80 p-2 rounded-lg text-white hover:bg-cyan-600 transition-colors border border-white/10"><RotateCcw size={16}/></button>
                            </div>
                        </div>
                    </div>

                    {/* CONTROL PANEL (RIGHT) */}
                    <div className="w-80 bg-[#0a0a0a] border-l border-white/5 flex flex-col z-20 shadow-2xl shrink-0">
                        <div className="p-5 border-b border-white/5">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2"><Palette size={12}/> Cilindros ({colors.length})</h3>
                            
                            {/* REVISOR BUTTON */}
                            <button 
                                onClick={runRevisor}
                                disabled={isRevised}
                                className={`w-full py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all mb-2 ${isRevised ? 'bg-green-900/30 text-green-400 border border-green-500/30 cursor-default' : 'bg-vingi-600 hover:bg-vingi-500 text-white shadow-lg animate-pulse-slow'}`}
                            >
                                {isRevised ? <CheckCircle2 size={14}/> : <ScanLine size={14}/>}
                                {isRevised ? "Revisão Concluída" : "Revisão Têxtil (AI Cleaner)"}
                            </button>

                            <div className="flex gap-2 justify-between">
                                <button onClick={() => setLayerVisibility(new Array(colors.length).fill(true))} className="text-[9px] text-cyan-500 hover:underline">Mostrar Todos</button>
                                <button onClick={() => setLayerVisibility(new Array(colors.length).fill(false))} className="text-[9px] text-red-500 hover:underline">Ocultar Todos</button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                            {isAnalyzing ? (
                                Array.from({length: 6}).map((_, i) => (
                                    <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse"></div>
                                ))
                            ) : (
                                Object.entries(groupedColors).map(([groupName, groupItems]) => (
                                    <div key={groupName} className="space-y-2">
                                        <div className="text-[9px] font-black uppercase text-gray-600 px-1 flex items-center gap-2">
                                            <div className="h-px bg-white/10 flex-1"></div>
                                            {groupName}
                                            <div className="h-px bg-white/10 flex-1"></div>
                                        </div>
                                        {(groupItems as { color: PantoneColor, index: number }[]).map(({ color, index }) => (
                                            <div 
                                                key={index} 
                                                className={`group relative p-2 rounded-xl border transition-all flex items-center gap-3 ${activeChannel === index && viewMode === 'SINGLE' ? 'bg-white/10 border-cyan-500/50' : 'bg-black border-white/5 hover:bg-white/5'}`}
                                            >
                                                {/* Visibility Toggle */}
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); toggleLayer(index); }}
                                                    className={`p-1.5 rounded-lg transition-colors ${layerVisibility[index] ? 'text-cyan-400 bg-cyan-900/20' : 'text-gray-600 bg-white/5'}`}
                                                >
                                                    {layerVisibility[index] ? <Eye size={14}/> : <EyeOff size={14}/>}
                                                </button>

                                                {/* Click to Solo View */}
                                                <div 
                                                    className="flex-1 flex items-center gap-3 cursor-pointer"
                                                    onClick={() => { setActiveChannel(index); setViewMode('SINGLE'); }}
                                                >
                                                    {/* Color Swatch */}
                                                    <div className="w-8 h-8 rounded-lg shrink-0 shadow-inner border border-white/10 relative overflow-hidden" style={{ backgroundColor: color.hex }}>
                                                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-black/10"></div>
                                                    </div>
                                                    
                                                    {/* Info */}
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-gray-300 truncate">{color.name}</span>
                                                            {color.type === 'GRADIENT' && <span className="text-[8px] bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-500/20">Degradê</span>}
                                                            {color.type === 'DETAIL' && <span className="text-[8px] bg-amber-900/50 text-amber-300 px-1 rounded border border-amber-500/20">Filete</span>}
                                                        </div>
                                                        <p className="text-[9px] text-gray-500 font-mono">{color.code}</p>
                                                    </div>
                                                </div>

                                                {/* Download */}
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); downloadChannel(index); }}
                                                    className="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-colors"
                                                    title="Baixar Fotolito"
                                                >
                                                    <Download size={14}/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-white/5 bg-[#050505]">
                            <div className="bg-cyan-900/10 border border-cyan-500/20 p-3 rounded-lg flex gap-3">
                                <CheckCircle2 size={16} className="text-cyan-400 shrink-0 mt-0.5"/>
                                <div>
                                    <h4 className="text-[10px] font-bold text-cyan-300 uppercase mb-1">Qualidade de Estúdio</h4>
                                    <p className="text-[9px] text-cyan-200/70 leading-relaxed">
                                        Use a "Revisão Têxtil" para limpar ruídos e aplicar trapping entre cores vizinhas.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};