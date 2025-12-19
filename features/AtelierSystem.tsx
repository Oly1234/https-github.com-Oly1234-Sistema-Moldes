
import React, { useState, useRef, useEffect } from 'react';
import { 
    UploadCloud, Wand2, Download, Palette, Loader2, Grid3X3, Settings2, Image as ImageIcon, 
    Type, Sparkles, FileWarning, RefreshCw, Sun, Moon, Contrast, Droplets, ArrowDownToLine, 
    Move, ZoomIn, Minimize2, Check, Cylinder, Printer, Eye, Zap, Layers, Cpu, LayoutTemplate, 
    PaintBucket, Ruler, Box, Target, BoxSelect, Maximize, Copy, FileText, PlusCircle, Pipette, 
    Brush, PenTool, Scissors, Edit3, Feather, Frame, Send, ChevronRight, X, SlidersHorizontal, 
    FileCheck, HardDrive, Play, Info, Lock, Grid, Activity, XCircle 
} from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader, ModuleLandingPage, SmartImageViewer } from '../components/Shared';

// --- COMPONENTES AUXILIARES ---
const PantoneChip: React.FC<{ color: PantoneColor, onDelete?: () => void }> = ({ color, onDelete }) => {
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(color.hex);
    };
    return (
        <div className="flex flex-col bg-[#111] shadow-sm border border-gray-800 rounded-lg overflow-hidden h-14 w-full group relative hover:scale-105 transition-transform cursor-pointer">
            <div className="h-8 w-full" style={{ backgroundColor: color.hex }}>
                {onDelete && (
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 bg-black/50 text-white rounded-full p-0.5 transition-opacity">
                        <X size={8} />
                    </button>
                )}
            </div>
            <div className="flex-1 flex flex-col justify-center bg-[#1a1a1a] px-1.5 py-0.5" onClick={handleCopy}>
                <span className="text-[8px] font-bold text-gray-300 truncate uppercase">{color.name}</span>
                <span className="text-[7px] text-gray-600 font-mono truncate">{color.code || color.hex}</span>
            </div>
        </div>
    );
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

// --- CONFIGURAÇÕES DE LAYOUT ---
const LAYOUT_OPTIONS = [
    { id: 'ORIGINAL', label: 'Original', icon: ImageIcon },
    { id: 'CORRIDA', label: 'Corrida', icon: Layers },
    { id: 'BARRADO', label: 'Barrado', icon: ArrowDownToLine },
    { id: 'LENCO', label: 'Lenço', icon: Frame }, 
    { id: 'LOCALIZADA', label: 'Localizada', icon: Target },
    { id: 'PAREO', label: 'Pareô', icon: Maximize },
];

const ART_STYLES = [
    { id: 'ORIGINAL', label: 'Original', icon: ImageIcon },
    { id: 'WATERCOLOR', label: 'Aquarela', icon: Droplets },
    { id: 'GIZ', label: 'Giz Pastel', icon: Edit3 },
    { id: 'ACRILICA', label: 'Acrílica', icon: Palette },
    { id: 'VETOR', label: 'Vetor Flat', icon: Box },
    { id: 'BORDADO', label: 'Bordado', icon: Scissors },
];

