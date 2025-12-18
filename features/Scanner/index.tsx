
import React, { useRef } from 'react';
import { ScanLine } from 'lucide-react';
import { ModuleLandingPage } from '../../components/Shared';
import { useDevice } from '../../hooks/useDevice';
import { ScannerDesktop } from './ScannerDesktop';
import { ScannerMobile } from './ScannerMobile';
import { useScannerStore } from './useScannerStore';

export const ScannerSystem: React.FC = () => {
    const { isMobile } = useDevice();
    const store = useScannerStore();
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
        uploadedImage: store.uploadedImage!,
        result: store.result,
        isAnalyzing: store.isAnalyzing,
        onStart: store.startAnalysis,
        onReset: store.reset
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
            <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 shrink-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="bg-vingi-900 p-2 rounded-lg text-white shadow-lg"><ScanLine size={18}/></div>
                    <span className="font-black text-sm uppercase tracking-widest text-gray-900">Caçador de Moldes AI</span>
                </div>
            </header>

            {!store.uploadedImage ? (
                <div className="flex-1 bg-white">
                    <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/*" />
                    <ModuleLandingPage 
                        icon={ScanLine} 
                        title="Engenharia Reversa" 
                        description="Descubra a modelagem de qualquer peça de roupa através de uma foto. A IA identifica a silhueta técnica e localiza moldes reais." 
                        primaryActionLabel="Carregar Foto" 
                        onPrimaryAction={() => fileInputRef.current?.click()} 
                        partners={["BURDA STYLE", "SIMPLICITY", "MCCALLS", "INDIE PATTERNS"]} 
                    />
                </div>
            ) : (
                <div className="flex-1">
                    {isMobile ? <ScannerMobile {...commonProps} /> : <ScannerDesktop {...commonProps} />}
                </div>
            )}
        </div>
    );
};
