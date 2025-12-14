
import React, { useState, useRef } from 'react';
import { UploadCloud, Wand2, Download, Palette, Image as ImageIcon, RefreshCw, Loader2, Sparkles, Layers } from 'lucide-react';
import { PantoneColor, ExternalPatternMatch } from '../types';

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
    
    // ESTADO MODULAR: Apenas Texturas/Tecidos aqui, não moldes.
    const [fabricMatches, setFabricMatches] = useState<ExternalPatternMatch[]>([]);
    
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
                    setGeneratedPattern(null);
                    setDetectedColors([]);
                    setFabricMatches([]);
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
            if (!compressedBase64 || !compressedBase64.includes(',')) throw new Error("Invalid Image");
            
            const parts = compressedBase64.split(',');
            const meta = parts[0];
            const data = parts[1];
            
            // PROTEÇÃO CONTRA O ERRO SPLIT
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
                // Se a API retornar matches de tecido, ok. Se não, array vazio.
                setFabricMatches(Array.isArray(resData.stockMatches) ? resData.stockMatches : []);
                
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
            } else {
                // Simples alerta, sem fallback complexo para manter o código limpo
                alert("Não foi possível gerar a estampa. Tente novamente.");
            }
        } catch (error) {
            console.error("Gen Error", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const renderColorCode = (color: any) => {
        if (!color) return 'N/A';
        const code = String(color.code || '');
        if (code.includes(' ')) return code.split(' ')[1];
        return code.substring(0, 10);
    };

    const handleDownload = () => {
        if (!generatedPattern) return;
        const link = document.createElement('a');
        link.download = `vingi-texture-${Date.now()}.jpg`;
        link.href = generatedPattern;
        link.click();
    };

    return (
        <div className="flex flex-col md:flex-row h-full bg-[#f8fafc] overflow-hidden">
            <div className="w-full md:w-[400px] bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto shrink-0 z-10 shadow-xl">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 sticky top-0 backdrop-blur z-20">
                    <h2 className="text-lg font-bold text-vingi-900 flex items-center gap-2">
                        <Palette className="text-vingi-600" size={20} /> Pattern Studio
                        <span className="text-[10px] bg-vingi-900 text-white px-2 py-0.5 rounded-full font-mono">TEXTURE ONLY</span>
                    </h2>
                </div>
                <div className="p-5 space-y-6">
                    <div onClick={() => fileInputRef.current?.click()} className={`relative h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${referenceImage ? 'border-vingi-500' : 'border-gray-300 hover:border-vingi-400'}`}>
                        <input type="file" ref={fileInputRef} onChange={handleReferenceUpload} accept="image/*" className="hidden" />
                        {referenceImage ? <img src={referenceImage} className="w-full h-full object-cover rounded-xl opacity-80" /> : <UploadCloud className="text-gray-400" size={32}/>}
                        {!referenceImage && <span className="text-xs font-bold text-gray-400 mt-2">Carregar Textura/Foto</span>}
                    </div>
                    {referenceImage && (
                        <button onClick={analyzeReference} disabled={isAnalyzing} className="w-full py-3 bg-vingi-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                            {isAnalyzing ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16}/>} Analisar DNA
                        </button>
                    )}
                    {detectedColors.length > 0 && (
                        <div className="grid grid-cols-5 gap-2">
                            {detectedColors.map((c, i) => (
                                <div key={i} className="aspect-square rounded shadow-sm border border-gray-100" style={{backgroundColor: c.hex}} title={renderColorCode(c)}/>
                            ))}
                        </div>
                    )}
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full h-24 p-3 text-xs bg-gray-50 border rounded-xl resize-none font-mono" placeholder="Prompt gerado..."/>
                    <button onClick={() => prompt && generatePatternFromData(prompt, detectedColors)} disabled={!prompt || isGenerating} className="w-full py-4 bg-gradient-to-r from-vingi-600 to-vingi-500 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2">
                        {isGenerating ? <Loader2 className="animate-spin"/> : <Sparkles/>} Gerar Textura 8K
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-[#e2e8f0] p-4 md:p-10 flex flex-col items-center overflow-y-auto">
                {!generatedPattern ? (
                    <div className="text-center opacity-40 mt-20">
                        <ImageIcon size={64} className="mx-auto mb-4 text-gray-400"/>
                        <h3 className="text-2xl font-bold">Gerador de Estampas</h3>
                        <p>Crie texturas seamless de alta resolução.</p>
                    </div>
                ) : (
                    <div className="max-w-3xl w-full">
                        <div className="relative aspect-square bg-white rounded-xl shadow-2xl overflow-hidden border-4 border-white">
                            <img src={generatedPattern} className="w-full h-full object-cover"/>
                            <button onClick={handleDownload} className="absolute bottom-4 right-4 bg-white text-black px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"><Download size={16}/> Baixar</button>
                        </div>
                        <div className="mt-8">
                             <h4 className="font-bold text-gray-500 uppercase text-xs mb-4 flex items-center gap-2"><Layers size={14}/> Teste de Repetição</h4>
                             <div className="h-40 w-full rounded-xl shadow-inner border border-gray-300" style={{backgroundImage: `url(${generatedPattern})`, backgroundSize: '150px'}}/>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
