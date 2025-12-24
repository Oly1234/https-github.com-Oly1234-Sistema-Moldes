
import React, { useState, useRef, useEffect } from 'react';
import { 
    Layers, UploadCloud, Droplets, Cylinder, Download, RefreshCw, 
    Check, Activity, Eye, EyeOff, Printer, Palette, Share2, Grid3X3,
    ArrowRight, Loader2, Maximize, AlertCircle
} from 'lucide-react';
import { ModuleLandingPage, SmartImageViewer } from '../components/Shared';
import { PantoneColor } from '../types';

// --- UTILITÁRIOS MATEMÁTICOS PARA SEPARAÇÃO (K-MEANS) ---
const hexToRgb = (hex: string) => {
    const bigint = parseInt(hex.replace('#', ''), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
};

const getDistance = (p1: number[], p2: number[]) => {
    return Math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2 + (p1[2]-p2[2])**2);
};

// Processamento de Imagem no Cliente (Worker Simulado)
const processColorSeparation = (
    imgData: ImageData, 
    palette: PantoneColor[]
): Promise<{ masks: string[], preview: string }> => {
    return new Promise((resolve) => {
        const width = imgData.width;
        const height = imgData.height;
        const data = imgData.data;
        const totalPixels = width * height;
        
        // Converte palette para RGB
        const centroids = palette.map(c => hexToRgb(c.hex));
        const numColors = centroids.length;
        
        // Arrays para armazenar as máscaras (0 ou 255)
        // Cada cor tem seu próprio Uint8Array
        const channelData = Array.from({ length: numColors }, () => new Uint8Array(totalPixels));
        
        // Imagem Reconstruída (Preview)
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = width;
        previewCanvas.height = height;
        const previewCtx = previewCanvas.getContext('2d')!;
        const previewImgData = previewCtx.createImageData(width, height);
        
        // Loop principal (Pixel Classification)
        for (let i = 0; i < totalPixels; i++) {
            const pos = i * 4;
            const r = data[pos];
            const g = data[pos+1];
            const b = data[pos+2];
            
            // Encontra cor mais próxima
            let minDist = Infinity;
            let colorIndex = 0;
            
            for (let c = 0; c < numColors; c++) {
                const dist = getDistance([r, g, b], centroids[c]);
                if (dist < minDist) {
                    minDist = dist;
                    colorIndex = c;
                }
            }
            
            // Marca o pixel no canal correspondente
            channelData[colorIndex][i] = 255; // Branco no canal (Ativo)
            
            // Pinta o preview com a cor chapada (Indexada)
            const chosenColor = centroids[colorIndex];
            previewImgData.data[pos] = chosenColor[0];
            previewImgData.data[pos+1] = chosenColor[1];
            previewImgData.data[pos+2] = chosenColor[2];
            previewImgData.data[pos+3] = 255; // Alpha
        }
        
        previewCtx.putImageData(previewImgData, 0, 0);
        const previewUrl = previewCanvas.toDataURL('image/png');
        
        // Gera URLs para cada canal (Máscara P&B)
        const maskUrls = channelData.map(mask => {
            const cCanvas = document.createElement('canvas');
            cCanvas.width = width;
            cCanvas.height = height;
            const cCtx = cCanvas.getContext('2d')!;
            const cImgData = cCtx.createImageData(width, height);
            
            for (let j = 0; j < totalPixels; j++) {
                const val = mask[j];
                const p = j * 4;
                // Máscara Têxtil: Preto = Tinta, Branco = Fundo (Ou vice versa, ajustável)
                // Aqui faremos: Preto = Tinta (Padrão de Fotolito)
                const displayVal = val === 255 ? 0 : 255; 
                cImgData.data[p] = displayVal;
                cImgData.data[p+1] = displayVal;
                cImgData.data[p+2] = displayVal;
                cImgData.data[p+3] = 255;
            }
            cCtx.putImageData(cImgData, 0, 0);
            return cCanvas.toDataURL('image/png');
        });
        
        resolve({ masks: maskUrls, preview: previewUrl });
    });
};

