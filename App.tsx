
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MockupStudio } from './components/MockupStudio'; 
import { PatternCreator } from './components/PatternCreator';
import { AtelierSystem } from './features/AtelierSystem';
import { ScannerSystem } from './features/ScannerSystem';
import { HistorySystem } from './features/HistorySystem';
import { HomePage } from './components/HomePage';
import { LayerStudio } from './components/LayerStudio';
import { VirtualRunway } from './features/VirtualRunway';
import { ViewState } from './types';
import { Check, Bot } from 'lucide-react';

const InstallGatekeeper: React.FC<{ onInstall: () => void, isIOS: boolean }> = ({ onInstall, isIOS }) => (
    <div className="fixed inset-0 bg-vingi-900 flex items-center justify-center text-white z-[999] p-6">
        <div className="text-center max-w-sm">
            <h1 className="text-2xl font-black mb-4 uppercase tracking-tighter">Instale o Vingi AI</h1>
            <p className="text-gray-400 mb-8 text-sm leading-relaxed">Suite completa de engenharia têxtil otimizada para o seu dispositivo.</p>
            <button onClick={onInstall} className="w-full px-8 py-4 bg-white text-vingi-900 rounded-2xl font-black shadow-xl active:scale-95 transition-transform uppercase tracking-widest text-xs">Instalar Agora</button>
        </div>
    </div>
);

const ContextHUD: React.FC<{ message: string | null }> = ({ message }) => {
    if (!message) return null;
    return (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-slide-down pointer-events-none max-w-sm w-[90%] md:w-auto">
            <div className="bg-black/90 backdrop-blur-xl text-white px-5 py-4 rounded-2xl border border-green-500/30 shadow-2xl flex items-start gap-4">
                <div className="bg-green-500/20 p-2 rounded-full border border-green-500/30 shrink-0">
                    <Check size={18} className="text-green-400"/>
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <Bot size={12} className="text-vingi-400"/>
                        <p className="text-[9px] uppercase font-black text-vingi-400 tracking-[0.2em]">VINGI AGENT</p>
                    </div>
                    <p className="text-xs font-bold leading-snug text-gray-100">{message}</p>
                </div>
            </div>
        </div>
    );
};

export default function App() {
  const [view, setView] = useState<ViewState>('HOME'); 
  const [hudMessage, setHudMessage] = useState<string | null>(null);
  
  const handleNavigate = (newView: ViewState, message?: string) => {
      setView(newView);
      if (message) {
          setHudMessage(message);
          setTimeout(() => setHudMessage(null), 4000);
      }
  };

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const mobile = /iphone|ipad|ipod|android/i.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsMobileBrowser(mobile && !isStandalone);
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    
    const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsMobileBrowser(false);
      setDeferredPrompt(null);
  };

  if (isMobileBrowser) return <InstallGatekeeper onInstall={handleInstallClick} isIOS={isIOS} />;

  return (
    <div className="flex h-[100dvh] w-full bg-[#f8fafc] overflow-hidden fixed inset-0">
      <ContextHUD message={hudMessage} />
      
      <Sidebar 
        currentView={view} 
        onViewChange={(v) => handleNavigate(v)} 
        onInstallClick={handleInstallClick}
        showInstallButton={!!deferredPrompt && !isMobileBrowser}
      />
      
      <main className="flex-1 md:ml-20 h-full relative overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 h-full w-full relative">
            
            {/* VIEW ROUTING COM SCROLL INDEPENDENTE */}
            <div style={{ display: view === 'HOME' ? 'block' : 'none' }} className="w-full h-full view-scroll-container pb-20 md:pb-0">
                <HomePage onNavigate={handleNavigate} />
            </div>

            <div style={{ display: view === 'SCANNER' ? 'block' : 'none' }} className="w-full h-full view-scroll-container pb-20 md:pb-0">
                <ScannerSystem />
            </div>
            
            <div style={{ display: view === 'CREATOR' ? 'block' : 'none' }} className="w-full h-full view-scroll-container pb-20 md:pb-0">
                <PatternCreator onNavigateToAtelier={() => handleNavigate('ATELIER')} />
            </div>

            <div style={{ display: view === 'ATELIER' ? 'block' : 'none' }} className="w-full h-full view-scroll-container pb-20 md:pb-0">
                <AtelierSystem 
                    onNavigateToMockup={() => handleNavigate('RUNWAY')} 
                    onNavigateToLayerStudio={() => handleNavigate('LAYER_STUDIO')}
                />
            </div>

            <div style={{ display: view === 'LAYER_STUDIO' ? 'block' : 'none' }} className="w-full h-full view-scroll-container pb-20 md:pb-0">
                <LayerStudio 
                    onNavigateBack={() => handleNavigate('ATELIER')} 
                    onNavigateToMockup={() => handleNavigate('RUNWAY')}
                />
            </div>

            <div style={{ display: view === 'MOCKUP' ? 'block' : 'none' }} className="w-full h-full view-scroll-container pb-20 md:pb-0">
                <MockupStudio />
            </div>

            <div style={{ display: view === 'RUNWAY' ? 'block' : 'none' }} className="w-full h-full view-scroll-container pb-20 md:pb-0">
                <VirtualRunway onNavigateToCreator={() => handleNavigate('CREATOR')} />
            </div>

            <div style={{ display: view === 'HISTORY' ? 'block' : 'none' }} className="w-full h-full view-scroll-container pb-20 md:pb-0">
                <HistorySystem />
            </div>
        </div>
      </main>
    </div>
  );
}
