
import React, { useRef } from 'react';
import { Globe, RefreshCw } from 'lucide-react';
import { ModuleLandingPage } from '../../components/Shared';
import { useDevice } from '../../hooks/useDevice';
import { RadarDesktop } from './RadarDesktop';
import { useRadarStore } from './useRadarStore';

export const PatternCreator: React.FC = () => {
    const { isMobile } = useDevice();
    const store = useRadarStore();
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
        isAnalyzing: store.isAnalyzing,
        hasAnalyzed: store.hasAnalyzed,
        detectedColors: store.detectedColors,
        uniqueMatches: store.fabricMatches.filter((match, idx, self) => idx === self.findIndex(m => m.url === match.url)),
        visibleMatchesCount: store.visibleMatchesCount,
        setVisibleMatchesCount: store.setVisibleMatchesCount,
        onStartAnalysis: store.startAnalysis,
        onReset: store.reset
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden relative">
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-50 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-vingi-900 p-2 rounded-lg text-white shadow-lg"><Globe size={18}/></div>
                    <span className="font-black text-sm uppercase tracking-widest text-gray-900">Radar Global de Estampas</span>
                </div>
                {store.referenceImage && (
                    <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-gray-500 bg-gray-50 px-4 py-2 rounded-xl hover:bg-gray-100 flex items-center gap-2 uppercase tracking-widest transition-all"><RefreshCw size={14}/> Nova Textura</button>
                )}
            </header>

            <input type="file" ref={fileInputRef} onChange={onFileChange} accept="image/*" className="hidden" />

            {!store.referenceImage ? (
                <div className="flex-1 bg-white">
                    <ModuleLandingPage icon={Globe} title="Radar de Estampas" description="Encontre o fornecedor e o arquivo digital de qualquer estampa através de visão computacional em acervos globais." primaryActionLabel="Escanear Textura" onPrimaryAction={() => fileInputRef.current?.click()} partners={["PATTERN BANK", "SPOONFLOWER", "ADOBE STOCK"]} />
                </div>
            ) : (
                <div className="flex-1 w-full h-full">
                    {isMobile ? <div className="p-12 text-center font-black uppercase text-gray-400">Versão Mobile do Radar sendo carregada...</div> : <RadarDesktop {...commonProps} />}
                </div>
            )}
        </div>
    );
};
