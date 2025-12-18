
import React, { useRef } from 'react';
import { Palette, Download } from 'lucide-react';
import { ModuleLandingPage } from '../../components/Shared';
import { useDevice } from '../../hooks/useDevice';
import { AtelierDesktop } from './AtelierDesktop';
import { AtelierMobile } from './AtelierMobile';
import { useAtelierStore } from './useAtelierStore';

export const AtelierSystem: React.FC = () => {
    const { isMobile } = useDevice();
    const store = useAtelierStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const r = new FileReader();
            r.onload = (ev) => store.handleUpload(ev.target?.result as string);
            r.readAsDataURL(file);
        }
    };

    const commonProps = {
        referenceImage: store.referenceImage!,
        generatedPattern: store.generatedPattern,
        colors: store.colors,
        setColors: store.setColors,
        isProcessing: store.isProcessing,
        setIsProcessing: () => {}, // Gerenciado pelo store
        activeLayout: store.activeLayout,
        setActiveLayout: store.setActiveLayout,
        activeStyle: store.activeStyle,
        setActiveStyle: store.setActiveStyle,
        userPrompt: store.userPrompt,
        setUserPrompt: store.setUserPrompt,
        onGenerate: store.generate
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden relative">
            <header className="h-14 bg-[#111] border-b border-white/5 flex items-center justify-between px-6 z-50 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-vingi-900/50 p-1.5 rounded-lg border border-vingi-500/30 text-vingi-400"><Palette size={18}/></div>
                    <span className="font-black text-[10px] uppercase tracking-[0.2em]">Atelier AI Pro</span>
                </div>
                {store.generatedPattern && (
                    <button onClick={store.reset} className="text-[10px] font-black uppercase text-gray-500 hover:text-white transition-colors">Novo Projeto</button>
                )}
            </header>

            {!store.referenceImage ? (
                <div className="flex-1 bg-white">
                    <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/*" />
                    <ModuleLandingPage 
                        icon={Palette} 
                        title="Atelier de Estamparia" 
                        description="Engenharia cromática e gerador de padrões industriais." 
                        primaryActionLabel="Carregar Referência" 
                        onPrimaryAction={() => fileInputRef.current?.click()} 
                        partners={["PANTONE TCX", "VINGI GEN 4K"]} 
                    />
                </div>
            ) : (
                <div className="flex-1">
                    {isMobile ? <AtelierMobile {...commonProps} /> : <AtelierDesktop {...commonProps} />}
                </div>
            )}
        </div>
    );
};
