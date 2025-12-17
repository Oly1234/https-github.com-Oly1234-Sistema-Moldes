
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Loader2, Grid3X3, Settings2, Image as ImageIcon, Type, Sparkles, FileWarning, RefreshCw, Sun, Moon, Contrast, Droplets, ArrowDownToLine, Move, ZoomIn, Minimize2, Check, Cylinder, Printer, Eye, Zap, Layers, Cpu, LayoutTemplate, PaintBucket, Ruler, Box, Target, BoxSelect, Maximize, Copy, FileText } from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader, FloatingReference, ModuleLandingPage, SmartImageViewer } from '../components/Shared';
import { SelvedgeTool, SelvedgePosition } from '../components/SelvedgeTool';

// --- NOVO: CHIP PANTONE AVANÇADO ---
const PantoneChip: React.FC<{ color: PantoneColor }> = ({ color }) => {
    const [showMenu, setShowMenu] = useState(false);
    
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(color.hex);
        alert(`Cor ${color.hex} copiada!`);
    };

    return (
        <div 
            onClick={() => setShowMenu(!showMenu)}
            className="flex flex-col bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden cursor-pointer h-20 w-full group relative hover:scale-105 transition-transform"
        >
            <div className="h-10 w-full relative" style={{ backgroundColor: color.hex }}></div>
            <div className="flex-1 flex flex-col justify-center bg-white border-t border-gray-100 px-2 py-1">
                <span className="text-[10px] font-bold text-gray-900 truncate">{color.name}</span>
                <span className="text-[9px] text-gray-500 font-mono truncate">{color.code || color.hex}</span>
            </div>
            
            {showMenu && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 animate-fade-in z-10">
                    <button onClick={handleCopy} className="text-white text-[10px] font-bold flex items-center gap-1 hover:text-vingi-400"><Copy size={10}/> COPIAR HEX</button>
                </div>
            )}
        </div>
    );
};

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

const LAYOUT_OPTIONS = [
    { id: 'ORIGINAL', label: 'Original', desc: 'Rapport Padrão' },
    { id: 'CORRIDA', label: 'Corrida', desc: 'All-over Repeat' },
    { id: 'BARRADO', label: 'Barrado', desc: 'Border Print' },
    { id: 'LENCO', label: 'Lenço', desc: 'Engineered Scarf' },
    { id: 'PAREO', label: 'Pareô', desc: 'Painel Canga' },
    { id: 'LOCALIZADA', label: 'Localizada', desc: 'T-Shirt Placement' },
];

