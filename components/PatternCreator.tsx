
import React, { useState, useRef } from 'react';
import { Sparkles, Image as ImageIcon, Wand2, ArrowRight, UploadCloud, Loader2, Download, RefreshCw, Palette, ScanFace, FileCode2, Share2, Printer, Eraser, Check, AlertCircle, ScanLine, Lightbulb, Zap } from 'lucide-react';

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

  // 1. HANDLER: UPLOAD DE REFERÊNCIA
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              setReferenceImage(ev.target?.result as string);
              setError(null);
          };
          reader.readAsDataURL(file);
      }
  };

  // 2. HANDLER: ENGENHARIA REVERSA (VISION)
  const analyzeReference = async () => {
      if (!referenceImage) return;
      setIsAnalyzing(true);
      setError(null);
      setPrompt(""); // Limpa o prompt para mostrar que vai carregar novo
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); 

      try {
          const base64Clean = referenceImage.split(',')[1];
          const mimeType = referenceImage.split(';')[0].split(':')[1];

          const res = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  action: 'DESCRIBE_PATTERN',
                  mainImageBase64: base64Clean,
                  mainMimeType: mimeType
              }),
              signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          if (!res.ok) {
              const errText = await res.text();
              throw new Error(errText || "Erro ao conectar com servidor.");
          }

          const data = await res.json();
          
          if (data.error) throw new Error(data.error);
          
          if (data.success && data.description) {
              setPrompt(data.description);
          } else {
              throw new Error('A resposta da IA veio vazia. Tente outra imagem com melhor iluminação.');
          }
      } catch (e: any) {
          console.error(e);
          setError(e.message || 'Erro ao analisar estampa.');
      } finally {
          setIsAnalyzing(false);
      }
  };

  // 3. HANDLER: MAGIC ENHANCER (TEXT ONLY)
  const enhancePrompt = async () => {
      if (!prompt.trim()) return;
      setIsEnhancing(true);
      setError(null);
      
      try {
          const res = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  action: 'ENHANCE_PROMPT',
                  prompt: prompt
              })
          });
          const data = await res.json();
          if (data.success && data.enhancedPrompt) {
              setPrompt(data.enhancedPrompt);
          }
      } catch (e: any) {
          setError("Erro ao melhorar prompt. Tente novamente.");
      } finally {
          setIsEnhancing(false);
      }
  };

  // 4. HANDLER: GERAÇÃO (TEXT TO IMAGE)
  const generatePattern = async () => {
      if (!prompt.trim()) return;
      setIsGenerating(true);
      setGeneratedImage(null);
      setError(null);
      
      try {
          const res = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  action: 'GENERATE_PATTERN',
                  prompt: prompt
              })
          });
          const data = await res.json();
          if (data.success && data.image) {
              setGeneratedImage(data.image);
          } else {
              throw new Error(data.error || 'Erro na geração da imagem.');
          }
      } catch (e: any) {
          setError(e.message || 'Erro de conexão.');
      } finally {
          setIsGenerating(false);
      }
  };

  // 5. HANDLER: INTEGRAÇÃO COM MOCKUP
  const handleIntegration = () => {
      if (generatedImage) {
          setShowIntegrationSuccess(true);
          setTimeout(() => {
              onPatternGenerated(generatedImage);
          }, 800);
      }
  };

  const addPreset = (text: string) => {
      setPrompt(prev => prev ? `${prev}, ${text}` : text);
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-white font-sans overflow-hidden">
        
        {/* === COLUNA ESQUERDA: LABORATÓRIO === */}
        <div className="w-full md:w-[420px] bg-gray-50 border-r border-gray-200 flex flex-col h-full shadow-lg z-10">
            <div className="p-6 border-b border-gray-200 bg-white">
                 <h2 className="text-xl font-bold text-vingi-900 flex items-center gap-2">
                    <Palette className="text-purple-600"/> Vingi Creator <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">STUDIO</span>
                </h2>
                <p className="text-gray-500 text-xs mt-1">Fábrica de estampas têxteis com IA.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Error Banner */}
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold flex items-center gap-2 animate-fade-in border border-red-200">
                        <AlertCircle size={16}/> {error}
                    </div>
                )}

                {/* 1. INPUT DE REFERÊNCIA */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2"><ImageIcon size={14}/> Clonar Estampa (DNA)</h3>
                        {referenceImage && <button onClick={() => { setReferenceImage(null); setPrompt(''); }} className="text-[10px] text-red-500 hover:underline flex items-center gap-1"><Eraser size={10}/> LIMPAR</button>}
                    </div>
                    
                    {!referenceImage ? (
                        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-all group h-28 bg-gray-50">
                            <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/*"/>
                            <UploadCloud size={24} className="mb-2 opacity-50 group-hover:scale-110 transition-transform"/>
                            <span className="text-xs font-bold text-center">Carregar Foto para Recriar</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="relative group rounded-lg overflow-hidden border border-gray-200 h-32 bg-gray-100">
                                <img src={referenceImage} className="w-full h-full object-cover"/>
                                {isAnalyzing && (
                                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center backdrop-blur-sm z-20">
                                        <ScanLine size={24} className="text-purple-400 animate-pulse mb-1"/>
                                        <span className="text-white text-[10px] font-bold tracking-widest animate-pulse">EXTRAINDO DNA...</span>
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={analyzeReference}
                                disabled={isAnalyzing}
                                className={`w-full py-3 rounded-lg font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 ${isAnalyzing ? 'bg-gray-100 text-gray-400 border border-gray-200' : 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg'}`}
                            >
                                {isAnalyzing ? <Loader2 size={16} className="animate-spin"/> : <ScanFace size={16}/>}
                                {isAnalyzing ? "ANALISANDO..." : "EXTRAIR PROMPT DA IMAGEM"}
                            </button>
                        </div>
                    )}
                </div>

                {/* 2. ENGENHARIA DE PROMPT */}
                <div className="flex-1 flex flex-col">
                    <label className="text-xs font-bold text-gray-700 mb-2 flex justify-between items-center">
                        <span>Descrição da Estampa</span>
                        <div className="flex gap-2">
                             <button onClick={enhancePrompt} disabled={isEnhancing || !prompt} className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-yellow-200 transition-colors disabled:opacity-50">
                                {isEnhancing ? <Loader2 size={10} className="animate-spin"/> : <Zap size={10}/>} Mágica
                             </button>
                        </div>
                    </label>
                    
                    <div className="relative">
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={isAnalyzing ? "Aguardando análise da imagem..." : "Descreva a estampa (ex: floral tropical fundo preto)..."}
                            className={`w-full h-32 p-3 pb-8 rounded-xl border text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none mb-3 font-mono leading-relaxed shadow-inner ${isAnalyzing ? 'bg-gray-50 text-gray-400 animate-pulse border-gray-200' : 'bg-white text-gray-600 border-gray-300'}`}
                            readOnly={isAnalyzing}
                        />
                        <div className="absolute bottom-5 right-2 flex gap-1">
                             <span className="text-[10px] text-gray-300">{prompt.length} chars</span>
                        </div>
                    </div>

                    {/* Chips de Estilo */}
                    <div className="mb-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Adicionar Estilo Rápido</p>
                        <div className="flex flex-wrap gap-2">
                            {STYLE_PRESETS.map((preset) => (
                                <button 
                                    key={preset.label}
                                    onClick={() => addPreset(preset.prompt)}
                                    className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-medium text-gray-600 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 transition-all"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <button 
                        onClick={generatePattern}
                        disabled={isGenerating || !prompt.trim()}
                        className="w-full py-4 bg-gradient-to-r from-vingi-900 to-slate-800 text-white rounded-xl font-bold shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-auto"
                    >
                        {isGenerating ? <Loader2 size={20} className="animate-spin text-purple-400"/> : <Sparkles size={20} className="text-purple-400"/>}
                        {isGenerating ? "CRIAR ARTE 8K" : "GERAR ESTAMPA"}
                    </button>
                </div>
            </div>
        </div>

        {/* === COLUNA DIREITA: RESULTADO E AÇÕES === */}
        <div className="flex-1 bg-[#e2e8f0] relative flex items-center justify-center overflow-hidden p-6">
            <div className="absolute inset-0 opacity-20 pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
            />

            {generatedImage ? (
                <div className="w-full max-w-4xl flex flex-col md:flex-row gap-8 items-center animate-fade-in z-10">
                    
                    {/* Preview da Estampa */}
                    <div className="flex-1 w-full relative group perspective-1000">
                         <div className="w-full aspect-square bg-white p-2 rounded-2xl shadow-2xl rotate-y-6 group-hover:rotate-y-0 transition-transform duration-700 ease-out border-4 border-white">
                             <img src={generatedImage} className="w-full h-full object-cover rounded-xl"/>
                         </div>
                    </div>

                    {/* Painel de Ações */}
                    <div className="w-full md:w-64 flex flex-col gap-3">
                        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 mb-2">
                            <h3 className="text-sm font-bold text-gray-800 mb-4">Ações</h3>
                            
                            <a href={generatedImage} download={`vingi-pattern-${Date.now()}.jpg`} className="flex items-center gap-3 w-full p-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 transition-colors mb-2 group">
                                <div className="bg-white p-2 rounded border border-gray-200 group-hover:border-purple-300"><Download size={18} className="text-gray-600"/></div>
                                <div className="text-left">
                                    <div className="text-xs font-bold">Download JPG</div>
                                    <div className="text-[10px] text-gray-400">Alta Resolução</div>
                                </div>
                            </a>

                            <button onClick={handleIntegration} className={`flex items-center gap-3 w-full p-3 rounded-lg transition-all mb-2 group text-left relative overflow-hidden ${showIntegrationSuccess ? 'bg-green-600 text-white' : 'bg-vingi-900 text-white hover:bg-black'}`}>
                                <div className={`p-2 rounded border border-white/20 ${showIntegrationSuccess ? 'bg-green-500' : 'bg-white/10'}`}>
                                    {showIntegrationSuccess ? <Check size={18}/> : <FileCode2 size={18}/>}
                                </div>
                                <div>
                                    <div className="text-xs font-bold">{showIntegrationSuccess ? "Enviado!" : "Aplicar no Mockup"}</div>
                                    <div className="text-[10px] opacity-70">Visualizar 3D</div>
                                </div>
                            </button>
                        </div>
                        
                        <button onClick={() => setGeneratedImage(null)} className="text-xs text-gray-500 hover:text-red-500 font-bold flex items-center justify-center gap-2 py-2">
                            <RefreshCw size={12}/> DESCARTAR
                        </button>
                    </div>
                </div>
            ) : (
                <div className="text-center opacity-40 max-w-sm pointer-events-none select-none">
                    <div className="w-32 h-32 bg-gray-300 rounded-full mx-auto mb-6 flex items-center justify-center">
                        <Wand2 size={64} className="text-gray-500"/>
                    </div>
                    <h2 className="text-3xl font-bold text-gray-600 mb-2">Vingi Studio AI</h2>
                    <p className="text-gray-500 text-sm">
                        Crie estampas do zero usando texto ou recrie padrões a partir de fotos. Utilize os atalhos de estilo para resultados profissionais.
                    </p>
                </div>
            )}
        </div>
    </div>
  );
};