export const AtelierSystem: React.FC<{ onNavigateToMockup?: () => void, onNavigateToLayerStudio?: () => void }> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [userPrompt, setUserPrompt] = useState<string>(''); 
    const [customInstruction, setCustomInstruction] = useState<string>(''); 
    const [printTechnique, setPrintTechnique] = useState<'CYLINDER' | 'DIGITAL'>('CYLINDER');
    const [colors, setColors] = useState<PantoneColor[]>([]);
    const [targetLayout, setTargetLayout] = useState<string>('ORIGINAL');
    const [artStyle, setArtStyle] = useState<string>('ORIGINAL');
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Carregar imagem transferida de outros módulos
    useEffect(() => {
        const transferImage = localStorage.getItem('vingi_transfer_image');
        if (transferImage) {
            handleReferenceUpload(transferImage);
            localStorage.removeItem('vingi_transfer_image');
        }
    }, []);

    const resetSession = () => {
        setReferenceImage(null); setGeneratedPattern(null); setUserPrompt(''); 
        setCustomInstruction(''); setColors([]); setError(null);
    };

    const analyzeReference = async (cleanBase64: string) => {
        setIsProcessing(true);
        setStatusMessage("Extraindo DNA & Cores...");
        try {
            // Análise de Prompt
            const pRes = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ANALYZE_REFERENCE_FOR_PROMPT', mainImageBase64: cleanBase64 }) });
            const pData = await pRes.json();
            if (pData.success) setUserPrompt(pData.prompt);

            // Análise de Cores
            const cRes = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ANALYZE_COLOR_TREND', mainImageBase64: cleanBase64 }) });
            const cData = await cRes.json();
            if (cData.success && cData.colors) setColors(cData.colors);
        } catch (e) { 
            console.warn("Análise parcial falhou"); 
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReferenceUpload = async (imgBase64: string) => {
        setReferenceImage(imgBase64);
        const compressed = await compressImage(imgBase64);
        const cleanBase64 = compressed.split(',')[1];
        analyzeReference(cleanBase64);
    };

    const handleGenerate = async () => {
        setIsProcessing(true);
        setStatusMessage("Gerando Nova Variante...");
        setError(null);
        try {
            const finalPrompt = customInstruction ? `${customInstruction}. Descrição Base: ${userPrompt}` : userPrompt;
            const res = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: finalPrompt, 
                    colors: colors,
                    technique: printTechnique,
                    layoutStyle: targetLayout,
                    artStyle: artStyle
                }) 
            });
            const data = await res.json();
            if (data.success && data.image) setGeneratedPattern(data.image);
            else throw new Error(data.error || "A IA não conseguiu processar.");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="h-full w-full bg-black flex flex-col overflow-hidden text-white">
            {/* TOP BAR */}
            <div className="h-14 bg-[#111] border-b border-white/5 flex items-center justify-between px-4 z-50">
                <div className="flex items-center gap-2">
                    <div className="bg-vingi-900/50 p-1.5 rounded-lg border border-vingi-500/30 text-vingi-400">
                        <Palette size={18}/>
                    </div>
                    <span className="font-bold text-sm tracking-tight">Atelier AI</span>
                </div>
                <div className="flex gap-2">
                    {referenceImage && <button onClick={resetSession} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 font-bold uppercase tracking-widest hover:bg-white/10">Novo</button>}
                    {generatedPattern && (
                        <button onClick={() => { const l=document.createElement('a'); l.download='vingi-pattern.png'; l.href=generatedPattern; l.click(); }} className="text-[10px] bg-green-600 px-4 py-1.5 rounded-lg font-black uppercase tracking-widest shadow-lg shadow-green-900/40">Download</button>
                    )}
                </div>
            </div>

            {!referenceImage ? (
                <div className="flex-1 overflow-y-auto">
                    <input type="file" ref={fileInputRef} onChange={(e) => { const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>handleReferenceUpload(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                    <ModuleLandingPage 
                        icon={Palette} 
                        title="Atelier Generativo" 
                        description="Crie estampas exclusivas combinando estilos artísticos e paletas técnicas."
                        primaryActionLabel="Subir Referência"
                        onPrimaryAction={() => fileInputRef.current?.click()}
                        features={["Extração Pantone", "Layout de Lenço", "Estilos Digitais"]}
                    />
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row min-h-0">
                    {/* VISUALIZAÇÃO */}
                    <div className="flex-1 bg-[#050505] relative flex items-center justify-center p-4">
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                        
                        {isProcessing ? (
                            <div className="text-center animate-fade-in z-10">
                                <Loader2 size={48} className="text-vingi-400 animate-spin mx-auto mb-4"/>
                                <p className="text-sm font-bold tracking-widest text-gray-400 uppercase">{statusMessage}</p>
                            </div>
                        ) : (
                            <div className="w-full h-full relative group">
                                <SmartImageViewer src={generatedPattern || referenceImage} />
                                {generatedPattern && (
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { localStorage.setItem('vingi_mockup_pattern', generatedPattern); if(onNavigateToMockup) onNavigateToMockup(); }} className="bg-vingi-600 px-4 py-2 rounded-full font-bold text-[10px] uppercase shadow-xl hover:bg-vingi-500">Provar no Modelo</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* MINIATURA REFERÊNCIA */}
                        {generatedPattern && (
                            <div className="absolute bottom-4 left-4 w-20 h-24 rounded-lg border border-white/10 overflow-hidden shadow-2xl bg-black">
                                <img src={referenceImage} className="w-full h-full object-cover opacity-60" />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-[7px] py-1 text-center font-bold">REFERÊNCIA</div>
                            </div>
                        )}
                    </div>

                    {/* BARRA DE FERRAMENTAS (DIREITA) */}
                    <div className="w-full md:w-80 bg-[#111] border-l border-white/5 flex flex-col overflow-y-auto custom-scrollbar p-5 space-y-6">
                        
                        {/* DIREÇÃO CRIATIVA */}
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={12}/> Direção Criativa</h3>
                            <textarea 
                                value={customInstruction}
                                onChange={e => setCustomInstruction(e.target.value)}
                                className="w-full h-24 bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 text-xs outline-none focus:border-vingi-500 transition-all placeholder-gray-700"
                                placeholder="Descreva alterações (ex: 'fundo azul marinho', 'flores menores')..."
                            />
                        </div>

                        {/* CORES */}
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Palette size={12}/> Paleta Pantone</h3>
                            <div className="grid grid-cols-4 gap-1.5">
                                {colors.map((c, i) => <PantoneChip key={i} color={c} onDelete={() => setColors(prev => prev.filter((_, idx) => idx !== i))} />)}
                                <button className="h-14 border border-dashed border-gray-800 rounded-lg flex items-center justify-center text-gray-700 hover:text-white hover:border-white transition-all"><PlusCircle size={16}/></button>
                            </div>
                        </div>

                        {/* LAYOUT */}
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><LayoutTemplate size={12}/> Layout de Impressão</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {LAYOUT_OPTIONS.map(opt => (
                                    <button key={opt.id} onClick={() => setTargetLayout(opt.id)} className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${targetLayout === opt.id ? 'bg-vingi-900 border-vingi-500 text-white' : 'bg-[#1a1a1a] border-gray-800 text-gray-500'}`}>
                                        <opt.icon size={16} className="mb-1" />
                                        <span className="text-[8px] font-bold uppercase">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ESTILO ARTÍSTICO */}
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Brush size={12}/> Estilo Artístico</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {ART_STYLES.map(style => (
                                    <button key={style.id} onClick={() => setArtStyle(style.id)} className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${artStyle === style.id ? 'bg-purple-900/50 border-purple-500 text-white' : 'bg-[#1a1a1a] border-gray-800 text-gray-500'}`}>
                                        <style.icon size={16} className="mb-1" />
                                        <span className="text-[8px] font-bold uppercase">{style.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* BOTÃO GERAR */}
                        <div className="pt-4 mt-auto">
                            <button 
                                onClick={handleGenerate} 
                                disabled={isProcessing}
                                className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-2 transition-all active:scale-95 ${isProcessing ? 'bg-gray-800 text-gray-500' : 'bg-vingi-600 text-white hover:bg-vingi-500 shadow-vingi-900/40'}`}
                            >
                                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="white"/>}
                                {generatedPattern ? "Refinar Variante" : "Criar Estampa"}
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};
