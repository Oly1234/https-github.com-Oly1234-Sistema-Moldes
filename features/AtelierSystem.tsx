
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Loader2, Layers, Grid3X3, ArrowDownToLine, Settings2, Image as ImageIcon, Type, Sparkles, FileWarning } from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader, FloatingReference } from '../components/Shared';

// --- HELPERS ---
const triggerTransfer = (targetModule: string, imageData: string) => {
    if (targetModule === 'MOCKUP') localStorage.setItem('vingi_mockup_pattern', imageData);
    if (targetModule === 'LAYER') localStorage.setItem('vingi_layer_studio_source', imageData);
    window.dispatchEvent(new CustomEvent('vingi_transfer', { detail: { module: targetModule } }));
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

interface AtelierSystemProps {
    onNavigateToMockup?: () => void;
    onNavigateToLayerStudio?: () => void;
}

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    // State
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [userPrompt, setUserPrompt] = useState<string>('');
    const [colors, setColors] = useState<PantoneColor[]>([]);
    
    // Status
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial Load from Transfer
    useEffect(() => {
        const transferImage = localStorage.getItem('vingi_transfer_image');
        if (transferImage) {
            handleReferenceUpload(transferImage);
            localStorage.removeItem('vingi_transfer_image');
        }
    }, []);

    const resetSession = () => {
        setReferenceImage(null);
        setGeneratedPattern(null);
        setUserPrompt('');
        setColors([]);
        setError(null);
    };

    const handleReferenceUpload = async (imgBase64: string) => {
        setReferenceImage(imgBase64);
        setIsProcessing(true);
        setStatusMessage("Analisando referência...");
        setError(null);

        try {
            const compressed = await compressImage(imgBase64);
            const cleanBase64 = compressed.split(',')[1];
            
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'ANALYZE_REFERENCE_FOR_PROMPT', 
                    mainImageBase64: cleanBase64
                })
            });
            const data = await res.json();
            
            if (data.success) {
                if (data.prompt) setUserPrompt(data.prompt);
                if (data.colors) setColors(data.colors);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => handleReferenceUpload(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!userPrompt.trim()) {
            setError("Por favor, descreva a estampa que deseja criar.");
            return;
        }

        setIsProcessing(true);
        setStatusMessage("Criando estampa...");
        setGeneratedPattern(null);
        setError(null);

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: userPrompt,
                    colors: colors
                })
            });

            const data = await res.json();
            if (data.success && data.image) {
                setGeneratedPattern(data.image);
            } else {
                throw new Error(data.error || "Não foi possível gerar a estampa.");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTransfer = (target: 'MOCKUP' | 'LAYER') => {
        if (!generatedPattern) return;
        triggerTransfer(target, generatedPattern);
        if (target === 'MOCKUP' && onNavigateToMockup) onNavigateToMockup();
        if (target === 'LAYER' && onNavigateToLayerStudio) onNavigateToLayerStudio();
    };

    return (
        <div className="h-full bg-[#f8fafc] flex flex-col overflow-hidden">
            <ModuleHeader 
                icon={Palette} 
                title="Criar Estampas" 
                subtitle="Modo Direto"
                referenceImage={referenceImage}
                actionLabel={referenceImage || generatedPattern ? "Reiniciar" : undefined}
                onAction={resetSession}
            />

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                
                {/* ÁREA VISUAL (CANVAS) */}
                <div className="flex-1 bg-slate-900 relative flex items-center justify-center p-4 min-h-[40vh]">
                    <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,#ffffff_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                    
                    {isProcessing ? (
                        <div className="text-center relative z-10">
                            <Loader2 size={48} className="text-vingi-400 animate-spin mx-auto mb-4"/>
                            <h2 className="text-white font-bold text-xl">{statusMessage}</h2>
                        </div>
                    ) : generatedPattern ? (
                        <div className="relative shadow-2xl bg-white max-w-full max-h-full flex items-center justify-center border border-white/20">
                            <img src={generatedPattern} className="max-w-full max-h-[80vh] object-contain" />
                        </div>
                    ) : (
                        <div className="text-center opacity-30 select-none">
                            <Grid3X3 size={64} className="mx-auto mb-4 text-white"/>
                            <p className="text-white text-sm">Área de Criação</p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-xl text-sm font-bold flex items-center gap-3 animate-bounce-subtle z-50">
                            <FileWarning size={18}/> {error}
                        </div>
                    )}
                </div>

                {/* PAINEL DE CONTROLE */}
                <div className="w-full md:w-[400px] bg-white border-l border-gray-200 flex flex-col z-20 shadow-xl overflow-y-auto custom-scrollbar h-[50vh] md:h-full">
                    <div className="p-6 space-y-6">
                        
                        {/* 1. INPUT DE REFERÊNCIA */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <UploadCloud size={14}/> Referência (Opcional)
                            </h3>
                            <div className="flex gap-4 items-center">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 bg-white border border-gray-200 text-gray-600 rounded-lg py-3 text-xs font-bold hover:bg-vingi-50 hover:border-vingi-200 hover:text-vingi-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <ImageIcon size={16}/> {referenceImage ? "Trocar Imagem" : "Carregar Foto"}
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                            </div>
                            {referenceImage && (
                                <p className="text-[10px] text-green-600 mt-2 font-medium flex items-center gap-1">
                                    <Sparkles size={10}/> Prompt extraído da imagem com sucesso.
                                </p>
                            )}
                        </div>

                        {/* 2. PROMPT TEXTUAL */}
                        <div className="flex-1 flex flex-col">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Type size={14}/> Descrição da Estampa
                            </h3>
                            <textarea 
                                value={userPrompt}
                                onChange={(e) => setUserPrompt(e.target.value)}
                                placeholder="Ex: Estampa floral tropical com fundo preto, estilo aquarela, cores vivas..."
                                className="w-full h-40 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:border-vingi-500 focus:bg-white outline-none transition-all shadow-inner text-gray-800"
                            />
                            <p className="text-[10px] text-gray-400 mt-2 text-right">Seja detalhado para melhores resultados.</p>
                        </div>

                        {/* 3. AÇÕES */}
                        <div className="space-y-3 pt-4 border-t border-gray-100">
                            {!isProcessing && (
                                <button 
                                    onClick={handleGenerate}
                                    className="w-full py-4 bg-vingi-900 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                >
                                    <Wand2 size={18} className="text-purple-300"/>
                                    {generatedPattern ? "GERAR NOVAMENTE" : "CRIAR ESTAMPA"}
                                </button>
                            )}

                            {generatedPattern && !isProcessing && (
                                <div className="grid grid-cols-2 gap-2 animate-fade-in">
                                    <button onClick={() => handleTransfer('MOCKUP')} className="py-3 bg-white border border-gray-200 text-gray-700 rounded-lg font-bold text-xs hover:bg-gray-50 flex items-center justify-center gap-2"><Settings2 size={14}/> PROVAR</button>
                                    <button onClick={() => { const l = document.createElement('a'); l.href = generatedPattern!; l.download = 'estampa.png'; l.click(); }} className="py-3 bg-white border border-gray-200 text-gray-700 rounded-lg font-bold text-xs hover:bg-gray-50 flex items-center justify-center gap-2"><Download size={14}/> BAIXAR</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};