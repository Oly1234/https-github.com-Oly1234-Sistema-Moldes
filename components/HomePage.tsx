
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
                
                {/* HERO SECTION - REDESIGNED FOR EDITORIAL LOOK */}
                <div className="text-center space-y-6 py-10 animate-fade-in flex flex-col items-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-vingi-900/5 rounded-full border border-vingi-900/10">
                        <Sparkles size={12} className="text-vingi-500" />
                        <span className="text-[10px] font-bold text-vingi-900 tracking-widest uppercase">Vingi AI Workflow 6.4</span>
                    </div>
                    
                    {/* TITULO ESTILIZADO */}
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
                        <span className="font-medium text-vingi-600">Assistida por Inteligência.</span> Um ecossistema completo para escanear roupas reais, encontrar moldes técnicos e criar estampas digitais.
                    </p>
                    
                    {/* NEW AI VOICE AGENT */}
                    <AIVoiceAgent onNavigate={onNavigate} />
                </div>

                {/* MODULES GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <ModuleCard 
                        title="Encontrar Moldes"
                        description="Tire uma foto de qualquer roupa e descubra onde comprar o molde de costura exato."
                        icon={<ScanLine size={24} />}
                        colorClass="from-blue-500 to-cyan-400"
                        onClick={() => onNavigate('SCANNER')}
                        delay="100ms"
                        stats="Engenharia Reversa"
                    />
                    
                    <ModuleCard 
                        title="Buscar Estampas"
                        description="Encontre fornecedores de tecidos ou arquivos digitais para estampas que você viu por aí."
                        icon={<Globe size={24} />}
                        colorClass="from-purple-500 to-pink-400"
                        onClick={() => onNavigate('CREATOR')}
                        delay="200ms"
                        stats="Busca Global"
                    />

                    <ModuleCard 
                        title="Criar Estampas"
                        description="Desenhe estampas exclusivas ou recrie arquivos em alta resolução usando Inteligência Artificial."
                        icon={<Palette size={24} />}
                        colorClass="from-amber-500 to-orange-400"
                        onClick={() => onNavigate('ATELIER')}
                        delay="300ms"
                        stats="Criação Neural"
                    />

                    <ModuleCard 
                        title="Editar & Separar"
                        description="Remova fundos, separe elementos e edite camadas das suas estampas automaticamente."
                        icon={<Layers size={24} />}
                        colorClass="from-indigo-500 to-violet-400"
                        onClick={() => onNavigate('LAYER_STUDIO')}
                        delay="350ms"
                        stats="Photoshop AI"
                    />

                    <ModuleCard 
                        title="Realism Studio"
                        description="Aplique suas estampas em modelos reais. A IA detecta dobras, luz e sombra para um resultado fotográfico."
                        icon={<Camera size={24} />}
                        colorClass="from-emerald-500 to-teal-400"
                        onClick={() => onNavigate('RUNWAY')}
                        delay="400ms"
                        stats="Simulação 4K"
                    />
                </div>

                {/* QUICK ACTIONS / FOOTER */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-200">
                    
                    {/* ACERVO PESSOAL (Compactado) */}
                    <div 
                        className="col-span-1 md:col-span-2 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-6 text-white relative overflow-hidden group cursor-pointer flex flex-col md:flex-row items-center justify-between gap-4 shadow-md" 
                        onClick={() => onNavigate('HISTORY')}
                    >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl group-hover:bg-white/10 transition-colors pointer-events-none"></div>
                        
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="bg-white/10 p-3 rounded-lg text-vingi-300">
                                <History size={24}/>
                            </div>
                            <div className="text-left">
                                <h3 className="text-lg font-bold">Acervo Pessoal</h3>
                                <p className="text-gray-400 text-xs mt-0.5">Histórico de escaneamentos e gerações.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-bold text-gray-300 group-hover:text-white transition-colors relative z-10">
                            <span>Acessar Biblioteca</span>
                            <ArrowRight size={14} />
                        </div>
                    </div>

                    {/* ASSINATURA / VERSÃO */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 flex flex-col justify-center items-center text-center shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sistema Vingi AI</span>
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded">v6.4</span>
                        </div>
                        
                        <div className="w-full h-px bg-gray-50 mb-3"></div>
                        
                        <div 
                            className="text-[10px] text-gray-400 font-mono flex flex-col items-center gap-1 cursor-pointer group"
                            onClick={handleContactClick}
                            title="Falar com Rafael Olival"
                        >
                            <span>Criado por <span className="text-gray-600 font-bold group-hover:text-vingi-600 transition-colors">Rafael Olival</span></span>
                            <span className="text-gray-300 text-[9px]">para Vingi Indústria Têxtil</span>
                            
                            <div className="mt-2 flex items-center gap-1.5 text-vingi-500 bg-vingi-50 px-3 py-1.5 rounded-full opacity-80 group-hover:opacity-100 transition-all transform group-hover:scale-105">
                                <MessageCircle size={10} />
                                <span className="font-bold">Quer um sistema assim?</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
