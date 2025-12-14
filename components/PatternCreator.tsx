
import React, { useState, useRef } from 'react';
import { UploadCloud, Wand2, Download, Palette, Image as ImageIcon, RefreshCw, Loader2, Sparkles, Layers, ShoppingBag, Grid3X3, Target, Globe } from 'lucide-react';
import { PantoneColor, ExternalPatternMatch } from '../types';
import { PatternVisualCard } from './PatternVisualCard';

const compressImage = (base64Str: string | null, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!base64Str) { reject(new Error("Imagem vazia")); return; }
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL('image/jpeg', 0.8)); }
            else reject(new Error("Canvas error"));
        };
        img.onerror = () => reject(new Error("Load error"));
    });
};

export const PatternCreator: React.FC = () => {
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [detectedColors, setDetectedColors] = useState<PantoneColor[]>([]);
    const [fabricMatches, setFabricMatches] = useState<ExternalPatternMatch[]>([]);
    
    // Technical Data
    const [technicalSpecs, setTechnicalSpecs] = useState<any>(null);

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const res = ev.target?.result as string;
                if (res) {
                    setReferenceImage(res);
                    // Reset
                    setGeneratedPattern(null);
                    setDetectedColors([]);
                    setFabricMatches([]);
                    setTechnicalSpecs(null);
                    setPrompt('');
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const analyzeReference = async () => {
        if (!referenceImage) return;
        setIsAnalyzing(true);
        try {
            const compressedBase64 = await compressImage(referenceImage);
            const parts = compressedBase64.split(',');
            const meta = parts[0];
            const data = parts[1];
            
            let mimeType = 'image/jpeg';
            if (meta && meta.includes(':') && meta.includes(';')) {
                const mimePart = meta.split(':')[1];
                if (mimePart) mimeType = mimePart.split(';')[0];
            }

            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'DESCRIBE_PATTERN',
                    mainImageBase64: data,
                    mainMimeType: mimeType
                })
            });

            if (!response.ok) throw new Error("API Error");
            const resData = await response.json();
            
            if (resData.success) {
                setPrompt(resData.prompt || '');
                setDetectedColors(Array.isArray(resData.colors) ? resData.colors : []);
                setFabricMatches(Array.isArray(resData.stockMatches) ? resData.stockMatches : []);
                setTechnicalSpecs(resData.technicalSpecs || null);
                
                // Auto-generate if prompt exists
                if (resData.prompt) generatePatternFromData(resData.prompt, resData.colors || []);
            }
        } catch (error) {
            console.error("Analysis failed:", error);
            setPrompt("Could not analyze texture.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const generatePatternFromData = async (promptText: string, colorsData: PantoneColor[]) => {
        setIsGenerating(true);
        try {
             const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: promptText,
                    colors: colorsData
                })
            });
            const data = await response.json();
            if (data.success && data.image) { 
                setGeneratedPattern(data.image); 
            }
        } catch (error) {
            console.error("Gen Error", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!generatedPattern) return;
        const link = document.createElement('a');
        link.download = `vingi-texture-${Date.now()}.jpg`;
        link.href = generatedPattern;
        link.click();
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                
                {/* ESQUERDA: LABORATÓRIO (CONTROLES) */}
                <div className="w-full md:w-[380px] bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto shrink-0 z-10 shadow-xl">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 sticky top-0 backdrop-blur z-20">
                        <h2 className="text-lg font-bold text-vingi-900 flex items-center gap-2">
                            <Palette className="text-vingi-600" size={20} /> Design Lab
                            <span className="text-[10px] bg-vingi-900 text-white px-2 py-0.5 rounded-full font-mono">DIGITAL</span>
                        </h2>
                    </div>
                    
                    <div className="p-5 space-y-6">
                        {/* 1. UPLOAD */}
                        <div onClick={() => fileInputRef.current?.click()} className={`relative h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${referenceImage ? 'border-vingi-500 bg-white' : 'border-gray-300 hover:border-vingi-400 hover:bg-gray-50'}`}>
                            <input type="file" ref={fileInputRef} onChange={handleReferenceUpload} accept="image/*" className="hidden" />
                            {referenceImage ? <img src={referenceImage} className="w-full h-full object-cover rounded-xl" /> : <UploadCloud className="text-gray-400" size={32}/>}
                            {!referenceImage && <span className="text-xs font-bold text-gray-400 mt-2">Carregar Amostra</span>}
                        </div>

                        {referenceImage && (
                            <button onClick={analyzeReference} disabled={isAnalyzing} className="w-full py-3 bg-vingi-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-vingi-800 transition-colors shadow-lg">
                                {isAnalyzing ? <Loader2 className="animate-spin" size={16}/> : <Grid3X3 size={16}/>} 
                                {isAnalyzing ? 'Curadoria Digital...' : 'Buscar Estampas Reais'}
                            </button>
                        )}

                        {/* 2. DADOS TÉCNICOS */}
                        {technicalSpecs && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Target size={12}/> DNA de Superfície</h3>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-white p-2 rounded border border-gray-100">
                                        <span className="block text-gray-400 text-[9px]">Repetição</span>
                                        <span className="font-bold text-gray-700">{technicalSpecs.repeat || 'N/A'}</span>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-gray-100">
                                        <span className="block text-gray-400 text-[9px]">Motivo</span>
                                        <span className="font-bold text-gray-700">{technicalSpecs.motif || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. CORES */}
                        {detectedColors.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Paleta Detectada</h3>
                                <div className="grid grid-cols-5 gap-2">
                                    {detectedColors.map((c, i) => (
                                        <div key={i} className="aspect-square rounded-lg shadow-sm border border-gray-200 relative group cursor-help" style={{backgroundColor: c.hex}}>
                                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">{c.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 4. AÇÃO GERAR */}
                        {prompt && (
                            <div className="pt-4 border-t border-gray-100">
                                <button onClick={() => prompt && generatePatternFromData(prompt, detectedColors)} disabled={isGenerating} className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 hover:brightness-110 transition-all">
                                    {isGenerating ? <Loader2 className="animate-spin"/> : <Sparkles/>} Recriar Digitalmente
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* DIREITA: RESULTADOS (SPLIT VIEW) */}
                <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#e2e8f0]">
                    
                    {/* PARTE SUPERIOR: GERAÇÃO DIGITAL */}
                    <div className="p-6 md:p-10 flex flex-col items-center justify-center min-h-[50vh]">
                        {!generatedPattern ? (
                            <div className="text-center opacity-40">
                                <ImageIcon size={64} className="mx-auto mb-4 text-gray-400"/>
                                <h3 className="text-2xl font-bold text-gray-600">Área de Criação</h3>
                                <p className="text-gray-500">Recriação digital seamless de alta fidelidade.</p>
                            </div>
                        ) : (
                            <div className="w-full max-w-4xl flex flex-col md:flex-row gap-6 animate-fade-in">
                                <div className="flex-1">
                                    <div className="relative aspect-square bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-white group">
                                        <img src={generatedPattern} className="w-full h-full object-cover"/>
                                        <button onClick={handleDownload} className="absolute bottom-4 right-4 bg-white text-black px-5 py-2.5 rounded-full font-bold shadow-lg flex items-center gap-2 hover:scale-105 transition-transform opacity-0 group-hover:opacity-100"><Download size={16}/> Baixar 8K</button>
                                        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/20">GENERATED</div>
                                    </div>
                                </div>
                                <div className="w-full md:w-64 flex flex-col gap-4">
                                     <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 h-full">
                                         <h4 className="font-bold text-gray-500 uppercase text-xs mb-3 flex items-center gap-2"><Layers size={14}/> Teste de Repetição</h4>
                                         <div className="w-full h-48 rounded-lg shadow-inner border border-gray-100" style={{backgroundImage: `url(${generatedPattern})`, backgroundSize: '80px'}}/>
                                         <p className="text-[10px] text-gray-400 mt-2 text-center">Preview em escala 20%</p>
                                     </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PARTE INFERIOR: MARKETPLACES DIGITAIS */}
                    <div className="bg-white border-t border-gray-200 p-6 min-h-[40vh]">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Globe className="text-vingi-600"/> Marketplaces de Estampas Digitais
                            <span className="text-xs font-normal text-gray-400 ml-2">({fabricMatches.length} resultados)</span>
                        </h3>
                        
                        {fabricMatches.length === 0 ? (
                             <div className="text-center py-10 opacity-50 border-2 border-dashed border-gray-200 rounded-xl">
                                 <p className="text-sm text-gray-400">Faça o upload de uma amostra para buscar vetores e estampas licenciáveis em Patternbank, Creative Market, Etsy, etc.</p>
                             </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {fabricMatches.map((match, i) => (
                                    <PatternVisualCard key={i} match={match} userReferenceImage={referenceImage} />
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};
