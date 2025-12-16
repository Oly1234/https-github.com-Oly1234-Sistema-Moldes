
/*
 * SYSTEM ARCHITECT: Rafael Rodrigues Alves de Olival
 * PROJECT: VINGI MOLDES AI
 * COPYRIGHT 2024 - ALL RIGHTS RESERVED
 */

import React from 'react';
import { ScanLine, Globe, Palette, Shirt, ArrowRight, History, Sparkles, Zap, MessageCircle, Layers, Camera } from 'lucide-react';
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
    delay?: string;
    stats?: string;
}> = ({ title, description, icon, colorClass, onClick, delay = "0ms", stats }) => (
    <div 
        onClick={onClick}
        className={`bg-white rounded-2xl p-6 border border-gray-100 shadow-lg shadow-gray-200/50 hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer group relative overflow-hidden animate-fade-in`}
        style={{ animationDelay: delay }}
    >
        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClass} opacity-10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110`} />
        
        <div className="relative z-10">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClass} text-white flex items-center justify-center mb-4 shadow-md group-hover:rotate-6 transition-transform`}>
                {icon}
            </div>
            
            <h3 className="text-lg font-bold text-gray-800 mb-1 group-hover:text-vingi-600 transition-colors flex items-center gap-2">
                {title} <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-gray-400"/>
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-4 min-h-[40px]">
                {description}
            </p>

            {stats && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <Zap size={10} className="fill-gray-400"/> {stats}
                </div>
            )}
        </div>
    </div>
);

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
    const handleContactClick = () => {
        const phone = "5519983569940";
        const text = encodeURIComponent("Olá Rafael, vi o sistema Vingi AI e gostaria de conhecer suas soluções de IA para minha empresa.");
        window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    };

    return (
        <div className="h-full bg-[#f8fafc] p-6 md:p-12 overflow-y-auto custom-scrollbar relative touch-pan-y">
            <div className="max-w-6xl mx-auto space-y-10 pb-24">
                
                {/* HERO SECTION */}
                <div className="text-center space-y-6 py-10 animate-fade-in flex flex-col items-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-vingi-900/5 rounded-full border border-vingi-900/10">
                        <Sparkles size={12} className="text-vingi-500" />
                        <span className="text-[10px] font-bold text-vingi-900 tracking-widest uppercase">Vingi AI Workflow 6.5</span>
                    </div>
                    
                    <h1 className="flex flex-col items-center justify-center leading-none">
                        <span className="text-3xl md:text-5xl font-extrabold text-gray-900 uppercase tracking-[0.2em] md:tracking-[0.3em] scale-y-90">
                            Engenharia
                        </span>
                        <span className="text-xl md:text-3xl text-gray-400 font-serif italic my-2 font-light">
                            de
                        </span>
                        <span className="text-6xl md:text-8xl font-serif font-medium text-transparent bg-clip-text bg-gradient-to-r from-vingi-800 via-vingi-600 to-purple-800 tracking-tighter drop-shadow-sm">
                            Moda
                        </span>
                    </h1>

                    <p className="text-gray-500 max-w-xl mx-auto text-sm md:text-lg font-light tracking-wide mt-4">
                        <span className="font-medium text-vingi-600">Assistida por Inteligência.</span> Do escaneamento do molde à simulação realista.
                    </p>
                    
                    <AIVoiceAgent onNavigate={onNavigate} />
                </div>

                {/* MODULES GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ModuleCard 
                        title="Caçador de Moldes"
                        description="Encontre onde comprar o molde exato de qualquer roupa via foto."
                        icon={<ScanLine size={24} />}
                        colorClass="from-blue-500 to-cyan-400"
                        onClick={() => onNavigate('SCANNER')}
                        delay="100ms"
                        stats="Engenharia Reversa"
                    />
                    
                    <ModuleCard 
                        title="Radar de Estampas"
                        description="Localize fornecedores de tecidos e arquivos digitais globais."
                        icon={<Globe size={24} />}
                        colorClass="from-purple-500 to-pink-400"
                        onClick={() => onNavigate('CREATOR')}
                        delay="200ms"
                        stats="Busca Global"
                    />

                    <ModuleCard 
                        title="Criação Ilimitada"
                        description="Gere estampas exclusivas para Cilindro (Rotativa) ou Digital 4K."
                        icon={<Palette size={24} />}
                        colorClass="from-amber-500 to-orange-400"
                        onClick={() => onNavigate('ATELIER')}
                        delay="300ms"
                        stats="Generative AI"
                    />

                    <ModuleCard 
                        title="Lab de Imagem"
                        description="Remova fundos, separe elementos e edite camadas complexas."
                        icon={<Layers size={24} />}
                        colorClass="from-indigo-500 to-violet-400"
                        onClick={() => onNavigate('LAYER_STUDIO')}
                        delay="350ms"
                        stats="Photoshop AI"
                    />

                    <ModuleCard 
                        title="Estúdio 2D"
                        description="A ferramenta técnica clássica de aplicação plana. Rápido e direto ao ponto."
                        icon={<Shirt size={24} />}
                        colorClass="from-gray-600 to-gray-400"
                        onClick={() => onNavigate('MOCKUP')}
                        delay="400ms"
                        stats="Aplicação Plana"
                    />

                    <ModuleCard 
                        title="Provador Mágico"
                        description="Veja sua coleção ganhar vida. Aplique estampas em modelos reais instantaneamente."
                        icon={<Camera size={24} />}
                        colorClass="from-emerald-500 to-teal-400"
                        onClick={() => onNavigate('RUNWAY')}
                        delay="450ms"
                        stats="Simulação 3D"
                    />
                </div>

                {/* FOOTER */}
                <div className="pt-6 border-t border-gray-200">
                    <div 
                        className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-6 text-white relative overflow-hidden group cursor-pointer flex flex-col md:flex-row items-center justify-between gap-4 shadow-md" 
                        onClick={() => onNavigate('HISTORY')}
                    >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl group-hover:bg-white/10 transition-colors pointer-events-none"></div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="bg-white/10 p-3 rounded-lg text-vingi-300"><History size={24}/></div>
                            <div className="text-left">
                                <h3 className="text-lg font-bold">Meus Projetos</h3>
                                <p className="text-gray-400 text-xs mt-0.5">Acesse seu histórico completo.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-300 group-hover:text-white transition-colors relative z-10">
                            <span>Acessar</span><ArrowRight size={14} />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
