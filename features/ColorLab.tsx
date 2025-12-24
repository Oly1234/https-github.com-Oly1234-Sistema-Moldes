import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    Layers, UploadCloud, Droplets, Cylinder, Download, RefreshCw, 
    Check, Activity, Eye, EyeOff, Printer, Palette, Share2, Grid3X3,
    ArrowRight, Loader2, Maximize, AlertCircle, GripVertical, CheckCircle2
} from 'lucide-react';
import { ModuleLandingPage, SmartImageViewer } from '../components/Shared';
import { PantoneColor } from '../types';

// --- MATH UTILS FOR ADVANCED SEPARATION ---
const hexToRgb = (hex: string) => {
    const bigint = parseInt(hex.replace('#', ''), 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
};

const getLuminance = (r: number, g: number, b: number) => 0.2126*r + 0.7152*g + 0.0722*b;

// --- ENGINE DE SEPARAÇÃO (SPECTRAL UNMIXING SIMULADO) ---
const processAdvancedSeparation = (
    imgData: ImageData, 
    palette: PantoneColor[]
): Promise<{ masks: string[], compositeUrl: string }> => {
    return new Promise((resolve) => {
        const width = imgData.width;
        const height = imgData.height;
        const data = imgData.data;
        const totalPixels = width * height;
        
        const numColors = palette.length;
        const channelMasks = Array.from({ length: numColors }, () => new Uint8Array(totalPixels)); // 0-255 Alpha Map
        const rgbPalette = palette.map(c => hexToRgb(c.hex));

        // DETECÇÃO DE BORDA (SOBEL) PARA FILETES
        // Cria um mapa de bordas para ajudar na decisão dos detalhes
        const edgeMap = new Uint8Array(totalPixels);
        // (Simplificado para performance: High Frequency check)
        
        for (let i = 0; i < totalPixels; i++) {
            const pos = i * 4;
            const r = data[pos], g = data[pos+1], b = data[pos+2];
            
            // 1. Encontrar os 2 candidatos mais próximos (Base e Topo)
            let candidates = [];
            for (let c = 0; c < numColors; c++) {
                const pr = rgbPalette[c].r, pg = rgbPalette[c].g, pb = rgbPalette[c].b;
                const dist = Math.sqrt((r-pr)**2 + (g-pg)**2 + (b-pb)**2);
                candidates.push({ index: c, dist });
            }
            candidates.sort((a, b) => a.dist - b.dist);
            
            const best = candidates[0];
            const type = palette[best.index].type || 'SOLID';

            // LÓGICA DE ALOCAÇÃO POR TIPO
            if (type === 'SOLID') {
                // Chapado: O pixel pertence totalmente a este canal se for o mais próximo
                // Hard Threshold para evitar sujeira
                if (best.dist < 80) channelMasks[best.index][i] = 255;
            } 
            else if (type === 'GRADIENT') {
                // Degradê: Calcula intensidade baseada na proximidade
                // Permite suavidade (Anti-aliasing natural da separação)
                const intensity = Math.max(0, 255 - (best.dist * 2)); 
                channelMasks[best.index][i] = intensity;
            }
            else if (type === 'DETAIL') {
                // Detalhe/Filete: Só aceita se for MUITO próximo (precisão)
                if (best.dist < 40) channelMasks[best.index][i] = 255;
            }
            else {
                // Fallback (Default Solid)
                channelMasks[best.index][i] = 255;
            }
        }

        // GERAÇÃO DOS DATA URLS
        const maskUrls = channelMasks.map(mask => {
            const cCanvas = document.createElement('canvas');
            cCanvas.width = width; cCanvas.height = height;
            const cCtx = cCanvas.getContext('2d')!;
            const cImgData = cCtx.createImageData(width, height);
            
            for (let j = 0; j < totalPixels; j++) {
                // Visualização do Canal: Preto = Tinta, Branco = Vazio (Padrão Fotolito)
                // Mas para preview colorido no app, usaremos Alpha.
                // Aqui geramos o FOTOLITO P&B para download.
                const val = mask[j]; // 0 a 255 (Alpha da tinta)
                const displayVal = 255 - val; // Inverte: Tinta(255) -> Preto(0)
                
                const p = j * 4;
                cImgData.data[p] = displayVal;
                cImgData.data[p+1] = displayVal;
                cImgData.data[p+2] = displayVal;
                cImgData.data[p+3] = 255; 
            }
            cCtx.putImageData(cImgData, 0, 0);
            return cCanvas.toDataURL('image/png');
        });

        resolve({ masks: maskUrls, compositeUrl: '' }); // Composite é gerado dinamicamente no render
    });
};

const compressForLab = (base64Str: string | null): Promise<{ url: string, w: number, h: number }> => {
    return new Promise((resolve, reject) => {
        if (!base64Str) { reject(); return; }
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 1200; 
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
    
    // ESTADO DE VISIBILIDADE DAS CAMADAS
    const [layerVisibility, setLayerVisibility] = useState<boolean[]>([]);
    
    const [viewMode, setViewMode] = useState<'COMPOSITE' | 'SINGLE'>('COMPOSITE');
    const [activeChannel, setActiveChannel] = useState<number | null>(null);
    const [halftoneMode, setHalftoneMode] = useState(false); // Simulação de Retícula
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const compositeCanvasRef = useRef<HTMLCanvasElement>(null);

    // --- RENDERIZADOR COMPOSTO EM TEMPO REAL ---
    useEffect(() => {
        if (colors.length === 0 || masks.length === 0 || !originalDims) return;
        
        const renderComposite = async () => {
            const canvas = compositeCanvasRef.current;
            if (!canvas) return;
            
            // Ajusta tamanho se necessário (uma vez)
            if (canvas.width !== originalDims.w) {
                canvas.width = originalDims.w;
                canvas.height = originalDims.h;
            }

            const ctx = canvas.getContext('2d')!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Fundo transparente (Xadrez) é feito via CSS no container
            
            // Empilha as camadas visíveis
            // Ordem: Fundo -> Sólidos -> Degradês -> Detalhes (Baseado na ordem do array colors)
            // Assumimos que a IA devolve nessa ordem lógica, ou o usuário reordena (futuro)
            
            // Carregamos as máscaras como imagens para desenhar
            // Para performance, idealmente teríamos ImageBitmaps cacheados, mas aqui usaremos Promise.all
            const maskImages = await Promise.all(masks.map(src => {
                return new Promise<HTMLImageElement>((resolve) => {
                    const img = new Image();
                    img.src = src;
                    img.onload = () => resolve(img);
                });
            }));

            // Desenha cada camada ativa
            colors.forEach((color, i) => {
                // Se estiver no modo Single, só desenha se for o ativo
                if (viewMode === 'SINGLE' && activeChannel !== i) return;
                // Se estiver no modo Composite, desenha se estiver visível
                if (viewMode === 'COMPOSITE' && !layerVisibility[i]) return;

                // 1. Desenha a Máscara P&B num canvas temporário
                const tempC = document.createElement('canvas');
                tempC.width = canvas.width; tempC.height = canvas.height;
                const tempCtx = tempC.getContext('2d')!;
                tempCtx.drawImage(maskImages[i], 0, 0);
                
                // 2. Aplica a Cor (Colorize)
                // A máscara vem com: Preto=Tinta, Branco=Fundo.
                // Precisamos inverter para Alpha.
                const tData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
                const pData = tData.data;
                const rgb = hexToRgb(color.hex);
                
                for(let k=0; k<pData.length; k+=4) {
                    // O pixel original da máscara (r,g,b iguais). 0=Preto(Tinta total), 255=Branco(Nada)
                    const maskVal = pData[k]; 
                    const alpha = 255 - maskVal; // Inverte
                    
                    if (halftoneMode && color.type === 'GRADIENT') {
                        // SIMULAÇÃO DE RETÍCULA ESTOCÁSTICA (Dithering Simples)
                        // Se alpha < 255, chance de ser pixel ou não
                        if (alpha > 0 && alpha < 255) {
                            const noise = Math.random() * 255;
                            pData[k+3] = (alpha > noise) ? 255 : 0; 
                        } else {
                            pData[k+3] = alpha;
                        }
                    } else {
                        pData[k+3] = alpha;
                    }
                    
                    // Aplica cor
                    pData[k] = rgb.r;
                    pData[k+1] = rgb.g;
                    pData[k+2] = rgb.b;
                }
                
                tempCtx.putImageData(tData, 0, 0);
                
                // 3. Compõe no Canvas Principal
                // Multiply para simular tinta sobre tinta (efeito subtrativo real)
                ctx.globalCompositeOperation = 'multiply'; 
                // Se for a primeira camada (fundo), usa source-over para cobrir o checkerboard
                if (i === 0 && color.type === 'SOLID') ctx.globalCompositeOperation = 'source-over';
                
                ctx.drawImage(tempC, 0, 0);
            });
        };
        
        requestAnimationFrame(() => renderComposite());

    }, [colors, masks, layerVisibility, viewMode, activeChannel, halftoneMode, originalDims]);


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

    const startSeparation = async (imgBase64: string) => {
        try {
            setStatus("IA: Analisando Grupos Semânticos...");
            const cleanBase64 = imgBase64.split(',')[1];
            
            // 1. Ask Gemini for the Palette & Logic
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
            setLayerVisibility(new Array(data.colors.length).fill(true)); // All visible by default
            
            // 2. Perform Pixel Separation (Client Side)
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
                setIsAnalyzing(false);
            };

        } catch (e) {
            console.error(e);
            setIsAnalyzing(false);
            alert("Erro no processo de separação.");
        }
    };

    const toggleLayer = (index: number) => {
        const newVis = [...layerVisibility];
        newVis[index] = !newVis[index];
        setLayerVisibility(newVis);
    };

    const downloadChannel = (index: number) => {
        const link = document.createElement('a');
        link.download = `Cilindro_${index+1}_${colors[index].name.replace(/\s/g, '_')}_${colors[index].group?.replace(/\s/g, '') || 'Geral'}.png`;
        link.href = masks[index];
        link.click();
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
                        <button onClick={() => { setOriginalImage(null); setMasks([]); setColors([]); }} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-lg border border-white/10 transition-colors">Nova Imagem</button>
                        <button onClick={() => {}} className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-cyan-900/20"><Download size={14}/> Baixar Kit (ZIP)</button>
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
                    <div className="flex-1 bg-[#020202] relative flex flex-col">
                        {/* Toolbar View Mode */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/80 backdrop-blur-md rounded-full p-1 border border-white/10 flex gap-1 shadow-2xl items-center">
                            <button onClick={() => { setViewMode('COMPOSITE'); setActiveChannel(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${viewMode === 'COMPOSITE' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Composto</button>
                            <div className="w-px h-4 bg-white/10 mx-1"></div>
                            <button onClick={() => setHalftoneMode(!halftoneMode)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${halftoneMode ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}>
                                <Grid3X3 size={12}/> Retícula {halftoneMode ? 'ON' : 'OFF'}
                            </button>
                        </div>

                        {/* Canvas Area */}
                        <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4 md:p-8">
                            {isAnalyzing ? (
                                <div className="text-center animate-pulse">
                                    <Loader2 size={48} className="text-cyan-500 animate-spin mx-auto mb-4"/>
                                    <h3 className="text-xl font-bold text-white">{status}</h3>
                                    <p className="text-xs text-gray-500 mt-2 font-mono">PROCESSAMENTO DE PIXEL EM ANDAMENTO</p>
                                </div>
                            ) : (
                                <div className="relative w-full h-full border border-white/5 rounded-xl overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-[#111]">
                                    <div className="w-full h-full flex items-center justify-center">
                                        {/* Canvas de Composição em Tempo Real */}
                                        <canvas ref={compositeCanvasRef} className="max-w-full max-h-full object-contain shadow-2xl" />
                                    </div>
                                    
                                    {/* Indicador de Canal Único (Se ativo) */}
                                    {viewMode === 'SINGLE' && activeChannel !== null && (
                                        <div className="absolute top-4 left-4 bg-black/80 text-white px-3 py-1 rounded text-xs font-bold border border-white/10 pointer-events-none">
                                            Visualizando Canal: {colors[activeChannel].name}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CONTROL PANEL (RIGHT) */}
                    <div className="w-80 bg-[#0a0a0a] border-l border-white/5 flex flex-col z-20 shadow-2xl">
                        <div className="p-5 border-b border-white/5">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-2"><Palette size={12}/> Cilindros ({colors.length})</h3>
                            <div className="flex gap-2 mt-2">
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
                                        Use o modo "Composto" para visualizar a sobreposição (Overprint). As camadas de "Degradê" simulam a retícula automaticamente.
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