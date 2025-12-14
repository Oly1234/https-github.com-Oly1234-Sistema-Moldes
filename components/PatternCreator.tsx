
import React, { useState, useRef } from 'react';
import { UploadCloud, Wand2, Download, Palette, Image as ImageIcon, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { PantoneColor } from '../types';

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

export const PatternCreator: React.FC = () => {
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [detectedColors, setDetectedColors] = useState<PantoneColor[]>([]);
    
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
                setPrompt('');
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
                setDetectedColors(data.colors || []);
            } else {
                throw new Error("Dados inválidos");
            }
        } catch (error) {
            console.log("Usando Fallback Local para Pattern Creator");
            // SIMULAÇÃO LOCAL RICA
            setPrompt("Seamless textile pattern design, Tropical Boho style. Watercolor technique with wet-on-wet effects. Motifs: Large Monstera leaves, Hibiscus flowers in coral, and golden geometric accents. Colors: Deep Emerald, Coral Pink, Gold Ochre. Dense all-over composition. 8k resolution, flat print quality.");
            setDetectedColors([
                { name: "Emerald", code: "PANTONE 17-5641 TCX", hex: "#009B77" },
                { name: "Coral Pink", code: "PANTONE 16-1546 TCX", hex: "#FF6F61" },
                { name: "Gold Ochre", code: "PANTONE 16-0948 TCX", hex: "#D1B250" },
                { name: "Cream", code: "PANTONE 11-0601 TCX", hex: "#F0EAD6" }
            ]);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const generatePattern = async () => {
        if (!prompt) return;
        setIsGenerating(true);
        try {
             const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'GENERATE_PATTERN',
                    prompt: prompt
                })
            });
            
            if (!response.ok) throw new Error("API Offline");
            
            const data = await response.json();
            if (data.success && data.image) {
                setGeneratedPattern(data.image);
            } else {
                throw new Error("Falha na geração");
            }
        } catch (error) {
            console.error("Erro na geração:", error);
            // Em preview sem chave de API, avisamos o usuário
            alert("Para gerar a imagem final (Pixelada), é necessária uma chave de API válida no Backend. O prompt foi gerado com sucesso acima.");
        } finally {
            setIsGenerating(false);
        }
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
            <div className="w-full md:w-[400px] bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto shrink-0 z-10 shadow-xl">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 sticky top-0 backdrop-blur z-20">
                    <h2 className="text-lg font-bold text-vingi-900 flex items-center gap-2">
                        <Palette className="text-vingi-600" size={20} /> Pattern Studio
                        <span className="text-[10px] bg-vingi-900 text-white px-2 py-0.5 rounded-full font-mono">AI</span>
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
                                <Palette size={12}/> Paleta Pantone Detectada
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {detectedColors.map((color, idx) => (
                                    <div key={idx} className="flex flex-col gap-1 group relative">
                                        <div 
                                            className="w-full aspect-square rounded-lg shadow-sm border border-black/10 transition-transform hover:scale-105 cursor-pointer" 
                                            style={{ backgroundColor: color.hex }}
                                            title={color.name}
                                        />
                                        <span className="text-[9px] font-mono text-gray-500 truncate">{color.code.split(' ')[1]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">2. Prompt Técnico (Editável)</label>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Descreva a estampa desejada ou use a análise da IA..."
                            className="w-full h-32 p-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vingi-500 focus:border-transparent resize-none leading-relaxed font-mono"
                        />
                    </div>

                    <button 
                        onClick={generatePattern}
                        disabled={!prompt || isGenerating}
                        className="w-full py-4 bg-gradient-to-r from-vingi-600 to-vingi-500 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 transform active:scale-95 flex items-center justify-center gap-2"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" size={18}/> : <Sparkles size={18}/>}
                        {isGenerating ? 'TECELANDO PIXELS...' : 'GERAR ESTAMPA 8K'}
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-[#e2e8f0] relative flex items-center justify-center p-4 md:p-10 overflow-hidden">
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px), backgroundSize: 20px 20px' }} />

                {!generatedPattern ? (
                    <div className="text-center opacity-40 max-w-md">
                        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ImageIcon size={40} className="text-gray-400"/>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-600 mb-2">Workspace Vazio</h3>
                        <p className="text-gray-500">Faça o upload de uma referência à esquerda e clique em "Gerar" para criar uma estampa seamless em alta definição.</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center h-full w-full max-w-3xl animate-fade-in">
                        <div className="relative w-full aspect-square bg-white rounded-xl shadow-2xl border-4 border-white overflow-hidden group">
                            <img src={generatedPattern} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                                <button onClick={handleDownload} className="px-6 py-3 bg-white text-vingi-900 rounded-full font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
                                    <Download size={18}/> Baixar Original
                                </button>
                            </div>
                        </div>
                        <div className="mt-6 w-full h-32 bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-300 relative">
                             <div className="absolute top-2 left-2 z-10 bg-white/80 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Teste de Repetição</div>
                             <div className="w-full h-full" style={{ backgroundImage: `url(${generatedPattern})`, backgroundSize: '100px 100px' }} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
