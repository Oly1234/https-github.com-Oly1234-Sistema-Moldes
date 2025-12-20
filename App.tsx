
/*
 * DEVELOPER: Rafael Rodrigues Alves de Olival
 * CONTACT: +55 19 98356-9940
 * FOR: Vingi Indústria Têxtil
 */

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
import { TechnicalHub } from './features/TechnicalHub'; 
import { ViewState } from './types';
import { Sparkles, Check, Bot } from 'lucide-react';

const InstallGatekeeper: React.FC<{ onInstall: () => void, isIOS: boolean }> = ({ onInstall, isIOS }) => (
    <div className="fixed inset-0 bg-vingi-900 flex items-center justify-center text-white z-[999]">
        <div className="text-center p-6">
            <h1 className="text-2xl font-bold mb-2">Instale o Vingi AI</h1>
            <p className="text-gray-400 mb-6 text-sm">Acesso total à biblioteca de moldes</p>
            <button onClick={onInstall} className="px-8 py-3 bg-white text-vingi-900 rounded-xl font-bold shadow-xl active:scale-95 transition-transform">Instalar Agora</button>
        </div>
    </div>
);

const ContextHUD: React.FC<{ message: string | null }> = ({ message }) => {
    if (!message) return null;
    return (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-slide-down-fade pointer-events-none max-w-sm w-[90%] md:w-auto">
            <div className="bg-black/80 backdrop-blur-xl text-white px-5 py-4 rounded-2xl border border-green-500/30 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-start gap-4">
                <div className="bg-green-500/20 p-2.5 rounded-full border border-green-500/30 shrink-0">
                    <Check size={20} className="text-green-400 animate-pulse"/>
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <Bot size={12} className="text-vingi-400"/>
                        <p className="text-[10px] uppercase font-bold text-vingi-400 tracking-widest">VINGI AGENT</p>
                    </div>
                    <p className="text-sm font-medium leading-snug text-gray-100">{message}</p>
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
    const APP_VERSION = '7.0-TECH-HUB';
    const checkUpdate = async () => {
        try {
            const storedVersion = localStorage.getItem('vingi_app_version');
            if (storedVersion !== APP_VERSION) {
                if ('caches' in window) {
                   const names = await caches.keys();
                   await Promise.all(names.map(name => caches.delete(name)));
                }
                localStorage.setItem('vingi_app_version', APP_VERSION);
                window.location.reload();
            }
        } catch (e) {}
    };
    setTimeout(checkUpdate, 1000);

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
    <div className="flex h-[100dvh] w-full bg-[#f8fafc] text-gray-800 font-sans overflow-hidden fixed inset-0">
      <ContextHUD message={hudMessage} />
      
      <Sidebar 
        currentView={view} 
        onViewChange={(v) => handleNavigate(v)} 
        onInstallClick={handleInstallClick}
        showInstallButton={!!deferredPrompt && !isMobileBrowser}
      />
      
      <main className="flex-1 md:ml-20 h-full overflow-hidden relative touch-pan-y flex flex-col">
        <div style={{ display: view === 'HOME' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0"><HomePage onNavigate={handleNavigate} /></div>
        <div style={{ display: view === 'SCANNER' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0"><ScannerSystem /></div>
        <div style={{ display: view === 'CREATOR' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0"><PatternCreator onNavigateToAtelier={() => handleNavigate('ATELIER')} /></div>
        <div style={{ display: view === 'ATELIER' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0"><AtelierSystem onNavigateToMockup={() => handleNavigate('RUNWAY')} onNavigateToLayerStudio={() => handleNavigate('LAYER_STUDIO')}/></div>
        <div style={{ display: view === 'LAYER_STUDIO' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0"><LayerStudio onNavigateBack={() => handleNavigate('ATELIER')} onNavigateToMockup={() => handleNavigate('RUNWAY')}/></div>
        <div style={{ display: view === 'TECHNICAL_HUB' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0"><TechnicalHub /></div>
        <div style={{ display: view === 'MOCKUP' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0"><MockupStudio /></div>
        <div style={{ display: view === 'RUNWAY' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0"><VirtualRunway onNavigateToCreator={() => handleNavigate('CREATOR')}/></div>
        <div style={{ display: view === 'HISTORY' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0 overflow-y-auto"><HistorySystem /></div>
      </main>
    </div>
  );
}