const compressForLab = (base64Str: string | null): Promise<{ url: string, w: number, h: number }> => {
    return new Promise((resolve, reject) => {
        if (!base64Str) { reject(); return; }
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 1500; // Limite para performance do JS
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
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    
    const [viewMode, setViewMode] = useState<'ORIGINAL' | 'INDEXED'>('INDEXED');
    const [activeChannel, setActiveChannel] = useState<number | null>(null); // null = Composto
    
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            setStatus("IA: Analisando Cores Dominantes...");
            const cleanBase64 = imgBase64.split(',')[1];
            
            // 1. Ask Gemini for the Palette
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
            
            // 2. Perform Pixel Separation (Client Side)
            setStatus("CPU: Indexando Pixels & Gerando Máscaras...");
            
            // Need ImageData
            const img = new Image();
            img.src = imgBase64;
            img.onload = async () => {
                const cvs = document.createElement('canvas');
                cvs.width = img.width; cvs.height = img.height;
                const ctx = cvs.getContext('2d')!;
                ctx.drawImage(img, 0, 0);
                const imgData = ctx.getImageData(0, 0, img.width, img.height);
                
                const result = await processColorSeparation(imgData, data.colors);
                setMasks(result.masks);
                setPreviewImage(result.preview);
                setIsAnalyzing(false);
            };

        } catch (e) {
            console.error(e);
            setIsAnalyzing(false);
            alert("Erro no processo de separação.");
        }
    };

    const downloadChannel = (index: number) => {
        const link = document.createElement('a');
        link.download = `Cilindro_${index+1}_${colors[index].name.replace(/\s/g, '_')}.png`;
        link.href = masks[index];
        link.click();
    };

    return (
        <div className="flex flex-col h-full bg-[#080808] text-white">
            {/* HEADER */}
            <div className="h-16 bg-[#111] border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                        <Layers size={20} className="text-white"/>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold uppercase tracking-widest text-white">Color Lab</h1>
                        <p className="text-[10px] text-cyan-400 font-mono">Rotary Screen Separation Engine</p>
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
                        description="Converta estampas complexas em cilindros de impressão rotativa. A IA identifica a paleta técnica e gera máscaras de cor prontas para Photoshop (PSD/PNG)." 
                        primaryActionLabel="Carregar Estampa" 
                        onPrimaryAction={() => fileInputRef.current?.click()} 
                        features={["Indexação K-Means", "Máscaras P&B", "Paleta TCX", "Preview em Tempo Real"]}
                        versionLabel="COLOR ENGINE 2.0"
                    />
                </div>
            ) : (
                <div className="flex-1 flex overflow-hidden">
                    {/* VISUALIZER (LEFT) */}
                    <div className="flex-1 bg-[#020202] relative flex flex-col">
                        {/* Toolbar View Mode */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/80 backdrop-blur-md rounded-full p-1 border border-white/10 flex gap-1 shadow-2xl">
                            <button onClick={() => { setViewMode('ORIGINAL'); setActiveChannel(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${viewMode === 'ORIGINAL' && activeChannel === null ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}>Original</button>
                            <button onClick={() => { setViewMode('INDEXED'); setActiveChannel(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${viewMode === 'INDEXED' && activeChannel === null ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Indexado</button>
                            {activeChannel !== null && (
                                <div className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase bg-white text-black flex items-center gap-2 animate-fade-in">
                                    <Cylinder size={12}/> Canal {activeChannel + 1}
                                </div>
                            )}
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
                                    {/* Exibição Condicional */}
                                    {activeChannel !== null && masks[activeChannel] ? (
                                        <SmartImageViewer src={masks[activeChannel]} className="bg-white" />
                                    ) : viewMode === 'ORIGINAL' ? (
                                        <SmartImageViewer src={originalImage} />
                                    ) : (
                                        <SmartImageViewer src={previewImage || originalImage} />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CONTROL PANEL (RIGHT) */}
                    <div className="w-80 bg-[#0a0a0a] border-l border-white/5 flex flex-col z-20 shadow-2xl">
                        <div className="p-5 border-b border-white/5">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-2"><Palette size={12}/> Matriz de Cores</h3>
                            <p className="text-[9px] text-gray-600">{colors.length} Cilindros Identificados</p>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                            {isAnalyzing ? (
                                Array.from({length: 6}).map((_, i) => (
                                    <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse"></div>
                                ))
                            ) : (
                                colors.map((color, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => setActiveChannel(activeChannel === idx ? null : idx)}
                                        className={`group relative p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${activeChannel === idx ? 'bg-white/10 border-cyan-500/50' : 'bg-black border-white/5 hover:bg-white/5'}`}
                                    >
                                        {/* Color Swatch */}
                                        <div className="w-10 h-10 rounded-lg shrink-0 shadow-inner border border-white/10 relative overflow-hidden" style={{ backgroundColor: color.hex }}>
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-black/10"></div>
                                        </div>
                                        
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <span className="text-[10px] font-bold text-gray-300 truncate uppercase">Cilindro 0{idx + 1}</span>
                                                {activeChannel === idx && <Eye size={12} className="text-cyan-400"/>}
                                            </div>
                                            <p className="text-[11px] font-black text-white truncate">{color.name}</p>
                                            <p className="text-[9px] text-gray-500 font-mono">{color.code}</p>
                                        </div>

                                        {/* Actions */}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); downloadChannel(idx); }}
                                            className="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-colors"
                                            title="Baixar Fotolito"
                                        >
                                            <Download size={14}/>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-white/5 bg-[#050505]">
                            <div className="bg-blue-900/10 border border-blue-500/20 p-3 rounded-lg flex gap-3">
                                <AlertCircle size={16} className="text-blue-400 shrink-0 mt-0.5"/>
                                <div>
                                    <h4 className="text-[10px] font-bold text-blue-300 uppercase mb-1">Dica de Produção</h4>
                                    <p className="text-[9px] text-blue-200/70 leading-relaxed">
                                        Os arquivos exportados são máscaras binárias (Preto/Branco). No Photoshop, use-os como canais Alpha (Spot Channels) para colorização exata.
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
