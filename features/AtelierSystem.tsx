
// ... existing imports ...
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Wand2, Download, Palette, Loader2, Grid3X3, Settings2, Image as ImageIcon, Type, Sparkles, FileWarning, RefreshCw, Sun, Moon, Contrast, Droplets, ArrowDownToLine, Move, ZoomIn, Minimize2, Check, Cylinder, Printer, Eye, Zap, Layers, Cpu, LayoutTemplate, PaintBucket, Ruler, Box, Target, BoxSelect, Maximize, Copy, FileText, PlusCircle, Pipette, Brush, PenTool, Scissors, Edit3, Feather, Frame, Send, ChevronRight, X, SlidersHorizontal, FileCheck, HardDrive, Play, Info, Lock, Grid, Activity, Cloud, Save, FolderOpen } from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader, FloatingReference, ModuleLandingPage, SmartImageViewer } from '../components/Shared';

// ... (PantoneChip, XCircle, triggerTransfer, compressImage, and config arrays remain the same)
const PantoneChip: React.FC<{ color: PantoneColor, onDelete?: () => void }> = ({ color, onDelete }) => {
    const [showMenu, setShowMenu] = useState(false);
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(color.hex);
    };
    return (
        <div onClick={() => setShowMenu(!showMenu)} className="flex flex-col bg-[#111] shadow-sm border border-gray-800 rounded-lg overflow-hidden cursor-pointer h-14 w-full group relative hover:scale-105 transition-transform">
            <div className="h-8 w-full relative" style={{ backgroundColor: color.hex }}>
                {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute top-1 right-1 bg-black/40 hover:bg-red-500 hover:text-white text-white rounded-full p-0.5 backdrop-blur-sm transition-colors"><XCircle size={10} /></button>}
            </div>
            <div className="flex-1 flex flex-col justify-center bg-[#1a1a1a] px-1.5 py-0.5">
                <span className="text-[9px] font-bold text-gray-300 truncate">{color.name}</span>
                <span className="text-[8px] text-gray-600 font-mono truncate">{color.code || color.hex}</span>
            </div>
            {showMenu && <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-2 animate-fade-in z-10"><button onClick={handleCopy} className="text-white text-[9px] font-bold flex items-center gap-1 hover:text-vingi-400"><Copy size={10}/> HEX</button></div>}
        </div>
    );
};

const XCircle = ({ size = 24, className = "" }) => ( <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg> );

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
            if (ctx) { ctx.drawImage(img, 0, 0, w, h); resolve(canvas.toDataURL('image/jpeg', 0.8)); } else reject(new Error("Canvas error"));
        };
        img.onerror = () => reject(new Error("Load error"));
    });
};

const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/19UC2beAjjSn2s4ROtj6gp6VtKSpdoApR?usp=sharing";

interface AtelierSystemProps {
    onNavigateToMockup?: () => void;
    onNavigateToLayerStudio?: () => void;
}

const LAYOUT_OPTIONS = [
    { id: 'ORIGINAL', label: 'Original', icon: ImageIcon },
    { id: 'CORRIDA', label: 'Corrida', icon: Layers },
    { id: 'BARRADO', label: 'Barrado', icon: ArrowDownToLine },
    { id: 'LENCO', label: 'Lenço', icon: Frame }, 
    { id: 'LOCALIZADA', label: 'Localizada', icon: Target },
    { id: 'PAREO', label: 'Pareô', icon: Maximize },
];

const SUB_LAYOUT_CONFIG: Record<string, { id: string, label: string, icon: any }[]> = {
    'LENCO': [
        { id: 'MEDALHAO', label: 'Medalhão', icon: Target },
        { id: 'BANDANA', label: 'Bandana', icon: BoxSelect },
        { id: 'LISTRADO', label: 'Listrado', icon: Grid3X3 },
        { id: 'FLORAL', label: 'Floral Frame', icon: Feather },
    ],
    'BARRADO': [
        { id: 'SIMPLES', label: 'Simples', icon: ArrowDownToLine },
        { id: 'DUPLO', label: 'Espelhado', icon: ArrowDownToLine }, 
        { id: 'DEGRADE', label: 'Degradê', icon: Droplets },
    ],
    'CORRIDA': [
        { id: 'TOSS', label: 'Aleatório', icon: Sparkles },
        { id: 'GRID', label: 'Grid', icon: Grid3X3 },
        { id: 'ORGANIC', label: 'Orgânico', icon: Droplets },
    ]
};

