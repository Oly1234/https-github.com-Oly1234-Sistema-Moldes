
import React, { useState, useRef, useEffect } from 'react';
import { 
    UploadCloud, Wand2, Download, Palette, Loader2, Grid3X3, Settings2, Image as ImageIcon, 
    Sparkles, FileWarning, RefreshCw, Droplets, ArrowDownToLine, Move, ZoomIn, 
    Check, Cylinder, Printer, Zap, Layers, LayoutTemplate, Ruler, Target, 
    Maximize, Copy, X, SlidersHorizontal, FileCheck, HardDrive, Play, Lock, Grid 
} from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader, ModuleLandingPage, SmartImageViewer } from '../components/Shared';

const PantoneChip: React.FC<{ color: PantoneColor, onDelete?: () => void }> = ({ color, onDelete }) => {
    const [showMenu, setShowMenu] = useState(false);
    return (
        <div onClick={() => setShowMenu(!showMenu)} className="flex flex-col bg-[#111] shadow-sm border border-gray-800 rounded-lg overflow-hidden cursor-pointer h-14 w-full group relative hover:scale-105 transition-transform">
            <div className="h-8 w-full relative" style={{ backgroundColor: color.hex }}>
                {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute top-1 right-1 bg-black/40 hover:bg-red-500 text-white rounded-full p-0.5 transition-colors"><X size={10} /></button>}
            </div>
            <div className="flex-1 flex flex-col justify-center bg-[#1a1a1a] px-1.5 py-0.5">
                <span className="text-[9px] font-bold text-gray-300 truncate">{color.name}</span>
                <span className="text-[8px] text-gray-600 font-mono truncate">{color.code}</span>
            </div>
        </div>
    );
};

const triggerTransfer = (targetModule: string, imageData: string) => {
    if (targetModule === 'MOCKUP') localStorage.setItem('vingi_mockup_pattern', imageData);
    if (targetModule === 'LAYER') localStorage.setItem('vingi_layer_studio_source', imageData);
    window.dispatchEvent(new CustomEvent('vingi_transfer', { detail: { module: targetModule } }));
};

export const AtelierSystem: React.FC<{ onNavigateToMockup?: () => void, onNavigateToLayerStudio?: () => void }> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [userPrompt, setUserPrompt] = useState<string>(''); 
    const [customInstruction, setCustomInstruction] = useState<string>(''); 
    const [printTechnique, setPrintTechnique] = useState<'CYLINDER' | 'DIGITAL'>('DIGITAL');
    const [colors, setColors] = useState<PantoneColor[]>([]);
    const [targetLayout, setTargetLayout] = useState<string>('ORIGINAL');
    const [artStyle, setArtStyle] = useState<string>('ORIGINAL');
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleReferenceUpload = async (imgBase64: string) => {
        setReferenceImage(imgBase64); setIsProcessing(true); 
        try {
            setStatusMessage("Analisando DNA da Referência...");
            const resPrompt = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ANALYZE_REFERENCE_FOR_PROMPT', mainImageBase64: imgBase64.split(',')[1] }) });
            const dataPrompt = await resPrompt.json();
            if (dataPrompt.success) setUserPrompt(dataPrompt.prompt);
            const resColors = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ANALYZE_COLOR_TREND', mainImageBase64: imgBase64.split(',')[1] }) });
            const dataColors = await resColors.json();
            if (dataColors.success) setColors(dataColors.colors);
        } catch (e) { setError("Erro ao analisar imagem."); } 
        finally { setIsProcessing(false); }
    };

    const handleGenerate = async () => {
        setIsProcessing(true); 
        setStatusMessage(printTechnique === 'DIGITAL' ? "Renderização Digital Sênior..." : "Engenharia de Cilindro...");
        try {
            const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                action: 'GENERATE_PATTERN', prompt: customInstruction || userPrompt, colors, technique: printTechnique, layoutStyle: targetLayout, artStyle 
            }) });
            const data = await res.json();
            if (data.success) setGeneratedPattern(data.image);
            else throw new Error(data.error);
        } catch (err: any) { setError(err.message); } finally { setIsProcessing(false); }
    };

    if (!referenceImage && !generatedPattern) {
        return (
            <div className="flex-1 bg-[#050505] overflow-y-auto">
                <input type="file" ref={fileInputRef} onChange={(e) => { const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>handleReferenceUpload(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                <ModuleLandingPage icon={Palette} title="Atelier de Criação" description="Crie estampas profissionais a partir de referências. O motor Digital simula técnicas manuais de designer para moda feminina." primaryActionLabel="Carregar Referência" onPrimaryAction={() => fileInputRef.current?.click()} features={["Photoshop Style", "Cilindro Vetorial", "Pantone TCX"]} />
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-[#000000] flex flex-col overflow-hidden text-white">
            <div className="bg-[#111111] px-4 py-2 flex items-center justify-between border-b border-gray-900 h-14 shrink-0 z-50">
                <div className="flex items-center gap-2"><Palette size={18} className="text-vingi-400"/><span className="font-bold text-sm">Atelier Studio</span></div>
                <div className="flex gap-2">
                    <button onClick={() => { setReferenceImage(null); setGeneratedPattern(null); }} className="text-[10px] bg-gray-800 px-3 py-1.5 rounded font-medium border border-gray-700">Novo</button>
                    {generatedPattern && <button onClick={() => triggerTransfer('MOCKUP', generatedPattern)} className="text-[10px] bg-vingi-600 px-3 py-1.5 rounded font-bold">Mockup 3D</button>}
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                <div className="flex-1 bg-[#050505] relative flex items-center justify-center shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]">
                    {isProcessing ? (
                        <div className="text-center animate-fade-in"><Loader2 size={48} className="text-vingi-400 animate-spin mb-4 mx-auto"/><h2 className="text-white font-bold">{statusMessage}</h2></div>
                    ) : generatedPattern ? (
                        <SmartImageViewer src={generatedPattern} className="w-full h-full" />
                    ) : (
                        <div className="opacity-20 text-center"><Grid3X3 size={64}/><p className="mt-2 font-bold uppercase text-xs">Área de Visualização</p></div>
                    )}
                    {referenceImage && <div className="absolute bottom-4 left-4 w-24 h-24 rounded-lg border-2 border-gray-700 overflow-hidden shadow-2xl"><img src={referenceImage} className="w-full h-full object-cover" /></div>}
                </div>

                <div className="w-full md:w-[380px] bg-[#0a0a0a] border-l border-white/5 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                    <div className="space-y-4">
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                            <button onClick={() => setPrintTechnique('DIGITAL')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black transition-all ${printTechnique==='DIGITAL' ? 'bg-white text-black' : 'text-gray-500'}`}>DIGITAL PRO</button>
                            <button onClick={() => setPrintTechnique('CYLINDER')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black transition-all ${printTechnique==='CYLINDER' ? 'bg-white text-black' : 'text-gray-500'}`}>CILINDRO</button>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Ajuste Criativo</h3>
                            <textarea value={customInstruction} onChange={e => setCustomInstruction(e.target.value)} className="w-full h-24 p-3 bg-black border border-white/10 rounded-xl text-xs outline-none focus:border-vingi-500 transition-all" placeholder="Ex: Manter o fundo mas aumentar as flores..." />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex justify-between">Paleta Reference <span>{colors.length}</span></h3>
                            <div className="grid grid-cols-5 gap-1.5">{colors.map((c, i) => <PantoneChip key={i} color={c} />)}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-gray-600 uppercase">Layout</label>
                                <select value={targetLayout} onChange={e => setTargetLayout(e.target.value)} className="w-full p-2.5 bg-black border border-white/10 rounded-lg text-[10px] font-bold">
                                    <option value="ORIGINAL">Corrido</option>
                                    <option value="BARRADO">Barrado</option>
                                    <option value="LENCO">Lenço</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-gray-600 uppercase">Estilo</label>
                                <select value={artStyle} onChange={e => setArtStyle(e.target.value)} className="w-full p-2.5 bg-black border border-white/10 rounded-lg text-[10px] font-bold">
                                    <option value="ORIGINAL">Referência</option>
                                    <option value="WATERCOLOR">Aquarela</option>
                                    <option value="ACRILICA">Acrílica</option>
                                </select>
                            </div>
                        </div>

                        <button onClick={handleGenerate} disabled={isProcessing} className="w-full py-4 bg-vingi-500 text-black rounded-xl font-black text-xs uppercase tracking-widest shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:bg-white transition-all active:scale-95 disabled:opacity-30">
                            {isProcessing ? "Processando..." : "Gerar Evolução Técnica"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
