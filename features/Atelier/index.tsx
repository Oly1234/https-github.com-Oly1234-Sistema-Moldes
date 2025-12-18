
import React, { useRef } from 'react';
import { Palette, Cylinder, Printer, ArrowRight } from 'lucide-react';
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
        ...store,
        onGenerate: store.generate
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden relative">
            <header className="h-16 bg-[#111] border-b border-white/5 flex items-center justify-between px-6 z-50 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-vingi-900/50 p-2 rounded-xl border border-vingi-500/30 text-vingi-400 shadow-lg"><Palette size={20}/></div>
                    <span className="font-black text-sm uppercase tracking-[0.3em] text-white">Atelier Industrial v6.5</span>
                </div>
                {store.referenceImage && (
                    <button onClick={store.reset} className="text-[10px] font-black uppercase text-gray-500 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-xl border border-white/5">Novo Projeto</button>
                )}
            </header>

            {!store.technique ? (
                 <div className="flex-1 flex flex-col items-center justify-center p-6 bg-black">
                     <div className="max-w-4xl w-full space-y-12 animate-fade-in">
                        <div className="text-center space-y-4">
                            <h2 className="text-4xl font-black uppercase tracking-tighter">Escolha a Tecnologia de Impressão</h2>
                            <p className="text-gray-500 font-medium">A IA ajustará os vetores e a separação de cores baseada no método produtivo.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <TechCard 
                                icon={Cylinder} 
                                title="Cilindro (Vetorial)" 
                                desc="Cores chapadas, traço nítido, ideal para rotativa clássica." 
                                onClick={() => store.setTechnique('CYLINDER')} 
                            />
                            <TechCard 
                                icon={Printer} 
                                title="Digital (Sublimação)" 
                                desc="Degradês infinitos, 4K, ideal para poliéster e seda digital." 
                                onClick={() => store.setTechnique('DIGITAL')} 
                            />
                        </div>
                     </div>
                 </div>
            ) : !store.referenceImage ? (
                <div className="flex-1 bg-white">
                    <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/*" />
                    <ModuleLandingPage 
                        icon={Palette} 
                        title="Atelier Generativo" 
                        description="Engenharia cromática e gerador de padrões industriais baseado em visão computacional." 
                        primaryActionLabel="Escanear Referência" 
                        onPrimaryAction={() => fileInputRef.current?.click()} 
                        partners={["PANTONE TCX", "VINGI GEN 4K", "CLO3D COMPATIBLE"]} 
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

const TechCard = ({ icon: Icon, title, desc, onClick }: any) => (
    <button onClick={onClick} className="group bg-[#0a0a0a] border border-white/10 p-10 rounded-[3rem] text-left hover:border-vingi-500 transition-all hover:bg-vingi-900/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity"><Icon size={120}/></div>
        <div className="bg-vingi-900/50 w-16 h-16 rounded-2xl flex items-center justify-center text-vingi-400 mb-6 group-hover:scale-110 transition-transform"><Icon size={32}/></div>
        <h3 className="text-2xl font-black uppercase tracking-tight mb-2 text-white">{title}</h3>
        <p className="text-gray-500 text-sm font-medium leading-relaxed mb-8">{desc}</p>
        <div className="flex items-center gap-2 text-vingi-400 text-xs font-black uppercase tracking-widest">Selecionar Tecnologia <ArrowRight size={14}/></div>
    </button>
);
