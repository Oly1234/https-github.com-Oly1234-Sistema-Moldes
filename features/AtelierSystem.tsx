
import React, { useState, useRef } from 'react';
import { Palette, Download, Image as ImageIcon } from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleLandingPage } from '../components/Shared';
import { useDevice } from '../hooks/useDevice';
import { AtelierDesktop } from './Atelier/AtelierDesktop';
import { AtelierMobile } from './Atelier/AtelierMobile';

export const AtelierSystem: React.FC<{ onNavigateToMockup: () => void, onNavigateToLayerStudio: () => void }> = ({ onNavigateToMockup, onNavigateToLayerStudio }) => {
    const { isMobile } = useDevice();
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [userPrompt, setUserPrompt] = useState<string>(''); 
    const [colors, setColors] = useState<PantoneColor[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeLayout, setActiveLayout] = useState('CORRIDA');
    const [activeStyle, setActiveStyle] = useState('VETOR');
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const r = new FileReader();
            r.onload = (ev) => {
                const base64 = ev.target?.result as string;
                setReferenceImage(base64);
                analyzeReference(base64);
            };
            r.readAsDataURL(file);
        }
    };

    const analyzeReference = async (base64: string) => {
        setIsProcessing(true);
        setColors([]); 
        try {
            const clean = base64.split(',')[1];
            const res = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ action: 'ANALYZE_COLOR_TREND', mainImageBase64: clean, variation: 'NATURAL' }) 
            });
            const data = await res.json();
            if (data.success) setColors(data.colors);
        } catch (e) { console.error(e); } finally { setIsProcessing(false); }
    };

    const handleGenerate = async () => {
        setIsProcessing(true);
        setGeneratedPattern(null);
        try {
            const res = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: userPrompt || "Exclusive textile print", 
                    colors: colors, 
                    layoutStyle: activeLayout, 
                    artStyle: activeStyle 
                }) 
            });
            const data = await res.json();
            if (data.success) setGeneratedPattern(data.image);
        } catch (e) { console.error(e); } finally { setIsProcessing(false); }
    };

    const commonProps = {
        referenceImage: referenceImage!,
        generatedPattern,
        colors,
        isProcessing,
        activeLayout,
        activeStyle,
        userPrompt,
        setActiveLayout,
        setActiveStyle,
        setUserPrompt,
        handleGenerate,
        analyzeReference
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden relative">
            {/* Header Global */}
            <div className="bg-[#111] h-14 border-b border-white/5 px-4 flex items-center justify-between shrink-0 z-[100]">
                <div className="flex items-center gap-2">
                    <div className="bg-vingi-900/50 p-1.5 rounded-lg border border-vingi-500/30 text-vingi-400"><Palette size={18}/></div>
                    <div className="flex flex-col">
                        <span className="font-black text-[10px] uppercase tracking-widest leading-none">Atelier AI Studio</span>
                        <span className="text-[8px] text-vingi-500 font-bold uppercase tracking-tighter mt-1">Industrial Surface Design</span>
                    </div>
                </div>
                {generatedPattern && (
                    <button onClick={() => setShowDownloadMenu(true)} className="bg-white text-black px-4 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg hover:bg-gray-200 transition-all"><Download size={12}/> Salvar</button>
                )}
            </div>

            {!referenceImage ? (
                <div className="flex-1 bg-white">
                    <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/*" />
                    <ModuleLandingPage icon={Palette} title="Atelier de Estamparia" description="Extraia o DNA cromático de referências reais e gere estampas industriais exclusivas com controle de layout e estilo artístico." primaryActionLabel="Selecionar Referência" onPrimaryAction={() => fileInputRef.current?.click()} partners={["PANTONE TCX", "VINGI GENERATIVE", "CAD TEXTILE"]} />
                </div>
            ) : (
                <div className="flex-1 w-full h-full">
                    {isMobile ? <AtelierMobile {...commonProps} /> : <AtelierDesktop {...commonProps} />}
                </div>
            )}

            {/* Menu de Download Universal */}
            {showDownloadMenu && (
                <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-[#111] border border-white/10 rounded-[3rem] p-12 max-w-md w-full text-center space-y-8 shadow-2xl">
                        <div className="w-20 h-20 bg-vingi-900 rounded-3xl flex items-center justify-center mx-auto border border-vingi-500/30 rotate-3">
                            <Download className="text-vingi-400" size={40}/>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Exportar Arte</h3>
                            <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest">A imagem será salva em Digital 4K para produção industrial.</p>
                        </div>
                        <div className="grid gap-3">
                            <button onClick={() => { const l=document.createElement('a'); l.download='vingi-pattern-4k.png'; l.href=generatedPattern!; l.click(); setShowDownloadMenu(false); }} className="w-full py-5 bg-white text-black rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-4 transition-all hover:bg-gray-100 shadow-xl"><ImageIcon size={18}/> Download PNG (4K)</button>
                            <button onClick={() => setShowDownloadMenu(false)} className="text-[10px] text-gray-600 font-bold uppercase hover:text-white transition-all pt-4">Fechar Galeria</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