const SIZE_OPTIONS: Record<string, string[]> = {
    'LENCO': ['60x60cm (Bandana)', '90x90cm (Carré)', '110x110cm (Xale)', '140x140cm (Maxi)'],
    'PAREO': ['100x140cm (Standard)', '115x145cm (Maxi Pareo)', '100x180cm (Canga)'],
    'BARRADO': ['140cm (Largura Útil)', '150cm (Largura Útil)', '100cm (Metro Linear)'],
    'CORRIDA': ['A4 (Rapport)', '50x50cm (Rapport)', '100x100cm (Full Width)'],
    'LOCALIZADA': ['A3 (Frontal)', 'A4 (Bolso/Detalhe)', 'A2 (Costas Full)']
};

const ART_STYLES = [
    { id: 'ORIGINAL', label: 'Original', icon: ImageIcon },
    { id: 'WATERCOLOR', label: 'Aquarela', icon: Droplets },
    { id: 'GIZ', label: 'Giz Pastel', icon: Edit3 },
    { id: 'ACRILICA', label: 'Acrílica', icon: Palette },
    { id: 'VETOR', label: 'Vetor Flat', icon: Box },
    { id: 'BORDADO', label: 'Bordado', icon: Scissors },
    { id: 'LINHA', label: 'Line Art', icon: PenTool },
    { id: 'ORNAMENTAL', label: 'Barroco', icon: Feather },
    { id: 'CUSTOM', label: 'Outro', icon: Edit3 },
];

const TEXTURE_PRESETS = [
    { id: 'NONE', label: 'Lisa', css: 'none' },
    { id: 'LINEN', label: 'Linho', css: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 3px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.1) 3px)` },
    { id: 'CANVAS', label: 'Canvas', css: `repeating-linear-gradient(45deg, transparent 0, transparent 2px, rgba(0,0,0,0.15) 3px), repeating-linear-gradient(-45deg, transparent 0, transparent 2px, rgba(0,0,0,0.15) 3px)` },
    { id: 'PAPER', label: 'Papel', css: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.4'/%3E%3C/svg%3E")` },
    { id: 'TWILL', label: 'Sarja', css: `repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.1) 1px, rgba(0,0,0,0.1) 4px)` },
    { id: 'CUSTOM_AI', label: 'Criar (AI)', css: 'none', isAI: true }
];

