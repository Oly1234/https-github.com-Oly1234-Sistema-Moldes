
import React, { useRef } from 'react';
import { Shirt } from 'lucide-react';
import { ModuleLandingPage } from '../../components/Shared';
import { useDevice } from '../../hooks/useDevice';
import { MockupDesktop } from './MockupDesktop';
import { useMockupStore } from './useMockupStore';

export const MockupStudio: React.FC = () => {
    const { isMobile } = useDevice();
    const store = useMockupStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const r = new FileReader();
            r.onload = (ev) => store.handleUpload(ev.target?.result as string);
            r.readAsDataURL(file);
        }
    };

    const handleDownload = () => {
        if (!canvasRef.current) return;
        const l = document.createElement('a'); l.download = 'vingi-mockup.png'; l.href = canvasRef.current.toDataURL(); l.click();
    };

    return (
        <div className="flex flex-col h-full bg-black overflow-hidden relative">
            <header className="h-14 bg-[#111] border-b border-white/5 flex items-center justify-between px-6 z-50 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-vingi-900/50 p-1.5 rounded-lg border border-vingi-500/30 text-vingi-400"><Shirt size={18}/></div>
                    <span className="font-black text-[10px] uppercase tracking-[0.2em]">Mockup Technical v4</span>
                </div>
            </header>

            {!store.moldImage ? (
                <div className="flex-1 bg-white">
                    <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/*" />
                    <ModuleLandingPage icon={Shirt} title="Estúdio de Mockup" description="Aplicação técnica de estampas em moldes 2D. Controle de escala, fio de tecido e sombreamento industrial." primaryActionLabel="Selecionar Molde" onPrimaryAction={() => fileInputRef.current?.click()} partners={["CLO 3D", "CAD TEXTILE", "LECTRA"]} />
                </div>
            ) : (
                <div className="flex-1">
                    {isMobile ? (
                        <div className="p-12 text-center font-black uppercase text-gray-400">Layout Mobile do Mockup em carregamento...</div>
                    ) : (
                        <MockupDesktop 
                            canvasRef={canvasRef}
                            activeTool={store.activeTool}
                            setActiveTool={store.setActiveTool}
                            activeScale={store.activeScale}
                            setActiveScale={store.setActiveScale}
                            activeRotation={store.activeRotation}
                            setActiveRotation={store.setActiveRotation}
                            onDownload={handleDownload}
                            onReset={store.reset}
                        />
                    )}
                </div>
            )}
        </div>
    );
};
