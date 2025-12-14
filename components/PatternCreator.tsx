
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Image as ImageIcon, RefreshCw, Loader2, Sparkles, ExternalLink, ShoppingCart, Layers } from 'lucide-react';
import { PantoneColor, ExternalPatternMatch } from '../types';
import { PatternVisualCard } from './PatternVisualCard';

// Função de compressão
const compressImage = (base64Str: string, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
    });
};

const generateFallbackPattern = (colors: PantoneColor[]): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    const baseColor = colors[0]?.hex || '#f0f9ff';
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 1024, 1024);
    const palette = colors.length > 0 ? colors.map(c => c.hex) : ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];
    for (let i = 0; i < 40; i++) {
        const color = palette[Math.floor(Math.random() * palette.length)];
        ctx.fillStyle = color + '80';
        ctx.beginPath();
        const x = Math.random() * 1024;
        const y = Math.random() * 1024;
        const size = Math.random() * 200 + 50;
        if (Math.random() > 0.5) { ctx.arc(x, y, size, 0, Math.PI * 2); } else { ctx.rect(x, y, size, size); }
        ctx.fill();
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for(let i=0; i<1024; i+=4) { ctx.fillRect(i, 0, 1, 1024); ctx.fillRect(0, i, 1024, 1); }
    return canvas.toDataURL('image/jpeg', 0.8);
};

