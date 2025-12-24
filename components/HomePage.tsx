
/*
 * SYSTEM ARCHITECT: Rafael Rodrigues Alves de Olival
 * PROJECT: VINGI MOLDES AI
 * COPYRIGHT 2024 - ALL RIGHTS RESERVED
 */

import React from 'react';
import { ScanLine, Globe, Palette, Shirt, ArrowRight, History, Sparkles, Zap, Layers, Camera, ArrowUpRight, Fingerprint, FileText, Cylinder } from 'lucide-react';
import { ViewState } from '../types';
import { AIVoiceAgent } from './AIVoiceAgent';

interface HomePageProps {
    onNavigate: (view: ViewState, contextMessage?: string) => void;
}

const ModuleCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    colorClass: string;
    onClick: () => void;
    stats?: string;
}> = ({ title, description, icon, colorClass, onClick, stats }) => (
    <div 
        onClick={onClick}
        className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-sm hover:shadow-md hover:border-vingi-300 transition-all cursor-pointer group relative overflow-hidden flex flex-col h-full active:scale-[0.98]"
    >
        {/* Subtle Decoration */}
        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colorClass} opacity-[0.07] rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-125 pointer-events-none`} />
        
        <div className="flex items-start justify-between mb-3 relative z-10">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClass} text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            <div className="flex items-center gap-1">
                {stats && (
                    <span className="text-[8px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-full uppercase tracking-wider border border-gray-100 hidden sm:inline-block">
                        {stats}
                    </span>
                )}
                <ArrowUpRight size={14} className="text-gray-300 group-hover:text-vingi-500 transition-colors" />
            </div>
        </div>
        
        <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2 group-hover:text-vingi-700 transition-colors">
            {title}
        </h3>
        
        <p className="text-xs text-gray-500 leading-relaxed font-medium line-clamp-2">
            {description}
        </p>
    </div>
);

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
    return (
        <div className="h-full bg-slate-50/50 p-4 md:p-8 overflow-y-auto custom-scrollbar relative touch-pan-y">
            <div className="max-w-5xl mx-auto space-y-5 pb-24">
                
                {/* COMPACT HERO SECTION */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 md:gap-12">
                    {/* Background Tech Mesh */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-vingi-50 to-transparent rounded-bl-full pointer-events-none opacity-60" />

                    {/* Text Content */}
                    <div className="text-center md:text-left z-10 flex-1">
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                            <div className="bg-vingi-900/5 p-1 rounded-md"><Sparkles size={12} className="text-vingi-600"/></div>
                            <span className="text-[10px] font-bold tracking-widest text-vingi-900 uppercase">Vingi OS 7.0</span>
                        </div>
                        <h1 className="text-2xl md:text-4xl font-black text-gray-900 leading-tight tracking-tight">
                            Engenharia <span className="text-transparent bg-clip-text bg-gradient-to-r from-vingi-700 to-purple-700">Têxtil AI</span>
                        </h1>
                        <p className="text-xs md:text-sm text-gray-500 mt-2 font-medium max-w-lg mx-auto md:mx-0">
                            Suite industrial completa: Reconhecimento de moldes, criação de estampas, engenharia de corte e documentação técnica avançada.
                        </p>
                    </div>

                    {/* Voice Agent Integrated */}
                    <div className="shrink-0 relative z-10 bg-white/50 rounded-full p-2 border border-white/50 shadow-sm backdrop-blur-sm">
                        <AIVoiceAgent onNavigate={onNavigate} />
                    </div>
                </div>

                {/* MODULES BENTO GRID */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 animate-fade-in">
                    <ModuleCard 
                        title="Caçador de Moldes"
                        description="Engenharia reversa de roupas via foto. Identifica silhueta e modelagem."
                        icon={<ScanLine size={20} />}
                        colorClass="from-blue-600 to-cyan-500"
                        onClick={() => onNavigate('SCANNER')}
                        stats="Scanner"
                    />
                    
                    <ModuleCard 
                        title="Radar Global"
                        description="Busca vetorial de estampas e texturas em acervos mundiais."
                        icon={<Globe size={20} />}
                        colorClass="from-purple-600 to-pink-500"
                        onClick={() => onNavigate('CREATOR')}
                        stats="Market"
                    />

                    <ModuleCard 
                        title="Estúdio de Criação"
                        description="Gerador de estampas Generative AI (Vetorial & Digital 4K)."
                        icon={<Palette size={20} />}
                        colorClass="from-amber-500 to-orange-500"
                        onClick={() => onNavigate('ATELIER')}
                        stats="Gen AI"
                    />

                    <ModuleCard 
                        title="Lab de Imagem"
                        description="Separação inteligente de elementos, remoção de fundo e inpainting."
                        icon={<Layers size={20} />}
                        colorClass="from-indigo-600 to-violet-500"
                        onClick={() => onNavigate('LAYER_STUDIO')}
                        stats="Editor"
                    />

                    <ModuleCard 
                        title="Color Lab"
                        description="Separação de cores para cilindros (rotativa) e fotolitos (K-Means AI)."
                        icon={<Cylinder size={20} />}
                        colorClass="from-cyan-600 to-blue-700"
                        onClick={() => onNavigate('COLOR_LAB')}
                        stats="Color Engine"
                    />

                    <ModuleCard 
                        title="Fichas Técnicas"
                        description="Documentação industrial Pro para tinturaria, estamparia e cozinha."
                        icon={<FileText size={20} />}
                        colorClass="from-slate-900 to-slate-700"
                        onClick={() => onNavigate('TECHNICAL_HUB')}
                        stats="Industrial"
                    />

                    <ModuleCard 
                        title="Aplicação Técnica"
                        description="Encaixe de arte em moldes de corte (2D) com controle de fio."
                        icon={<Shirt size={20} />}
                        colorClass="from-slate-600 to-slate-500"
                        onClick={() => onNavigate('MOCKUP')}
                        stats="Engenharia"
                    />

                    <ModuleCard 
                        title="Provador Mágico"
                        description="Simulação realista em modelos humanos com física de tecido."
                        icon={<Camera size={20} />}
                        colorClass="from-emerald-600 to-teal-500"
                        onClick={() => onNavigate('RUNWAY')}
                        stats="Simulador"
                    />
                </div>

                {/* FOOTER QUICK ACCESS */}
                <div 
                    onClick={() => onNavigate('HISTORY')}
                    className="bg-gradient-to-r from-gray-900 to-slate-800 rounded-xl p-4 text-white flex items-center justify-between cursor-pointer hover:shadow-lg transition-all group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none blur-2xl group-hover:bg-white/10 transition-colors"></div>
                    
                    <div className="flex items-center gap-4 z-10">
                        <div className="bg-white/10 p-2.5 rounded-lg text-gray-300 group-hover:text-white transition-colors">
                            <History size={20}/>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold">Meus Projetos</h3>
                            <p className="text-[10px] text-gray-400 font-medium">Histórico de scans e gerações</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pr-2 z-10">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors hidden sm:block">Acessar Banco de Dados</span>
                        <div className="bg-white/10 p-1.5 rounded-full group-hover:bg-white/20 transition-colors">
                            <ArrowRight size={14} className="text-white" />
                        </div>
                    </div>
                </div>

                {/* VERSION TAG */}
                <div className="text-center pt-4 opacity-30 flex items-center justify-center gap-2">
                    <Fingerprint size={12}/>
                    <span className="text-[9px] font-mono">VINGI SYSTEM ID: 294-X // BUILD 7.0.0</span>
                </div>

            </div>
        </div>
    );
};
