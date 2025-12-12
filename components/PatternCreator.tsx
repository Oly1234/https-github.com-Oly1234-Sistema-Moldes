
import React, { useState, useRef } from 'react';
import { Sparkles, Image as ImageIcon, Wand2, ArrowRight, UploadCloud, Loader2, Download, RefreshCw, Palette, ScanFace, FileCode2, Share2, Printer, Eraser, Check, AlertCircle, ScanLine, Lightbulb, Zap, X, HelpCircle } from 'lucide-react';

interface PatternCreatorProps {
  onPatternGenerated: (patternUrl: string) => void;
}

const STYLE_PRESETS = [
    { label: "Aquarela", prompt: "Watercolor painting style, soft edges, wet-on-wet technique, artistic" },
    { label: "Vetorial", prompt: "Flat vector illustration, clean lines, solid colors, minimal" },
    { label: "Farm Rio", prompt: "Tropical maximalist, vibrant colors, lush flora and fauna, brazilian aesthetic" },
    { label: "Geométrico", prompt: "Bauhaus style, geometric shapes, abstract composition, modern" },
    { label: "Vintage", prompt: "Vintage botanical etching, muted colors, detailed line work, antique feel" },
    { label: "Boho", prompt: "Bohemian paisley, earthy tones, intricate details, ethnic pattern" }
];

