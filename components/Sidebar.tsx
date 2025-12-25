
import React from 'react';
import { ScanLine, History, Shirt, Globe, Palette, LayoutGrid, Layers, Camera, Scissors, FileText, Cylinder } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  onInstallClick?: () => void;
  showInstallButton?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onViewChange, 
  onInstallClick, 
  showInstallButton 
}) => {
  return (
    <aside className="fixed bottom-0 left-0 w-full h-16 md:h-full md:w-20 bg-vingi-900 border-t md:border-t-0 md:border-r border-vingi-700 z-[999] flex md:flex-col items-center transition-all shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
      
      {/* --- DESKTOP LAYOUT --- */}
      
      {/* 1. Brand (Fixed Top) */}
      <div className="hidden md:flex flex-col items-center pt-6 pb-4 shrink-0 w-full bg-vingi-900 z-20">
        <div 
          className="w-10 h-10 bg-gradient-to-br from-vingi-500 to-vingi-accent rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 cursor-pointer hover:scale-105 transition-transform"
          onClick={() => onViewChange('HOME')}
          title="Dashboard"
        >
          <span className="text-white font-bold text-xl">V</span>
        </div>
      </div>
      
      {/* 2. Navigation (Scrollable Middle) */}
      <nav className="hidden md:flex flex-col gap-3 w-full items-center flex-1 overflow-y-auto no-scrollbar py-2 md:px-0">
         <NavItem 
          icon={<LayoutGrid size={22} />} 
          active={currentView === 'HOME'} 
          onClick={() => onViewChange('HOME')}
          tooltip="Início"
        />

        <div className="w-8 h-[1px] bg-vingi-800 my-1 shrink-0"></div>

        <NavItem 
          icon={<ScanLine size={22} />} 
          active={currentView === 'SCANNER'} 
          onClick={() => onViewChange('SCANNER')}
          tooltip="Caçador de Moldes"
        />
        <NavItem 
          icon={<Globe size={22} />} 
          active={currentView === 'CREATOR'} 
          onClick={() => onViewChange('CREATOR')}
          tooltip="Radar de Estampas"
        />
        <NavItem 
          icon={<Palette size={22} />} 
          active={currentView === 'ATELIER'} 
          onClick={() => onViewChange('ATELIER')}
          tooltip="Estúdio de Criação"
        />
         <NavItem 
          icon={<Layers size={22} />} 
          active={currentView === 'LAYER_STUDIO'} 
          onClick={() => onViewChange('LAYER_STUDIO')}
          tooltip="Lab de Imagem"
        />
        <NavItem 
          icon={<Cylinder size={22} />} 
          active={currentView === 'COLOR_LAB'} 
          onClick={() => onViewChange('COLOR_LAB')}
          tooltip="Separação de Cores"
        />
        <NavItem 
          icon={<FileText size={22} />} 
          active={currentView === 'TECHNICAL_HUB'} 
          onClick={() => onViewChange('TECHNICAL_HUB')}
          tooltip="Fichas Técnicas"
        />
        
        <div className="w-8 h-[1px] bg-vingi-800 my-1 shrink-0"></div>

        <NavItem 
          icon={<Shirt size={22} />} 
          active={currentView === 'MOCKUP'} 
          onClick={() => onViewChange('MOCKUP')}
          tooltip="Aplicação Técnica"
        />
        <NavItem 
          icon={<Camera size={22} />} 
          active={currentView === 'RUNWAY'} 
          onClick={() => onViewChange('RUNWAY')}
          tooltip="Provador Mágico"
        />
        
        <div className="w-8 h-[1px] bg-vingi-800 my-1 shrink-0"></div>

        <NavItem 
          icon={<History size={22} />} 
          active={currentView === 'HISTORY'} 
          onClick={() => onViewChange('HISTORY')}
          tooltip="Meus Projetos"
        />
        
        {/* Spacer to prevent cut-off at bottom scroll */}
        <div className="h-6 shrink-0"></div>
      </nav>

      {/* 3. Actions (Fixed Bottom) */}
      <div className="hidden md:flex flex-col gap-4 pb-6 pt-2 shrink-0 w-full items-center bg-vingi-900 z-20 border-t border-vingi-800/50">
        {showInstallButton && (
          <button 
            onClick={onInstallClick}
            className="p-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all animate-pulse"
            title="Instalar App"
          >
            <React.Fragment>↓</React.Fragment>
          </button>
        )}
      </div>

      {/* --- MOBILE LAYOUT (Horizontal Scroll) --- */}
      <div className="flex md:hidden w-full h-full items-center justify-start overflow-x-auto no-scrollbar gap-1 px-2 touch-pan-x">
          <NavItem icon={<LayoutGrid size={20} />} active={currentView === 'HOME'} onClick={() => onViewChange('HOME')} isMobile />
          
          <div className="w-[1px] h-6 bg-vingi-800 flex-shrink-0 mx-1"></div>
          
          <NavItem icon={<ScanLine size={20} />} active={currentView === 'SCANNER'} onClick={() => onViewChange('SCANNER')} isMobile />
          <NavItem icon={<Globe size={20} />} active={currentView === 'CREATOR'} onClick={() => onViewChange('CREATOR')} isMobile />
          <NavItem icon={<Palette size={20} />} active={currentView === 'ATELIER'} onClick={() => onViewChange('ATELIER')} isMobile />
          <NavItem icon={<Layers size={20} />} active={currentView === 'LAYER_STUDIO'} onClick={() => onViewChange('LAYER_STUDIO')} isMobile />
          <NavItem icon={<Cylinder size={20} />} active={currentView === 'COLOR_LAB'} onClick={() => onViewChange('COLOR_LAB')} isMobile />
          <NavItem icon={<FileText size={20} />} active={currentView === 'TECHNICAL_HUB'} onClick={() => onViewChange('TECHNICAL_HUB')} isMobile />
          
          <div className="w-[1px] h-6 bg-vingi-800 flex-shrink-0 mx-1"></div>
          
          <NavItem icon={<Shirt size={20} />} active={currentView === 'MOCKUP'} onClick={() => onViewChange('MOCKUP')} isMobile />
          <NavItem icon={<Camera size={20} />} active={currentView === 'RUNWAY'} onClick={() => onViewChange('RUNWAY')} isMobile />
          
          <div className="w-[1px] h-6 bg-vingi-800 flex-shrink-0 mx-1"></div>
          
          <NavItem icon={<History size={20} />} active={currentView === 'HISTORY'} onClick={() => onViewChange('HISTORY')} isMobile />
          
          {/* Spacer for right edge scrolling */}
          <div className="w-2 shrink-0"></div>
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
    className={`p-2.5 md:p-3 rounded-xl transition-all duration-300 group relative flex-shrink-0 flex items-center justify-center ${
      active 
        ? 'text-vingi-400 bg-vingi-800/50 shadow-inner' 
        : 'text-slate-500 hover:text-slate-300 hover:bg-vingi-800/30'
    } ${isMobile ? 'active:scale-95 min-w-[44px]' : 'hover:scale-105'}`}
  >
    {icon}
    {active && !isMobile && (
      <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-vingi-400 rounded-l-full translate-x-3" />
    )}
  </button>
);