const SUB_LAYOUT_CONFIG: Record<string, { id: string, label: string, icon: any }[]> = {
    'LENCO': [
        { id: 'MEDALHAO', label: 'Medalhão (Carré)', icon: Target },
        { id: 'BANDANA', label: 'Bandana (Paisley)', icon: BoxSelect },
        { id: 'GEOMETRICO', label: 'Geométrico', icon: Grid3X3 },
        { id: 'MOLDURA', label: 'Moldura Simples', icon: Maximize },
    ],
    'BARRADO': [
        { id: 'SIMPLES', label: 'Simples (Barra)', icon: ArrowDownToLine },
        { id: 'DUPLO', label: 'Duplo (Espelhado)', icon: ArrowDownToLine }, 
        { id: 'DEGRADE', label: 'Degradê (Fading)', icon: Droplets },
    ],
    'CORRIDA': [
        { id: 'TOSS', label: 'Toss (Aleatório)', icon: Sparkles },
        { id: 'GRID', label: 'Grid (Alinhado)', icon: Grid3X3 },
        { id: 'ORGANIC', label: 'Orgânico (Flow)', icon: Droplets },
    ]
};

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    const [creationMode, setCreationMode] = useState<'IMAGE' | 'TEXT'>('IMAGE');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [userPrompt, setUserPrompt] = useState<string>('');
    const [printTechnique, setPrintTechnique] = useState<'CYLINDER' | 'DIGITAL'>('CYLINDER');
    const [colors, setColors] = useState<PantoneColor[]>([]);
    const [colorCount, setColorCount] = useState<number>(0); 
    const [targetLayout, setTargetLayout] = useState<string>('ORIGINAL');
    const [subLayout, setSubLayout] = useState<string>(''); 
    const [dimensions, setDimensions] = useState({ w: '', h: '' });
    const [useTextureOverlay, setUseTextureOverlay] = useState(false);
    const [textureOpacity, setTextureOpacity] = useState(30); 
    const [textureType, setTextureType] = useState<'CANVAS' | 'LINEN' | 'SILK' | 'CUSTOM'>('CANVAS');
    const [textureBlend, setTextureBlend] = useState<'multiply' | 'overlay' | 'soft-light'>('multiply');
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loadingColors, setLoadingColors] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const transferImage = localStorage.getItem('vingi_transfer_image');
        if (transferImage) {
            handleReferenceUpload(transferImage);
            localStorage.removeItem('vingi_transfer_image');
        }
    }, []);

    useEffect(() => { setSubLayout(''); }, [targetLayout]);

    const resetSession = () => {
        setReferenceImage(null); setGeneratedPattern(null); setUserPrompt(''); setColors([]); setError(null); setCreationMode('IMAGE');
        setTargetLayout('ORIGINAL'); setSubLayout(''); setColorCount(0); setUseTextureOverlay(false); setDimensions({ w: '', h: '' });
    };

    const analyzePrompt = async (cleanBase64: string) => {
        try {
            const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ANALYZE_REFERENCE_FOR_PROMPT', mainImageBase64: cleanBase64 }) });
            const data = await res.json();
            if (data.success && data.prompt) setUserPrompt(data.prompt);
        } catch (e) { console.warn("Erro no Prompt Auto:", e); }
    };

    const analyzeColors = async (cleanBase64: string, variation: string = 'NATURAL') => {
        setLoadingColors(true);
        try {
            const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ANALYZE_COLOR_TREND', mainImageBase64: cleanBase64, variation }) });
            const data = await res.json();
            if (data.success && data.colors) setColors(data.colors);
        } catch (e) { console.warn("Erro no Color Dept:", e); }
        setLoadingColors(false);
    };

    const handleReferenceUpload = async (imgBase64: string) => {
        setReferenceImage(imgBase64); setCreationMode('IMAGE'); setIsProcessing(true); setStatusMessage("Iniciando Análise Modular...");
        try {
            const compressed = await compressImage(imgBase64); const cleanBase64 = compressed.split(',')[1];
            await Promise.allSettled([ analyzePrompt(cleanBase64), analyzeColors(cleanBase64, 'NATURAL') ]);
        } catch (e) { console.error(e); } finally { setIsProcessing(false); }
    };

    const handleColorVariation = async (variant: string) => {
        if (!referenceImage) return;
        const compressed = await compressImage(referenceImage);
        analyzeColors(compressed.split(',')[1], variant);
    };

    const handleGenerate = async () => {
        if (!userPrompt.trim()) { setError("Por favor, descreva a estampa."); return; }
        setIsProcessing(true); setStatusMessage(printTechnique === 'DIGITAL' ? "Renderizando Detalhes 4K..." : "Gerando Vetores Chapados...");
        setGeneratedPattern(null); setError(null);
        let finalPrompt = userPrompt;
        if (dimensions.w && dimensions.h) { finalPrompt += ` REQUIRED DIMENSIONS: ${dimensions.w}cm x ${dimensions.h}cm.`; }
        setTimeout(() => setStatusMessage(printTechnique === 'DIGITAL' ? "Aplicando Iluminação..." : `Separando em ${colorCount || 'Auto'} cores...`), 1500);
        try {
            const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'GENERATE_PATTERN', prompt: finalPrompt, colors: colors, selvedge: 'NENHUMA', layoutStyle: targetLayout, subLayoutStyle: subLayout, colorCount: colorCount, technique: printTechnique }) });
            const data = await res.json();
            if (data.success && data.image) {
                setGeneratedPattern(data.image);
                if (printTechnique === 'DIGITAL') setUseTextureOverlay(true);
            } else { throw new Error(data.error || "A IA não conseguiu gerar."); }
        } catch (err: any) { setError(err.message); } finally { setIsProcessing(false); }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => handleReferenceUpload(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleTransfer = (target: string) => {
        if (!generatedPattern) return;
        triggerTransfer(target, generatedPattern);
        if (target === 'MOCKUP' && onNavigateToMockup) onNavigateToMockup();
        if (target === 'LAYER' && onNavigateToLayerStudio) onNavigateToLayerStudio();
    };

    const downloadTechPack = () => {
        if (!generatedPattern) return;
        
        // Criar Canvas de Tech Pack (Imagem + Cores)
        const canvas = document.createElement('canvas');
        canvas.width = 1200; canvas.height = 800;
        const ctx = canvas.getContext('2d')!;
        
        // Fundo Branco
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,1200,800);
        
        // 1. Desenhar Estampa
        const img = new Image(); img.src = generatedPattern;
        img.onload = () => {
            // Estampa na Esquerda (Quadrada)
            ctx.drawImage(img, 50, 50, 600, 600);
            
            // Header
            ctx.fillStyle = '#0f172a'; ctx.font = 'bold 30px Arial'; ctx.fillText('VINGI AI - FICHA TÉCNICA', 700, 80);
            ctx.fillStyle = '#64748b'; ctx.font = '16px Arial'; ctx.fillText(`Técnica: ${printTechnique}`, 700, 110);
            ctx.fillText(`Data: ${new Date().toLocaleDateString()}`, 700, 130);

            // Paleta de Cores (Direita)
            let y = 180;
            ctx.font = 'bold 14px Arial'; ctx.fillStyle = '#000'; ctx.fillText('PALETA DE CORES (SUGESTÃO)', 700, 160);
            
            if (colors.length > 0) {
                colors.slice(0, 6).forEach(c => {
                    ctx.fillStyle = c.hex;
                    ctx.fillRect(700, y, 60, 60);
                    ctx.fillStyle = '#000';
                    ctx.font = 'bold 12px Arial'; ctx.fillText(c.name, 770, y + 20);
                    ctx.font = '12px Arial'; ctx.fillText(c.code || c.hex, 770, y + 40);
                    ctx.font = 'italic 10px Arial'; ctx.fillText(c.role || '', 770, y + 55);
                    y += 80;
                });
            } else {
                ctx.fillText('Cores automáticas geradas pela IA.', 700, 190);
            }

            const link = document.createElement('a');
            link.download = `vingi-techpack-${Date.now()}.jpg`;
            link.href = canvas.toDataURL('image/jpeg');
            link.click();
        };
    };

    const hasActiveSession = referenceImage || generatedPattern;
    const getTextureStyle = () => {
        let svg = "";
        switch(textureType) {
            case 'LINEN': svg = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E`; break;
            case 'SILK': svg = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23ffffff' stop-opacity='0.2'/%3E%3Cstop offset='100%25' stop-color='%23000000' stop-opacity='0.1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23g)'/%3E%3C/svg%3E`; break;
            default: svg = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E`; break;
        }
        return { backgroundImage: `url("${svg}")`, opacity: textureOpacity / 100, mixBlendMode: textureBlend };
    };

    return (
        <div className="h-full bg-[#f8fafc] flex flex-col overflow-hidden">
            <ModuleHeader icon={Palette} title="Estúdio de Criação" subtitle={hasActiveSession ? (printTechnique === 'CYLINDER' ? "Modo Cilindro (Vetorial)" : "Modo Digital (Alta Definição)") : undefined} actionLabel={hasActiveSession ? "Reiniciar" : undefined} onAction={resetSession} />
            {referenceImage && <FloatingReference image={referenceImage} label="Inspiração" />}

            {!hasActiveSession ? (
                <div className="flex-1 overflow-y-auto">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    <ModuleLandingPage icon={Palette} title="Estúdio de Criação" description="Inteligência Artificial Generativa para criação têxtil." features={["Prompt to Print", "Image to Pattern", "Separação de Cores", "Rapport Automático"]} partners={["STORK", "EPSON TEXTILE", "REGGIANI", "MS PRINTING"]} customContent={
                        <div className="flex flex-col gap-6 mt-8">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Selecione o Motor de Geração</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div onClick={() => { setPrintTechnique('CYLINDER'); fileInputRef.current?.click(); }} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:border-vingi-300 transition-all cursor-pointer group flex flex-col gap-4 relative overflow-hidden">
                                    <div className="w-12 h-12 bg-vingi-50 text-vingi-600 rounded-xl flex items-center justify-center"><Cylinder size={24}/></div>
                                    <div><h3 className="text-xl font-bold text-slate-800 mb-1">Cilindro (Vetorial)</h3><p className="text-sm text-slate-500 leading-relaxed">Artes chapadas com cores sólidas. Ideal para quadros e cilindros.</p></div>
                                </div>
                                <div onClick={() => { setPrintTechnique('DIGITAL'); fileInputRef.current?.click(); }} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:border-purple-300 transition-all cursor-pointer group flex flex-col gap-4 relative overflow-hidden">
                                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center"><Printer size={24}/></div>
                                    <div><h3 className="text-xl font-bold text-slate-800 mb-1">Digital (4K)</h3><p className="text-sm text-slate-500 leading-relaxed">Artes com profundidade e textura. Ideal para sublimação.</p></div>
                                </div>
                            </div>
                        </div>
                    }/>
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    <div className="flex-1 bg-slate-900 relative flex items-center justify-center p-4 min-h-[40vh]">
                        {isProcessing ? (
                            <div className="text-center relative z-10 animate-fade-in">
                                <Loader2 size={48} className="text-vingi-400 animate-spin mx-auto mb-4"/>
                                <h2 className="text-white font-bold text-xl tracking-tight">{statusMessage}</h2>
                            </div>
                        ) : generatedPattern ? (
                            <div className="relative shadow-2xl bg-white w-full h-full max-h-[80vh] flex items-center justify-center border border-white/20 animate-fade-in group overflow-hidden rounded-xl">
                                <SmartImageViewer src={generatedPattern} />
                                {useTextureOverlay && ( <div className="absolute inset-0 pointer-events-none w-full h-full" style={getTextureStyle()} /> )}
                            </div>
                        ) : (
                            <div className="text-center opacity-30 select-none"><Grid3X3 size={64} className="mx-auto mb-4 text-white"/><p className="text-white text-sm">Área de Criação</p></div>
                        )}
                        {error && ( <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-4 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 animate-bounce-subtle z-50 border border-red-400 max-w-md"><FileWarning size={20} className="shrink-0"/> <div><p>{error}</p></div></div> )}
                    </div>

                    <div className="w-full md:w-[420px] bg-white border-l border-gray-200 flex flex-col z-20 shadow-xl overflow-y-auto custom-scrollbar h-[50vh] md:h-full">
                        <div className="p-6 space-y-6">
                            {creationMode === 'IMAGE' && (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><ImageIcon size={14}/> Base Visual</h3>
                                    <div className="flex gap-4 items-center">
                                        <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white border border-gray-200 text-gray-600 rounded-lg py-3 text-xs font-bold hover:bg-vingi-50 flex items-center justify-center gap-2"><ImageIcon size={16}/> {referenceImage ? "Trocar Imagem" : "Carregar Foto"}</button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                                    </div>
                                </div>
                            )}
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Sparkles size={14}/> Instrução Criativa</h3>
                                <textarea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} placeholder="Descreva sua ideia..." className="w-full h-24 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:border-vingi-500 focus:bg-white outline-none transition-all shadow-inner text-gray-800"/>
                            </div>
                            
                            {(colors.length > 0) && printTechnique === 'CYLINDER' && (
                                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-xs font-bold text-orange-800 uppercase tracking-widest flex items-center gap-2"><Palette size={14}/> Paleta & Separação</h3>
                                        <div className="flex bg-white rounded-lg p-0.5 border border-orange-200">
                                            <button onClick={() => handleColorVariation('NATURAL')} title="Natural" className="p-1 hover:bg-orange-100 rounded text-gray-500 hover:text-orange-600"><Droplets size={12}/></button>
                                            <button onClick={() => handleColorVariation('VIVID')} title="Mais Vivo" className="p-1 hover:bg-orange-100 rounded text-gray-500 hover:text-orange-600"><Sun size={12}/></button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {colors.slice(0, 4).map((c, i) => ( <PantoneChip key={i} color={c} /> ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3 pt-4 border-t border-gray-100">
                                {!isProcessing && (
                                    <button onClick={handleGenerate} className={`w-full py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 text-white ${printTechnique === 'DIGITAL' ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-vingi-900'}`}><Wand2 size={18}/> {generatedPattern ? "GERAR NOVAMENTE" : `CRIAR ESTAMPA`}</button>
                                )}
                                {generatedPattern && !isProcessing && (
                                    <div className="grid grid-cols-2 gap-2 animate-fade-in">
                                        <button onClick={() => handleTransfer('MOCKUP')} className="py-3 bg-white border border-gray-200 text-gray-700 rounded-lg font-bold text-xs hover:bg-gray-50 flex items-center justify-center gap-2"><Settings2 size={14}/> PROVAR</button>
                                        <button onClick={downloadTechPack} className="py-3 bg-white border border-gray-200 text-gray-700 rounded-lg font-bold text-xs hover:bg-gray-50 flex items-center justify-center gap-2"><FileText size={14}/> FICHA TÉCNICA</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