export const PatternCreator: React.FC<PatternCreatorProps> = ({ onPatternGenerated }) => {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  
  // States de Processamento
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [showIntegrationSuccess, setShowIntegrationSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // HANDLERS
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => { setReferenceImage(ev.target?.result as string); setError(null); };
          reader.readAsDataURL(file);
      }
  };

  const analyzeReference = async () => {
      if (!referenceImage) return;
      setIsAnalyzing(true); setError(null); setPrompt(""); 
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); 

      try {
          const base64Clean = referenceImage.split(',')[1];
          const mimeTypeParts = referenceImage.split(';')[0].split(':');
          const mimeType = mimeTypeParts.length > 1 ? mimeTypeParts[1] : 'image/jpeg';

          const res = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'DESCRIBE_PATTERN', mainImageBase64: base64Clean, mainMimeType: mimeType }),
              signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error("Falha na análise.");
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          if (data.success && data.description) setPrompt(data.description);
          else throw new Error('A IA não retornou descrição.');
      } catch (e: any) {
          setError(e.message || 'Erro ao analisar estampa.');
      } finally { setIsAnalyzing(false); }
  };

  const enhancePrompt = async () => {
      if (!prompt.trim()) return;
      setIsEnhancing(true); setError(null);
      try {
          const res = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'ENHANCE_PROMPT', prompt: prompt })
          });
          const data = await res.json();
          if (data.success && data.enhancedPrompt) setPrompt(data.enhancedPrompt);
      } catch (e: any) { setError("Erro ao melhorar prompt."); } finally { setIsEnhancing(false); }
  };

  const generatePattern = async () => {
      if (!prompt.trim()) return;
      setIsGenerating(true); setGeneratedImage(null); setError(null);
      try {
          const res = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'GENERATE_PATTERN', prompt: prompt })
          });
          const data = await res.json();
          if (data.success && data.image) setGeneratedImage(data.image);
          else throw new Error(data.error || 'Erro na geração.');
      } catch (e: any) { setError(e.message || 'Erro de conexão.'); } finally { setIsGenerating(false); }
  };

  const handleIntegration = () => {
      if (generatedImage) {
          setShowIntegrationSuccess(true);
          setTimeout(() => { onPatternGenerated(generatedImage); }, 800);
      }
  };

  const addPreset = (text: string) => setPrompt(prev => prev ? `${prev}, ${text}` : text);

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-white font-sans overflow-hidden relative">
        
        {/* === VIEW 1: LABORATÓRIO (INPUT) === */}
        <div className={`w-full md:w-[420px] bg-gray-50 border-r border-gray-200 flex flex-col shadow-lg z-10 transition-all duration-300 absolute inset-0 md:relative ${generatedImage ? 'hidden md:flex' : 'flex'}`}>
            
            <div className="p-4 border-b border-gray-200 bg-white shrink-0 flex justify-between items-center">
                 <div>
                    <h2 className="text-lg font-bold text-vingi-900 flex items-center gap-2">
                        <Palette className="text-purple-600" size={20}/> Vingi Creator
                    </h2>
                 </div>
                 <div className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200 font-bold">PRO</div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32 custom-scrollbar">
                
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold flex items-center gap-2 animate-fade-in border border-red-200">
                        <AlertCircle size={16}/> {error}
                    </div>
                )}

                {/* 1. INPUT DE REFERÊNCIA */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><ImageIcon size={12}/> Clonar DNA</h3>
                        {referenceImage && <button onClick={() => { setReferenceImage(null); setPrompt(''); }} className="text-[10px] text-red-500 font-bold">LIMPAR</button>}
                    </div>
                    
                    {!referenceImage ? (
                        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-all h-24 bg-gray-50">
                            <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/*"/>
                            <UploadCloud size={20} className="mb-1 opacity-50"/>
                            <span className="text-[10px] font-bold">Carregar Foto</span>
                        </div>
                    ) : (
                        <div className="flex gap-3 items-center">
                            <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 shrink-0 group">
                                <img src={referenceImage} className="w-full h-full object-cover"/>
                                <div className="absolute top-0 right-0 bg-green-500 p-1 rounded-bl text-white"><Check size={10}/></div>
                            </div>
                            <button 
                                onClick={analyzeReference}
                                disabled={isAnalyzing}
                                className={`flex-1 py-2 rounded-lg font-bold text-[10px] shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all ${isAnalyzing ? 'bg-gray-100 text-gray-400' : 'bg-purple-600 text-white'}`}
                            >
                                {isAnalyzing ? <Loader2 size={14} className="animate-spin"/> : <ScanFace size={14}/>}
                                {isAnalyzing ? "ANALISANDO..." : "EXTRAIR PROMPT"}
                            </button>
                        </div>
                    )}
                </div>

                {/* 2. ENGENHARIA DE PROMPT */}
                <div className="flex-1 flex flex-col relative">
                    {/* HINT DO PROMPT */}
                    {!prompt && !isAnalyzing && (
                        <div className="absolute top-10 right-4 animate-bounce-subtle pointer-events-none z-10 opacity-70">
                             <div className="bg-vingi-900 text-white text-[10px] px-2 py-1 rounded-lg shadow">Escreva aqui 👆</div>
                        </div>
                    )}
                    
                    <div className="flex justify-between items-end mb-2">
                        <label className="text-xs font-bold text-gray-700">Prompt de Criação</label>
                        <button onClick={enhancePrompt} disabled={isEnhancing || !prompt} className="text-[10px] bg-yellow-50 text-yellow-700 px-2 py-1 rounded border border-yellow-200 flex items-center gap-1 font-bold">
                           {isEnhancing ? <Loader2 size={10} className="animate-spin"/> : <Zap size={10}/>} MÁGICA
                        </button>
                    </div>
                    
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Descreva a estampa (Ex: Floral vermelho fundo preto)..."
                        className={`w-full h-28 p-3 rounded-xl border text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none mb-3 font-mono leading-relaxed shadow-inner ${isAnalyzing ? 'bg-gray-50 text-gray-400 animate-pulse border-gray-200' : 'bg-white text-gray-600 border-gray-300'}`}
                        readOnly={isAnalyzing}
                    />

                    {/* Chips Scrollable */}
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide snap-x">
                        {STYLE_PRESETS.map((preset) => (
                            <button 
                                key={preset.label}
                                onClick={() => addPreset(preset.prompt)}
                                className="snap-start flex-shrink-0 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[10px] font-bold text-gray-600 whitespace-nowrap active:scale-95"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ACTION FOOTER - STICKY SAFE AREA */}
            <div className="p-4 bg-white border-t border-gray-200 absolute bottom-0 w-full z-20 pb-safe">
                <button 
                    onClick={generatePattern}
                    disabled={isGenerating || !prompt.trim()}
                    className="w-full py-3.5 bg-gradient-to-r from-vingi-900 to-slate-800 text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isGenerating ? <Loader2 size={18} className="animate-spin text-purple-400"/> : <Sparkles size={18} className="text-purple-400"/>}
                    {isGenerating ? "CRIANDO 8K..." : "GERAR ESTAMPA"}
                </button>
            </div>
        </div>

        {/* === VIEW 2: RESULTADO === */}
        <div className={`flex-1 bg-gray-100 flex flex-col md:relative fixed inset-0 z-50 overflow-hidden transition-transform duration-300 ${generatedImage ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}`}>
            
            <div className="md:hidden p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-20">
                <button onClick={() => setGeneratedImage(null)} className="p-2 -ml-2 text-gray-500 hover:text-red-500">
                    <ArrowRight className="rotate-180" size={24}/>
                </button>
                <span className="font-bold text-gray-800">Resultado 8K</span>
                <button onClick={() => setGeneratedImage(null)} className="text-xs font-bold text-red-500">FECHAR</button>
            </div>

            {generatedImage ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto bg-[#e2e8f0]">
                    <div className="w-full max-w-md aspect-square bg-white p-2 rounded-2xl shadow-2xl mb-8 border-4 border-white animate-fade-in-up">
                        <img src={generatedImage} className="w-full h-full object-cover rounded-xl"/>
                    </div>

                    <div className="w-full max-w-md bg-white p-4 rounded-2xl shadow-lg border border-gray-100 space-y-3">
                        <button onClick={handleIntegration} className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all relative overflow-hidden active:scale-95 ${showIntegrationSuccess ? 'bg-green-600 text-white' : 'bg-vingi-900 text-white'}`}>
                            <div className={`p-2 rounded-lg ${showIntegrationSuccess ? 'bg-green-500' : 'bg-white/10'}`}>
                                {showIntegrationSuccess ? <Check size={20}/> : <FileCode2 size={20}/>}
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-bold">{showIntegrationSuccess ? "ENVIADO PARA MOCKUP" : "TESTAR NO MOLDE"}</div>
                                <div className="text-[10px] opacity-70">Visualizar na roupa</div>
                            </div>
                        </button>
                        
                        <a href={generatedImage} download={`vingi-pattern.jpg`} className="flex items-center gap-3 w-full p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 active:scale-95">
                            <div className="p-2 bg-white rounded-lg border border-gray-200"><Download size={20}/></div>
                            <div className="text-left">
                                <div className="text-sm font-bold">Salvar JPG</div>
                                <div className="text-[10px] text-gray-400">Alta Definição</div>
                            </div>
                        </a>
                    </div>
                </div>
            ) : (
                <div className="hidden md:flex flex-col items-center justify-center h-full opacity-40">
                    <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center mb-6">
                        <Wand2 size={64} className="text-gray-400"/>
                    </div>
                    <h3 className="text-xl font-bold text-gray-500">Studio Vazio</h3>
                    <p className="text-sm text-gray-400">Gere uma estampa para visualizar</p>
                </div>
            )}
        </div>
    </div>
  );
};