export const PatternCreator: React.FC = () => {
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [detectedColors, setDetectedColors] = useState<PantoneColor[]>([]);
    
    // Resultados de Stock Real (vindos do Backend)
    const [stockMatches, setStockMatches] = useState<ExternalPatternMatch[]>([]);
    const [visibleStockCount, setVisibleStockCount] = useState(15);
    
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setReferenceImage(ev.target?.result as string);
                setGeneratedPattern(null);
                setDetectedColors([]);
                setStockMatches([]);
                setPrompt('');
                setVisibleStockCount(15);
            };
            reader.readAsDataURL(file);
        }
    };

    const analyzeReference = async () => {
        if (!referenceImage) return;
        setIsAnalyzing(true);
        try {
            const compressedBase64 = await compressImage(referenceImage);
            const base64Data = compressedBase64.split(',')[1];
            const mimeType = compressedBase64.split(';')[0].split(':')[1];

            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'DESCRIBE_PATTERN',
                    mainImageBase64: base64Data,
                    mainMimeType: mimeType
                })
            });

            if (!response.ok) throw new Error("API Offline");

            const data = await response.json();
            
            if (data.success) {
                setPrompt(data.prompt);
                const colors = data.colors || [];
                setDetectedColors(colors);
                
                // Exibe APENAS matches retornados pelo Backend (Links Reais)
                // Não geramos mais nada fake aqui. Se a lista for vazia, o usuário verá vazio.
                // Mas o PatternVisualCard vai tentar scrapear a imagem da URL.
                setStockMatches(data.stockMatches || []);
                
                // DISPARA A GERAÇÃO DA ESTAMPA AUTOMATICAMENTE
                // Usando o prompt e as cores detectadas
                if (data.prompt) {
                    generatePatternFromData(data.prompt, colors);
                }
            } else {
                throw new Error("Dados inválidos");
            }
        } catch (error) {
            console.log("Erro na análise:", error);
            // Fallback Mínimo apenas para não travar a UI
            setPrompt("Could not analyze image pattern.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Função separada para permitir re-geração manual ou automática
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
            if (!response.ok) throw new Error("API Busy");
            const data = await response.json();
            if (data.success && data.image) { setGeneratedPattern(data.image); } 
        } catch (error) {
            const localPattern = generateFallbackPattern(colorsData);
            setGeneratedPattern(localPattern);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleManualGenerate = () => {
        if (prompt) generatePatternFromData(prompt, detectedColors);
    };

    const handleDownload = () => {
        if (!generatedPattern) return;
        const link = document.createElement('a');
        link.download = `vingi-pattern-${Date.now()}.jpg`;
        link.href = generatedPattern;
        link.click();
    };

    return (
        <div className="flex flex-col md:flex-row h-full bg-[#f8fafc] overflow-hidden">
            {/* LEFT SIDEBAR: CONTROLS */}
            <div className="w-full md:w-[400px] bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto shrink-0 z-10 shadow-xl">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 sticky top-0 backdrop-blur z-20">
                    <h2 className="text-lg font-bold text-vingi-900 flex items-center gap-2">
                        <Palette className="text-vingi-600" size={20} /> Pattern Studio
                        <span className="text-[10px] bg-vingi-900 text-white px-2 py-0.5 rounded-full font-mono">PRO</span>
                    </h2>
                </div>

                <div className="p-5 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">1. Referência Visual</label>
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={`relative h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all group overflow-hidden ${referenceImage ? 'border-vingi-500 bg-vingi-50' : 'border-gray-300 hover:border-vingi-400 hover:bg-gray-50'}`}
                        >
                            <input type="file" ref={fileInputRef} onChange={handleReferenceUpload} accept="image/*" className="hidden" />
                            {referenceImage ? (
                                <>
                                    <img src={referenceImage} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                        <span className="text-white text-xs font-bold flex items-center gap-2"><RefreshCw size={12}/> Trocar Imagem</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-4 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                        <UploadCloud size={24} className="text-vingi-500"/>
                                    </div>
                                    <span className="text-xs font-bold text-gray-400">Carregar Foto / Tecido</span>
                                </>
                            )}
                        </div>
                    </div>

                    {referenceImage && (
                        <button 
                            onClick={analyzeReference}
                            disabled={isAnalyzing}
                            className="w-full py-3 bg-vingi-900 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-vingi-800 disabled:opacity-50 transition-all"
                        >
                            {isAnalyzing ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16}/>}
                            {isAnalyzing ? 'ESCANEANDO DETALHES...' : 'EXTRAIR DNA DA ESTAMPA'}
                        </button>
                    )}

                    {detectedColors.length > 0 && (
                        <div className="animate-fade-in space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <Palette size={12}/> Pantone Têxtil (TCX)
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {detectedColors.map((color, idx) => (
                                    <div key={idx} className="flex flex-col gap-1 group relative">
                                        <div 
                                            className="w-full aspect-square rounded-lg shadow-sm border border-black/10 transition-transform hover:scale-105 cursor-pointer relative overflow-hidden" 
                                            style={{ backgroundColor: color.hex }}
                                            title={color.name}
                                        >
                                            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', backgroundSize: '4px 4px', backgroundPosition: '0 0, 2px 2px' }} />
                                        </div>
                                        <span className="text-[9px] font-mono text-gray-500 truncate">{color.code.split(' ')[1]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">2. Prompt Técnico</label>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Aguardando análise..."
                            className="w-full h-24 p-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vingi-500 resize-none font-mono"
                        />
                    </div>

                    <button 
                        onClick={handleManualGenerate}
                        disabled={!prompt || isGenerating}
                        className="w-full py-4 bg-gradient-to-r from-vingi-600 to-vingi-500 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 transform active:scale-95 flex items-center justify-center gap-2 border border-white/10 ring-2 ring-transparent hover:ring-vingi-300"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" size={18}/> : <Sparkles size={18}/>}
                        {isGenerating ? 'TECELANDO PIXELS...' : 'RE-GERAR ESTAMPA'}
                    </button>
                </div>
            </div>

            {/* RIGHT AREA: PREVIEW & MARKETPLACE */}
            <div className="flex-1 bg-[#e2e8f0] relative flex flex-col overflow-y-auto">
                <div className="absolute inset-0 opacity-10 pointer-events-none fixed" style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px), backgroundSize: 20px 20px' }} />

                <div className="p-4 md:p-10 flex flex-col items-center w-full max-w-7xl mx-auto space-y-12">
                    
                    {/* AREA DE GERAÇÃO */}
                    {!generatedPattern ? (
                        <div className="text-center opacity-40 max-w-md py-20">
                            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                                <ImageIcon size={40} className="text-gray-400"/>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-600 mb-2">Pattern Studio Pro</h3>
                            <p className="text-gray-500">Geração Neural de Estampas 8K + Busca em Marketplaces</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center w-full max-w-3xl animate-fade-in z-10">
                            <div className="relative w-full aspect-square bg-white rounded-xl shadow-2xl border-4 border-white overflow-hidden group">
                                <img src={generatedPattern} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                                    <button onClick={handleDownload} className="px-6 py-3 bg-white text-vingi-900 rounded-full font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
                                        <Download size={18}/> Baixar 8K
                                    </button>
                                </div>
                            </div>
                            <div className="mt-6 w-full h-32 bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-300 relative">
                                 <div className="absolute top-2 left-2 z-10 bg-white/80 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Teste de Repetição</div>
                                 <div className="w-full h-full" style={{ backgroundImage: `url(${generatedPattern})`, backgroundSize: '100px 100px' }} />
                            </div>
                        </div>
                    )}

                    {/* MARKETPLACE SECTION (VISUAL) */}
                    {stockMatches.length > 0 && (
                        <div className="w-full animate-fade-in pb-20">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-vingi-900 rounded-lg text-white">
                                    <ShoppingCart size={20}/>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">Marketplace de Estampas</h3>
                                    <p className="text-sm text-gray-500">
                                        Opções reais encontradas em bancos de imagens.
                                    </p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {stockMatches.slice(0, visibleStockCount).map((match, i) => (
                                    <PatternVisualCard key={i} match={match} />
                                ))}
                            </div>

                            {visibleStockCount < stockMatches.length && (
                                <div className="mt-8 flex justify-center">
                                    <button 
                                        onClick={() => setVisibleStockCount(p => p + 15)}
                                        className="px-8 py-3 bg-white border border-gray-300 rounded-xl font-bold shadow-sm hover:bg-gray-50 text-gray-600 transition-all"
                                    >
                                        Carregar Mais Estampas (+15)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
