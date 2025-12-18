
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { HomePage } from './components/HomePage';
import { ScannerSystem } from './features/Scanner';
import { PatternCreator } from './features/Radar';
import { AtelierSystem } from './features/Atelier';
import { LayerStudio } from './features/LayerLab';
import { MockupStudio } from './features/Mockup';
import { VirtualRunway } from './features/Runway';
import { HistorySystem } from './features/History';
import { ViewState } from './types';
import { Check, Bot } from 'lucide-react';

const InstallGatekeeper: React.FC<{ onInstall: () => void, isIOS: boolean }> = ({ onInstall, isIOS }) => (
    <div className="fixed inset-0 bg-vingi-900 flex items-center justify-center text-white z-[999] p-6">
        <div className="text-center max-w-sm">
            <h1 className="text-3xl font-black mb-3 uppercase tracking-tighter">Instale o Vingi AI</h1>
            <p className="text-gray-400 mb-8 text-sm leading-relaxed">Suite completa de engenharia têxtil em um só lugar. Adicione à tela inicial.</p>
            <button onClick={onInstall} className="w-full px-8 py-5 bg-white text-vingi-900 rounded-3xl font-black shadow-2xl active:scale-95 transition-transform uppercase tracking-widest text-xs">Instalar Agora</button>
        </div>
    </div>
);

const ContextHUD: React.FC<{ message: string | null }> = ({ message }) => {
    if (!message) return null;
    return (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-slide-down pointer-events-none max-w-sm w-[90%] md:w-auto">
            <div className="bg-black/80 backdrop-blur-xl text-white px-5 py-4 rounded-2xl border border-green-500/30 shadow-2xl flex items-start gap-4">
                <div className="bg-green-500/20 p-2 rounded-full shrink-0">
                    <Check size={18} className="text-green-400"/>
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <Bot size={12} className="text-vingi-400"/>
                        <p className="text-[9px] uppercase font-black text-vingi-400 tracking-[0.2em]">VINGI AGENT</p>
                    </div>
                    <p className="text-xs font-bold text-gray-100">{message}</p>
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
      
      <main className="flex-1 md:ml-20 h-full relative flex flex-col min-h-0">
        <div className="flex-1 h-full w-full relative">
            <div style={{ display: view === 'HOME' ? 'flex' : 'none' }} className="w-full h-full scroll-container pb-20 md:pb-0">
                <HomePage onNavigate={handleNavigate} />
            </div>

            <div style={{ display: view === 'SCANNER' ? 'flex' : 'none' }} className="w-full h-full scroll-container pb-20 md:pb-0">
                <ScannerSystem />
            </div>
            
            <div style={{ display: view === 'CREATOR' ? 'flex' : 'none' }} className="w-full h-full scroll-container pb-20 md:pb-0">
                <PatternCreator />
            </div>

            <div style={{ display: view === 'ATELIER' ? 'flex' : 'none' }} className="w-full h-full scroll-container pb-20 md:pb-0">
                <AtelierSystem />
            </div>

            <div style={{ display: view === 'LAYER_STUDIO' ? 'flex' : 'none' }} className="w-full h-full scroll-container pb-20 md:pb-0">
                <LayerStudio 
                    onNavigateBack={() => handleNavigate('ATELIER')} 
                    onNavigateToMockup={() => handleNavigate('RUNWAY')}
                />
            </div>

            <div style={{ display: view === 'MOCKUP' ? 'flex' : 'none' }} className="w-full h-full scroll-container pb-20 md:pb-0">
                <MockupStudio />
            </div>

            <div style={{ display: view === 'RUNWAY' ? 'flex' : 'none' }} className="w-full h-full scroll-container pb-20 md:pb-0">
                <VirtualRunway />
            </div>

            <div style={{ display: view === 'HISTORY' ? 'flex' : 'none' }} className="w-full h-full scroll-container pb-20 md:pb-0">
                <HistorySystem />
            </div>
        </div>
      </main>
    </div>
  );
}
