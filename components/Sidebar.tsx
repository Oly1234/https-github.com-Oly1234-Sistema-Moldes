
import React from 'react';
import { LayoutDashboard, History, Sparkles, Download, Camera, Search, RefreshCw, Loader2, ScanLine, PenTool } from 'lucide-react';
import { ViewState, AppState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  appState: AppState;
  hasUploadedImage: boolean;
  onViewChange: (view: ViewState) => void;
  onInstallClick?: () => void;
  showInstallButton?: boolean;
  onFabClick?: () => void; // Ação dinâmica do botão principal
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  appState, 
  hasUploadedImage,
  onViewChange, 
  onInstallClick, 
  showInstallButton, 
  onFabClick 
}) => {

  // Lógica visual do botão central (FAB) - O "Cérebro" da navegação mobile
  const getFabContent = () => {
    // 1. Carregando
    if (appState === AppState.ANALYZING) {
      return {
        icon: <Loader2 size={24} className="text-white animate-spin" />,
        label: null,
        className: "bg-gray-800 border-gray-700 cursor-wait w-14 h-14 rounded-full"
      };
    }

    // 2. Resultado na tela -> Botão para Resetar
    if (appState === AppState.SUCCESS) {
      return {
        icon: <RefreshCw size={20} className="text-white" />,
        label: "NOVA BUSCA",
        className: "bg-gray-900 border-gray-700 w-auto px-6 h-12 rounded-full hover:bg-black shadow-xl shadow-black/50"
      };
    }

    // 3. Imagem Carregada -> Botão de Ação Principal (PESQUISAR)
    if (hasUploadedImage && appState === AppState.IDLE && currentView === 'HOME') {
      return {
        icon: <ScanLine size={20} className="text-white animate-pulse" />,
        label: "PESQUISAR",
        // Visual Premium: 100% Opaco com background sólido e sombra projetada
        // A classe ring-white cria separação visual clara contra conteúdo branco/cinza
        className: "bg-vingi-600 hover:bg-vingi-500 border-2 border-white shadow-xl shadow-vingi-900/50 w-auto px-8 h-14 rounded-full animate-bounce-subtle z-50 ring-4 ring-black/10 scale-105"
      };
    }

    // 4. Estado Inicial (Sem imagem) -> Botão Discreto de Câmera
    return {
      icon: <Camera size={24} className="text-white" />,
      label: null,
      className: "bg-vingi-900 border-2 border-vingi-700 shadow-xl shadow-black/40 w-16 h-16 rounded-full active:scale-95 hover:bg-vingi-800 transition-transform z-50"
    };
  };

  const fab = getFabContent();

  return (
    // Adicionado overflow-visible para permitir que o botão saia da caixa sem cortar
    <aside className="fixed bottom-0 left-0 w-full h-16 md:h-full md:w-20 bg-vingi-900 border-t md:border-t-0 md:border-r border-vingi-700 z-50 flex md:flex-col items-center justify-between py-2 md:py-6 px-4 md:px-0 transition-all overflow-visible shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
      
      {/* Brand Icon (Mobile Hidden / Desktop Top) */}
      <div className="hidden md:flex flex-col items-center gap-6">
        <div 
          className="w-10 h-10 bg-gradient-to-br from-vingi-500 to-vingi-accent rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 cursor-pointer hover:scale-105 transition-transform"
          onClick={() => onViewChange('HOME')}
        >
          <span className="text-white font-bold text-xl">V</span>
        </div>
        
        <nav className="flex flex-col gap-6 mt-8">
          <NavItem 
            icon={<LayoutDashboard size={24} />} 
            active={currentView === 'HOME'} 
            onClick={() => onViewChange('HOME')}
            tooltip="Análise de Moldes"
          />
          <NavItem 
            icon={<PenTool size={24} />} 
            active={currentView === 'MOCKUP'} 
            onClick={() => onViewChange('MOCKUP')}
            tooltip="Estúdio de Estampa"
          />
          <NavItem 
            icon={<History size={24} />} 
            active={currentView === 'HISTORY'} 
            onClick={() => onViewChange('HISTORY')}
            tooltip="Histórico"
          />
        </nav>
      </div>

      {/* Mobile Nav (Horizontal) */}
      <div className="flex md:hidden w-full justify-between items-center px-8 relative">
          
          {/* Esquerda - Home */}
          <NavItem 
            icon={<LayoutDashboard size={24} />} 
            active={currentView === 'HOME'} 
            onClick={() => onViewChange('HOME')}
            isMobile
          />
           <NavItem 
            icon={<PenTool size={24} />} 
            active={currentView === 'MOCKUP'} 
            onClick={() => onViewChange('MOCKUP')}
            isMobile
          />
          
          {/* BOTÃO CENTRAL MUTANTE (FAB) - Ocultar no modo Mockup para dar espaço */}
          {currentView !== 'MOCKUP' && (
            <div className="absolute left-1/2 -translate-x-1/2 top-[-32px] z-[60]">
                <button 
                onClick={onFabClick}
                disabled={appState === AppState.ANALYZING}
                className={`flex items-center justify-center gap-2 transition-all duration-300 ease-out transform ${fab.className}`}
                style={{ minWidth: fab.label ? '140px' : '64px' }} 
                >
                {fab.icon}
                {fab.label && (
                    <span className="text-white font-bold text-sm tracking-wide whitespace-nowrap animate-fade-in">
                    {fab.label}
                    </span>
                )}
                </button>
            </div>
          )}

          {/* Direita - Histórico */}
          <NavItem 
            icon={<History size={24} />} 
            active={currentView === 'HISTORY'} 
            onClick={() => onViewChange('HISTORY')}
            isMobile
          />
      </div>

      {/* Bottom Actions (Desktop) */}
      <div className="hidden md:flex flex-col gap-6">
        {showInstallButton && (
          <button 
            onClick={onInstallClick}
            className="p-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all animate-pulse"
            title="Instalar App"
          >
            <Download size={20} />
          </button>
        )}
      </div>
    </aside>
  );
};

const NavItem: React.FC<{ 
  icon: React.ReactNode; 
  active?: boolean; 
  onClick: () => void;
  tooltip?: string;
  isMobile?: boolean;
}> = ({ icon, active, onClick, tooltip, isMobile }) => (
  <button 
    onClick={onClick}
    title={tooltip}
    className={`p-3 rounded-xl transition-all duration-300 group relative ${
      active 
        ? 'text-vingi-400 bg-vingi-800/50 shadow-inner' 
        : 'text-slate-500 hover:text-slate-300 hover:bg-vingi-800/30'
    } ${isMobile ? 'active:scale-95' : ''}`}
  >
    {icon}
    {active && !isMobile && (
      <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-vingi-400 rounded-l-full translate-x-3" />
    )}
  </button>
);
