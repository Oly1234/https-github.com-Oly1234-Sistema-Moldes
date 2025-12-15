
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MockupStudio } from './components/MockupStudio'; 
import { PatternCreator } from './components/PatternCreator';
import { AtelierSystem } from './features/AtelierSystem';
import { ScannerSystem } from './features/ScannerSystem';
import { HistorySystem } from './features/HistorySystem';
import { ViewState } from './types';

// Componente para barrar navegadores não suportados (ex: webview dentro de app social)
const InstallGatekeeper: React.FC<{ onInstall: () => void, isIOS: boolean }> = ({ onInstall, isIOS }) => (
    <div className="fixed inset-0 bg-vingi-900 flex items-center justify-center text-white z-[999]">
        <div className="text-center p-6">
            <h1 className="text-2xl font-bold mb-2">Instale o Vingi AI</h1>
            <p className="text-gray-400 mb-6 text-sm">Acesso total à biblioteca de moldes</p>
            <button onClick={onInstall} className="px-8 py-3 bg-white text-vingi-900 rounded-xl font-bold shadow-xl active:scale-95 transition-transform">Instalar Agora</button>
        </div>
    </div>
);

export default function App() {
  const [view, setView] = useState<ViewState>('HOME'); 
  
  // PWA & Environment State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // --- AUTO-UPDATE & PWA LOGIC ---
  useEffect(() => {
    const APP_VERSION = '6.3-PERSISTENCE';
    const checkUpdate = async () => {
        try {
            const storedVersion = localStorage.getItem('vingi_app_version');
            if (storedVersion !== APP_VERSION) {
                if ('caches' in window) {
                   const names = await caches.keys();
                   await Promise.all(names.map(name => caches.delete(name)));
                }
                if ('serviceWorker' in navigator) {
                   const regs = await navigator.serviceWorker.getRegistrations();
                   for(let reg of regs) await reg.unregister();
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
      <Sidebar 
        currentView={view} 
        onViewChange={setView} 
        onInstallClick={handleInstallClick}
        showInstallButton={!!deferredPrompt && !isMobileBrowser}
      />
      
      {/* 
          LAYOUT MOBILE FIX:
          - 'md:ml-20': Margem esquerda no desktop para sidebar
          - 'pb-20 md:pb-0': Padding bottom no mobile para não cobrir conteúdo com a barra
          - 'h-full': Ocupa altura total
      */}
      <main className="flex-1 md:ml-20 h-full overflow-hidden relative touch-pan-y flex flex-col">
        {/* 
            PERSISTÊNCIA DE ESTADO:
            Usamos display:none. O container interno tem padding para mobile.
        */}
        <div style={{ display: view === 'HOME' ? 'flex' : 'none' }} className="w-full h-full flex-col pb-20 md:pb-0">
            <ScannerSystem />
        </div>
        
        <div style={{ display: view === 'CREATOR' ? 'flex' : 'none' }} className="w-full h-full flex-col pb-20 md:pb-0">
            <PatternCreator />
        </div>

        <div style={{ display: view === 'ATELIER' ? 'flex' : 'none' }} className="w-full h-full flex-col pb-20 md:pb-0">
            <AtelierSystem />
        </div>

        <div style={{ display: view === 'MOCKUP' ? 'flex' : 'none' }} className="w-full h-full flex-col pb-20 md:pb-0">
            <MockupStudio />
        </div>

        <div style={{ display: view === 'HISTORY' ? 'flex' : 'none' }} className="w-full h-full flex-col pb-20 md:pb-0 overflow-y-auto">
            <HistorySystem />
        </div>
      </main>
    </div>
  );
}
