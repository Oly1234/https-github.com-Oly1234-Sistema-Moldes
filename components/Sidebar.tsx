
import React from 'react';
import { LayoutDashboard, History, PenTool, Download, Palette, Brush } from 'lucide-react';
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
    <aside className="fixed bottom-0 left-0 w-full h-16 md:h-full md:w-20 bg-vingi-900 border-t md:border-t-0 md:border-r border-vingi-700 z-50 flex md:flex-col items-center justify-between py-2 md:py-6 px-4 md:px-0 transition-all shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
      
      {/* Desktop Brand */}
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
            tooltip="Scanner 3D"
          />
          <NavItem 
            icon={<Palette size={24} />} 
            active={currentView === 'CREATOR'} 
            onClick={() => onViewChange('CREATOR')}
            tooltip="Pattern Studio (Search)"
          />
          <NavItem 
            icon={<Brush size={24} />} 
            active={currentView === 'ATELIER'} 
            onClick={() => onViewChange('ATELIER')}
            tooltip="Atelier (Create)"
          />
          <NavItem 
            icon={<PenTool size={24} />} 
            active={currentView === 'MOCKUP'} 
            onClick={() => onViewChange('MOCKUP')}
            tooltip="Mockup Studio"
          />
          <NavItem 
            icon={<History size={24} />} 
            active={currentView === 'HISTORY'} 
            onClick={() => onViewChange('HISTORY')}
            tooltip="Histórico"
          />
        </nav>
      </div>

      {/* Mobile Nav */}
      <div className="flex md:hidden w-full justify-between items-center px-4">
          <NavItem 
            icon={<LayoutDashboard size={24} />} 
            active={currentView === 'HOME'} 
            onClick={() => onViewChange('HOME')}
            isMobile
          />
          <NavItem 
            icon={<Palette size={24} />} 
            active={currentView === 'CREATOR'} 
            onClick={() => onViewChange('CREATOR')}
            isMobile
          />
          <NavItem 
            icon={<Brush size={24} />} 
            active={currentView === 'ATELIER'} 
            onClick={() => onViewChange('ATELIER')}
            isMobile
          />
           <NavItem 
            icon={<PenTool size={24} />} 
            active={currentView === 'MOCKUP'} 
            onClick={() => onViewChange('MOCKUP')}
            isMobile
          />
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