export const AtelierSystem: React.FC<AtelierSystemProps> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    // ... (Keep existing state variables) ...
    const [creationMode, setCreationMode] = useState<'IMAGE' | 'TEXT'>('IMAGE');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    
    // --- INPUTS DO PROJETO ---
    const [userPrompt, setUserPrompt] = useState<string>(''); 
    const [customInstruction, setCustomInstruction] = useState<string>(''); 
    const [collectionName, setCollectionName] = useState<string>('');
    const [autoDriveSave, setAutoDriveSave] = useState<boolean>(true);

    const [printTechnique, setPrintTechnique] = useState<'CYLINDER' | 'DIGITAL'>('CYLINDER');
    const [colors, setColors] = useState<PantoneColor[]>([]);
    const [colorCount, setColorCount] = useState<number>(0); 
    
    const [targetLayout, setTargetLayout] = useState<string>('ORIGINAL');
    const [subLayout, setSubLayout] = useState<string>(''); 
    const [artStyle, setArtStyle] = useState<string>('ORIGINAL');
    const [customStyleText, setCustomStyleText] = useState<string>(''); 
    
    const [targetSize, setTargetSize] = useState<string>('');
    const [isCustomSize, setIsCustomSize] = useState(false);
    const [customW, setCustomW] = useState('');
    const [customH, setCustomH] = useState('');

    const [activeTexture, setActiveTexture] = useState('NONE');
    const [textureScale, setTextureScale] = useState(1);
    const [textureOpacity, setTextureOpacity] = useState(0.3);
    const [customTexturePrompt, setCustomTexturePrompt] = useState('');
    const [generatedTextureUrl, setGeneratedTextureUrl] = useState<string | null>(null);
    const [isGeneratingTexture, setIsGeneratingTexture] = useState(false);

    const [customColorInput, setCustomColorInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const [isUpscaling, setIsUpscaling] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const transferImage = localStorage.getItem('vingi_transfer_image');
        if (transferImage) {
            handleReferenceUpload(transferImage);
            localStorage.removeItem('vingi_transfer_image');
        }
    }, []);

    useEffect(() => { 
        setSubLayout(''); 
        setTargetSize('');
        setIsCustomSize(false);
        setCustomW(''); setCustomH('');
    }, [targetLayout]);

    useEffect(() => {
        if (isCustomSize && customW && customH) {
            setTargetSize(`${customW}x${customH}cm`);
        }
    }, [customW, customH, isCustomSize]);

    const resetSession = () => {
        setReferenceImage(null); setGeneratedPattern(null); setUserPrompt(''); setCustomInstruction(''); setColors([]); setError(null); setCreationMode('IMAGE');
        setTargetLayout('ORIGINAL'); setSubLayout(''); setTargetSize(''); setArtStyle('ORIGINAL'); setColorCount(0); setIsCustomSize(false);
        setCustomStyleText(''); setShowDownloadMenu(false); setIsUpscaling(false);
        setActiveTexture('NONE'); setGeneratedTextureUrl(null);
    };

    // ... (Keep existing async functions: analyzePrompt, analyzeColors, handleReferenceUpload, handleGenerateTexture) ...
    const analyzePrompt = async (cleanBase64: string) => {
        try {
            const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ANALYZE_REFERENCE_FOR_PROMPT', mainImageBase64: cleanBase64 }) });
            const data = await res.json();
            if (data.success && data.prompt) setUserPrompt(data.prompt);
        } catch (e) { console.warn("Erro no Prompt Auto:", e); }
    };

    const analyzeColors = async (cleanBase64: string, variation: string = 'NATURAL') => {
        try {
            const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ANALYZE_COLOR_TREND', mainImageBase64: cleanBase64, variation }) });
            const data = await res.json();
            if (data.success && data.colors) setColors(data.colors);
        } catch (e) { console.warn("Erro no Color Dept:", e); }
    };

    const handleReferenceUpload = async (imgBase64: string) => {
        setReferenceImage(imgBase64); setCreationMode('IMAGE'); setIsProcessing(true); 
        try {
            setStatusMessage("Lendo Referência Visual...");
            const compressed = await compressImage(imgBase64); const cleanBase64 = compressed.split(',')[1];
            setStatusMessage("Identificando DNA & Cores...");
            await Promise.allSettled([ analyzePrompt(cleanBase64), analyzeColors(cleanBase64, 'NATURAL') ]);
            setStatusMessage("Preparando Estúdio...");
            await new Promise(resolve => setTimeout(resolve, 800)); 
        } catch (e) { console.error(e); setError("Erro ao analisar imagem."); } 
        finally { setIsProcessing(false); }
    };

    const handleGenerateTexture = async () => {
        if (!customTexturePrompt.trim()) return;
        setIsGeneratingTexture(true);
        try {
            const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'GENERATE_TEXTURE', textureType: 'CUSTOM', texturePrompt: customTexturePrompt }) });
            const data = await res.json();
            if (data.success && data.image) {
                setGeneratedTextureUrl(data.image);
                setActiveTexture('CUSTOM_AI');
            } else {
                alert("Falha ao gerar textura.");
            }
        } catch (e) { console.error(e); }
        finally { setIsGeneratingTexture(false); }
    };

    const performAutoSave = (imageUrl: string) => {
        if (!autoDriveSave) return;
        
        setStatusMessage("Sincronizando com Google Drive...");
        
        const safeCollection = collectionName ? collectionName.replace(/[^a-zA-Z0-9]/g, '_') : 'Nova_Colecao';
        const dateStr = new Date().toISOString().split('T')[0];
        const randomId = Math.floor(Math.random() * 1000);
        const filename = `${dateStr}_${safeCollection}_VINGI_${randomId}.png`;

        // Simula upload com delay para feedback visual
        setTimeout(() => {
            const l = document.createElement('a'); 
            l.download = filename; 
            l.href = imageUrl; 
            document.body.appendChild(l);
            l.click();
            document.body.removeChild(l);
            
            console.log(`Auto-saved to Drive structure: ${filename}`);
            setIsProcessing(false);
            setStatusMessage("");
        }, 2000);
    };

    const handleGenerate = async () => {
        if (!userPrompt.trim()) { setError("Aguarde a análise da referência ou digite um prompt."); return; }
        const finalPrompt = customInstruction ? `USER DIRECTIVE: "${customInstruction}". \nBASE DESCRIPTION: ${userPrompt}` : userPrompt;
        setIsProcessing(true); setStatusMessage(printTechnique === 'DIGITAL' ? "Renderizando Arquivo Digital (4K)..." : "Gerando Vetores Chapados...");
        setGeneratedPattern(null); setError(null); setShowDownloadMenu(false);
        setTimeout(() => setStatusMessage("Aplicando Estilo & Cor..."), 1200);
        try {
            const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ action: 'GENERATE_PATTERN', prompt: finalPrompt, colors: colors, selvedge: 'NENHUMA', layoutStyle: targetLayout, subLayoutStyle: subLayout, artStyle: artStyle, customStyle: customStyleText, targetSize: targetSize, colorCount: colorCount, technique: printTechnique }) });
            const data = await res.json();
            if (data.success && data.image) {
                setGeneratedPattern(data.image);
                if (autoDriveSave) {
                    performAutoSave(data.image);
                } else {
                    setIsProcessing(false);
                }
            } else { throw new Error(data.error || "A IA não conseguiu gerar."); setIsProcessing(false); }
        } catch (err: any) { setError(err.message); setIsProcessing(false); }
    };

    const handleSmartCloudSave = () => {
        if (!generatedPattern) return;
        const name = prompt("Nome para o arquivo da estampa?", collectionName || `Estampa_${new Date().toLocaleDateString().replace(/\//g, '-')}`);
        if (!name) return;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `VINGI_${name}_${timestamp}.png`;
        const l = document.createElement('a'); 
        l.download = filename; 
        l.href = generatedPattern; 
        document.body.appendChild(l);
        l.click();
        document.body.removeChild(l);
        window.open(DRIVE_FOLDER_URL, '_blank');
        setShowDownloadMenu(false);
    };

    const handleProductionDownload = async () => {
        if (!generatedPattern) return;
        setIsUpscaling(true);
        setShowDownloadMenu(false);
        try {
            const cleanBase64 = generatedPattern.split(',')[1];
            const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'PREPARE_PRODUCTION', mainImageBase64: cleanBase64, targetSize: targetSize || "140cm Standard", technique: printTechnique, layoutStyle: targetLayout }) });
            if (!res.ok) { const text = await res.text(); throw new Error(`Erro do Servidor (${res.status}): Tente novamente.`); }
            const textData = await res.text();
            let data;
            try { data = JSON.parse(textData); } catch (jsonError) { throw new Error("Erro de conexão: Resposta inválida do servidor (Timeout em 4K)."); }
            if (data.success && data.image) {
                const l = document.createElement('a'); 
                l.download = `VINGI_PRO_PRODUCTION_${targetSize || 'RAW'}.png`; 
                l.href = data.image; 
                document.body.appendChild(l);
                l.click();
                document.body.removeChild(l);
                if (autoDriveSave) performAutoSave(data.image);
            } else { throw new Error(data.error || "Falha no motor de produção. Tente novamente."); }
        } catch (e: any) { console.error("Production Error:", e); alert(e.message || "Erro ao gerar arquivo de produção."); } finally { setIsUpscaling(false); }
    };

    const handleTransfer = (target: string) => {
        if (!generatedPattern) return;
        triggerTransfer(target, generatedPattern);
        if (target === 'MOCKUP' && onNavigateToMockup) onNavigateToMockup();
        if (target === 'LAYER' && onNavigateToLayerStudio) onNavigateToLayerStudio();
    };

    const handleAddCustomColor = () => {
        if (!customColorInput) return;
        const newColor: PantoneColor = { name: "Manual", code: customColorInput, hex: customColorInput.startsWith('#') ? customColorInput : '#000', role: 'User' };
        setColors(prev => [newColor, ...prev]); setCustomColorInput('');
    };

    const hasActiveSession = referenceImage || generatedPattern;
    const isAnalysisComplete = colors.length > 0 && !isProcessing;

    const getCurrentTextureStyle = () => {
        if (activeTexture === 'CUSTOM_AI' && generatedTextureUrl) {
            return { backgroundImage: `url(${generatedTextureUrl})`, backgroundSize: `${50 * textureScale}%`, opacity: textureOpacity, mixBlendMode: 'multiply' as any };
        }
        const preset = TEXTURE_PRESETS.find(t => t.id === activeTexture);
        if (preset && preset.id !== 'NONE') {
            return { background: preset.css, backgroundSize: `${20 * textureScale}px ${20 * textureScale}px`, opacity: textureOpacity, mixBlendMode: 'multiply' as any };
        }
        return { display: 'none' };
    };

    return (
        <div className="h-full w-full bg-[#000000] flex flex-col overflow-hidden text-white">
            {/* Header */}
            <div className="bg-[#111111] px-4 pb-3 pt-[calc(1.5rem+env(safe-area-inset-top))] flex items-center justify-between shadow-[0_5px_15px_rgba(0,0,0,0.5)] shrink-0 z-50 h-auto min-h-[4.5rem] transition-all duration-300 border-b border-white/5">
                <div className="flex items-center gap-2"><Palette size={18} className="text-vingi-400"/><span className="font-bold text-sm">Atelier AI</span></div>
                <div className="flex gap-2 relative">
                    <button onClick={() => window.open(DRIVE_FOLDER_URL, '_blank')} className="hidden md:flex items-center gap-1 text-[10px] bg-white/5 px-3 py-1.5 rounded hover:bg-white/10 font-bold border border-white/10 transition-colors text-blue-300">
                        <FolderOpen size={12} /> Pasta Drive
                    </button>
                    {hasActiveSession && (
                        <button onClick={resetSession} className="text-[10px] bg-gray-800 px-3 py-1.5 rounded hover:bg-gray-700 font-medium border border-gray-700">Novo</button>
                    )}
                    {generatedPattern && (
                        <div className="flex gap-1">
                            <button onClick={() => handleTransfer('MOCKUP')} className="text-[10px] bg-vingi-900 text-white px-3 py-1.5 rounded font-bold hover:bg-vingi-800 flex items-center gap-1 border border-vingi-700"><Settings2 size={12}/> Provar</button>
                            <button onClick={() => setShowDownloadMenu(!showDownloadMenu)} className="text-[10px] bg-green-900 text-white px-3 py-1.5 rounded font-bold hover:bg-green-800 flex items-center gap-1 border border-green-700 relative"><Download size={12}/> Baixar</button>
                            
                            {showDownloadMenu && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl z-[60] overflow-hidden animate-slide-down">
                                    <div className="p-2 space-y-1">
                                        <button onClick={() => { const l=document.createElement('a'); l.download='vingi-draft.png'; l.href=generatedPattern; l.click(); setShowDownloadMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded-lg flex items-center gap-3 group">
                                            <div className="p-1.5 bg-gray-700 rounded-md group-hover:bg-gray-600"><FileCheck size={14} className="text-gray-300"/></div>
                                            <div><span className="block text-xs font-bold text-white">Rascunho (Rápido)</span><span className="block text-[9px] text-gray-500">Preview JPG</span></div>
                                        </button>
                                        <div className="h-px bg-gray-800 my-1"></div>
                                        {/* NEW: CLOUD SAVE OPTION */}
                                        <button onClick={handleSmartCloudSave} className="w-full text-left px-3 py-2 hover:bg-blue-900/30 rounded-lg flex items-center gap-3 group">
                                            <div className="p-1.5 bg-blue-600 rounded-md group-hover:bg-blue-500"><Cloud size={14} className="text-white"/></div>
                                            <div><span className="block text-xs font-bold text-white">Salvar na Nuvem</span><span className="block text-[9px] text-blue-300">Google Drive Org.</span></div>
                                        </button>
                                        <div className="h-px bg-gray-800 my-1"></div>
                                        <button onClick={handleProductionDownload} className="w-full text-left px-3 py-2 hover:bg-vingi-900/50 rounded-lg flex items-center gap-3 group">
                                            <div className="p-1.5 bg-purple-900/50 rounded-md group-hover:bg-purple-800"><HardDrive size={14} className="text-purple-400"/></div>
                                            <div><span className="block text-xs font-bold text-white">Produção (Final)</span><span className="block text-[9px] text-purple-300">Upscaling 4K & Restauro</span></div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {!hasActiveSession ? (
                <div className="flex-1 bg-[#050505] overflow-y-auto">
                    <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onload=(ev)=>handleReferenceUpload(ev.target?.result as string); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
                    <ModuleLandingPage 
                        icon={Palette} 
                        title="Atelier Generativo" 
                        description="Crie estampas exclusivas com inteligência artificial avançada. Controle total de técnica, estilo e layout." 
                        primaryActionLabel="Criar Estampa" 
                        onPrimaryAction={() => fileInputRef.current?.click()} 
                        features={["Vetorial & Digital", "Variação de Estilo", "Layouts de Lenço", "Pantone TCX"]}
                        customContent={
                            <div className="flex flex-col gap-6 mt-8 w-full max-w-2xl mx-auto">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Escolha a Tecnologia de Impressão</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button onClick={() => { setPrintTechnique('CYLINDER'); fileInputRef.current?.click(); }} className="bg-[#111] border border-gray-800 p-6 rounded-2xl hover:border-vingi-500 transition-all flex flex-col items-center gap-3 group text-center shadow-lg">
                                        <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center group-hover:bg-vingi-900 transition-colors"><Cylinder size={24} className="text-gray-400 group-hover:text-vingi-400"/></div>
                                        <div><h3 className="text-lg font-bold text-white">Cilindro (Vetorial)</h3><p className="text-xs text-gray-500 mt-1">Cores chapadas, separação nítida.</p></div>
                                    </button>
                                    <button onClick={() => { setPrintTechnique('DIGITAL'); fileInputRef.current?.click(); }} className="bg-[#111] border border-gray-800 p-6 rounded-2xl hover:border-purple-500 transition-all flex flex-col items-center gap-3 group text-center shadow-lg">
                                        <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center group-hover:bg-purple-900 transition-colors"><Printer size={24} className="text-gray-400 group-hover:text-purple-400"/></div>
                                        <div><h3 className="text-lg font-bold text-white">Digital (4K)</h3><p className="text-xs text-gray-500 mt-1">Textura fotográfica, degradês complexos.</p></div>
                                    </button>
                                </div>
                                <button onClick={() => window.open(DRIVE_FOLDER_URL, '_blank')} className="mt-4 text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center justify-center gap-2 uppercase tracking-widest bg-blue-900/10 py-3 rounded-lg border border-blue-900/30">
                                    <FolderOpen size={14} /> Acessar Repositório Drive (Cloud)
                                </button>
                            </div>
                        }
                    />
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0 bg-black">
                    {/* CANVAS AREA (LEFT) - MOBILE OPTIMIZED (Fixed Height on Mobile) */}
                    <div className="relative flex items-center justify-center p-0 md:p-4 bg-[#050505] shadow-[inset_-10px_0_20px_rgba(0,0,0,0.5)] z-0 h-[35dvh] shrink-0 md:h-auto md:flex-1 md:basis-auto">
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                        
                        {isProcessing || isUpscaling ? (
                            <div className="text-center relative z-10 animate-fade-in flex flex-col items-center">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-vingi-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                                    <Loader2 size={48} className="text-vingi-400 animate-spin relative z-10 mb-6"/>
                                </div>
                                <h2 className="text-white font-bold text-xl tracking-tight">{isUpscaling ? "Motor de Produção 4K" : statusMessage}</h2>
                                <p className="text-gray-500 text-xs mt-2 font-mono uppercase tracking-widest">{isUpscaling ? "Upscaling & Finalização..." : "Processando IA..."}</p>
                            </div>
                        ) : generatedPattern ? (
                            <div className="relative w-full h-full flex items-center justify-center animate-fade-in group overflow-hidden">
                                <div className="relative w-full h-full">
                                    <SmartImageViewer src={generatedPattern} />
                                    <div className="absolute inset-0 pointer-events-none" style={getCurrentTextureStyle()}></div>
                                </div>
                            </div>
                        ) : (
                            <div className="relative w-full h-full flex flex-col items-center justify-center p-8 text-center gap-6">
                                <div className="border-2 border-dashed border-gray-800 rounded-xl p-12 opacity-50">
                                    <Grid3X3 size={48} className="text-gray-700"/>
                                </div>
                                <div>
                                    <h3 className="text-gray-300 font-bold text-lg mb-1">Área de Visualização</h3>
                                    <p className="text-gray-500 text-sm max-w-xs mx-auto">Sua estampa aparecerá aqui.</p>
                                </div>
                                {colors.length > 0 && (
                                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-vingi-900/80 backdrop-blur border border-vingi-500/30 px-6 py-3 rounded-full animate-slide-down flex items-center gap-3 shadow-lg z-20">
                                        <Check size={14} className="bg-vingi-500 text-black rounded-full p-0.5"/>
                                        <span className="text-xs font-bold text-gray-200">Análise Concluída</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {error && ( <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-900/90 text-white px-6 py-4 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 animate-bounce-subtle z-50 border border-red-700 max-w-md backdrop-blur"><FileWarning size={20} className="shrink-0"/> <div><p>{error}</p></div></div> )}
                        
                        {referenceImage && <div className="absolute bottom-4 left-4 w-20 h-20 rounded-lg border-2 border-gray-700 overflow-hidden shadow-lg bg-black z-20 hover:scale-150 transition-transform origin-bottom-left"><img src={referenceImage} className="w-full h-full object-cover opacity-100" /></div>}
                    </div>

                    {/* CONTROL DECK - MOBILE OPTIMIZED (FLEX-1 + SAFE AREA + SCROLL) */}
                    <div className="w-full md:w-[400px] bg-[#111] flex flex-col z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] flex-1 md:h-full md:flex-none shrink-0 relative transition-all duration-500 min-h-0 pb-[env(safe-area-inset-bottom)]">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6 pb-24 touch-pan-y">
                            {/* ... Content ... */}
                            {!isAnalysisComplete && !generatedPattern && (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-10 gap-4">
                                    <Lock size={32} className="text-gray-600"/>
                                    <p className="text-gray-500 text-xs uppercase tracking-widest font-bold">Ferramentas Bloqueadas</p>
                                    <p className="text-gray-600 text-xs max-w-[200px]">Aguarde a IA analisar a referência e extrair as cores.</p>
                                </div>
                            )}
                            {(isAnalysisComplete || generatedPattern) && (
                                <>
                                    <div className="space-y-2 animate-slide-up">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={12} className="text-vingi-400"/> Direção Criativa</h3>
                                        </div>
                                        
                                        {/* PROJECT METADATA */}
                                        <div className="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 space-y-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="text" 
                                                    value={collectionName} 
                                                    onChange={(e) => setCollectionName(e.target.value)} 
                                                    placeholder="Nome da Coleção/Projeto..." 
                                                    className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-vingi-500 transition-colors"
                                                />
                                            </div>
                                            <div onClick={() => setAutoDriveSave(!autoDriveSave)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${autoDriveSave ? 'bg-blue-900/30 border-blue-500/50' : 'bg-transparent border-gray-800 hover:bg-white/5'}`}>
                                                {autoDriveSave ? <Check size={14} className="text-blue-400"/> : <div className="w-3.5 h-3.5 rounded-full border border-gray-600"/>}
                                                <div className="flex-1">
                                                    <span className={`text-[10px] font-bold block ${autoDriveSave ? 'text-blue-200' : 'text-gray-500'}`}>Backup Automático (Local/Drive)</span>
                                                    <span className="text-[8px] text-gray-600 block">Download imediato para sync na nuvem</span>
                                                </div>
                                                <Cloud size={14} className={autoDriveSave ? "text-blue-400" : "text-gray-600"}/>
                                            </div>
                                        </div>

                                        <div className="relative group">
                                            <textarea 
                                                value={customInstruction} 
                                                onChange={(e) => setCustomInstruction(e.target.value)} 
                                                className="w-full h-20 p-3 bg-[#1a1a1a] border border-gray-800 rounded-xl text-xs resize-none focus:border-vingi-500 outline-none text-white placeholder-gray-600 transition-all focus:bg-black" 
                                                placeholder="IA analisa automaticamente. Digite aqui para forçar mudanças (ex: 'Fundo preto', 'Estilo vintage')..."
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2 animate-slide-up" style={{animationDelay: '0.1s'}}>
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Palette size={12}/> Paleta Detectada</h3>
                                            <span className="text-[9px] text-gray-600">{colors.length} Cores</span>
                                        </div>
                                        <div className="grid grid-cols-6 gap-1.5">
                                            {colors.map((c, i) => ( <PantoneChip key={i} color={c} onDelete={() => setColors(prev => prev.filter((_, idx) => idx !== i))} /> ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3 animate-slide-up" style={{animationDelay: '0.2s'}}>
                                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><LayoutTemplate size={12}/> Layout da Estampa</h3>
                                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar touch-pan-x">
                                            {LAYOUT_OPTIONS.map(opt => (
                                                <button 
                                                    key={opt.id} 
                                                    onClick={() => setTargetLayout(opt.id)}
                                                    className={`flex flex-col items-center justify-center min-w-[64px] h-[64px] p-1 rounded-lg border transition-all ${targetLayout === opt.id ? 'bg-vingi-900 border-vingi-500 text-white shadow-sm' : 'bg-[#1a1a1a] border-gray-800 text-gray-500 hover:bg-gray-800'}`}
                                                >
                                                    <opt.icon size={20} strokeWidth={1.5} className="mb-1.5"/>
                                                    <span className="text-[9px] font-bold">{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                        {SUB_LAYOUT_CONFIG[targetLayout] && (
                                            <div className="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 animate-slide-down">
                                                <div className="grid grid-cols-2 gap-2">
                                                    {SUB_LAYOUT_CONFIG[targetLayout].map(sub => (
                                                        <button 
                                                            key={sub.id} 
                                                            onClick={() => setSubLayout(sub.id)}
                                                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-bold transition-all ${subLayout === sub.id ? 'bg-white text-black border-white' : 'bg-transparent border-gray-700 text-gray-400 hover:bg-gray-800'}`}
                                                        >
                                                            <sub.icon size={12} /> {sub.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 animate-slide-down">
                                            <p className="text-[9px] font-bold text-gray-500 mb-2 uppercase flex items-center gap-1"><Ruler size={10}/> Dimensões</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {SIZE_OPTIONS[targetLayout]?.map((sizeStr, idx) => (
                                                    <button key={idx} onClick={() => { setTargetSize(sizeStr); setIsCustomSize(false); }} className={`flex items-center justify-center px-2 py-2 rounded-lg border text-[9px] font-bold transition-all ${targetSize === sizeStr && !isCustomSize ? 'bg-blue-900 border-blue-500 text-white' : 'bg-transparent border-gray-700 text-gray-400 hover:bg-gray-800'}`}>{sizeStr}</button>
                                                ))}
                                                <button onClick={() => setIsCustomSize(true)} className={`flex items-center justify-center px-2 py-2 rounded-lg border text-[9px] font-bold transition-all ${isCustomSize ? 'bg-vingi-900 border-vingi-500 text-white' : 'bg-transparent border-gray-700 text-gray-400 hover:bg-gray-800'}`}><SlidersHorizontal size={12} className="mr-1"/> Personalizado</button>
                                            </div>
                                            {isCustomSize && (<div className="flex gap-2 mt-2 animate-fade-in"><div className="flex-1 bg-black rounded-lg border border-gray-700 flex items-center px-2"><span className="text-[9px] text-gray-500 font-bold mr-1">L:</span><input type="text" placeholder="Largura" value={customW} onChange={e => setCustomW(e.target.value)} className="w-full bg-transparent text-white text-[10px] py-2 outline-none"/></div><div className="flex-1 bg-black rounded-lg border border-gray-700 flex items-center px-2"><span className="text-[9px] text-gray-500 font-bold mr-1">A:</span><input type="text" placeholder="Altura" value={customH} onChange={e => setCustomH(e.target.value)} className="w-full bg-transparent text-white text-[10px] py-2 outline-none"/></div></div>)}
                                        </div>
                                    </div>

                                    <div className="space-y-3 pb-4 animate-slide-up" style={{animationDelay: '0.3s'}}>
                                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Brush size={12}/> Estilo Artístico</h3>
                                        <div className="grid grid-cols-4 gap-2">
                                            {ART_STYLES.map(style => (
                                                <button key={style.id} onClick={() => setArtStyle(style.id)} className={`flex flex-col items-center justify-center h-16 p-1 rounded-lg border transition-all ${artStyle === style.id ? 'bg-purple-900/50 border-purple-500 text-purple-200 shadow-sm' : 'bg-[#1a1a1a] border-gray-800 text-gray-500 hover:bg-gray-800'}`}><style.icon size={18} strokeWidth={1.5} className="mb-1"/><span className="text-[9px] font-bold text-center leading-none">{style.label}</span></button>
                                            ))}
                                        </div>
                                        {artStyle === 'CUSTOM' && (<div className="animate-fade-in mt-2"><input type="text" value={customStyleText} onChange={(e) => setCustomStyleText(e.target.value)} placeholder="Descreva o estilo (Ex: Pontilhismo, Art Deco...)" className="w-full bg-black border border-gray-700 rounded-lg p-3 text-xs text-white outline-none focus:border-vingi-500 transition-colors"/></div>)}
                                    </div>

                                    <div className="pt-4 border-t border-white/5 animate-slide-up" style={{animationDelay: '0.4s'}}>
                                        {!isProcessing && !isUpscaling && (
                                            <button onClick={handleGenerate} className={`w-full py-5 rounded-xl font-bold shadow-2xl flex items-center justify-center gap-3 text-white transition-all active:scale-95 text-base relative overflow-hidden group ${printTechnique === 'DIGITAL' ? 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:brightness-110 shadow-purple-900/20' : 'bg-gradient-to-r from-vingi-700 to-blue-700 hover:brightness-110 shadow-vingi-900/20'}`}>
                                                {!generatedPattern && <span className="absolute inset-0 bg-white/20 animate-pulse rounded-xl"></span>}
                                                <div className="relative flex items-center gap-2">
                                                    {generatedPattern ? <RefreshCw size={20}/> : <Play size={20} fill="currentColor" className="animate-pulse"/>}
                                                    {generatedPattern ? "Regerar Variação" : "CRIAR ESTAMPA"}
                                                </div>
                                            </button>
                                        )}
                                    </div>

                                    {generatedPattern && (
                                        <div className="space-y-3 pb-4 border-t border-white/5 pt-4 animate-slide-up" style={{animationDelay: '0.1s'}}>
                                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Grid size={12}/> Acabamento & Textura (Overlay)</h3>
                                            <div className="grid grid-cols-3 gap-2">
                                                {TEXTURE_PRESETS.map(tex => (
                                                    <button key={tex.id} onClick={() => { setActiveTexture(tex.id); if(tex.id === 'NONE') setGeneratedTextureUrl(null); }} className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all ${activeTexture === tex.id ? 'bg-white text-black border-white' : 'bg-transparent border-gray-700 text-gray-400 hover:bg-gray-800'}`}>{tex.label}</button>
                                                ))}
                                            </div>
                                            {activeTexture === 'CUSTOM_AI' && (
                                                <div className="flex gap-2 animate-fade-in">
                                                    <input type="text" value={customTexturePrompt} onChange={(e) => setCustomTexturePrompt(e.target.value)} placeholder="Ex: Seda amassada, Tecido Bouclé..." className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-vingi-500"/>
                                                    <button onClick={handleGenerateTexture} disabled={isGeneratingTexture} className="bg-vingi-900 border border-vingi-700 text-white rounded-lg px-3 flex items-center justify-center hover:bg-vingi-800">{isGeneratingTexture ? <Loader2 size={14} className="animate-spin"/> : <Wand2 size={14}/>}</button>
                                                </div>
                                            )}
                                            {activeTexture !== 'NONE' && (
                                                <div className="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 space-y-3 animate-slide-down">
                                                    <div className="flex items-center gap-3"><span className="text-[9px] font-bold text-gray-500 uppercase w-12">Intensidade</span><input type="range" min="0.1" max="1" step="0.1" value={textureOpacity} onChange={(e) => setTextureOpacity(parseFloat(e.target.value))} className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none accent-white"/></div>
                                                    <div className="flex items-center gap-3"><span className="text-[9px] font-bold text-gray-500 uppercase w-12">Densidade</span><input type="range" min="0.5" max="3" step="0.1" value={textureScale} onChange={(e) => setTextureScale(parseFloat(e.target.value))} className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none accent-white"/></div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
