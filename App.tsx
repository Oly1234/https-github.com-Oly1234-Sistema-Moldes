
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
import { ViewState } from './types';
import { Sparkles } from 'lucide-react';

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

// HUD Toast for Voice Commands
const ContextHUD: React.FC<{ message: string | null }> = ({ message }) => {
    if (!message) return null;
    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-slide-down-fade pointer-events-none w-[90%] md:w-auto">
            <div className="bg-black/80 backdrop-blur-md text-white px-6 py-4 rounded-2xl border border-white/20 shadow-2xl flex items-center gap-4">
                <div className="bg-vingi-500/20 p-2 rounded-full">
                    <Sparkles size={20} className="text-vingi-400 animate-pulse"/>
                </div>
                <div>
                    <p className="text-[10px] uppercase font-bold text-vingi-400 tracking-widest mb-0.5">Vingi Assistant</p>
                    <p className="text-sm font-medium leading-tight">{message}</p>
                </div>
            </div>
        </div>
    );
};

export default function App() {
  const [view, setView] = useState<ViewState>('HOME'); 
  const [hudMessage, setHudMessage] = useState<string | null>(null);
  
  // Navigation handler wrapper
  const handleNavigate = (newView: ViewState, message?: string) => {
      setView(newView);
      if (message) {
          setHudMessage(message);
          setTimeout(() => setHudMessage(null), 5000); // Hide after 5s
      }
  };

  // PWA & Environment State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // --- AUTO-UPDATE & PWA LOGIC ---
  useEffect(() => {
    const APP_VERSION = '6.4-WORKFLOW';
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
      <ContextHUD message={hudMessage} />
      
      <Sidebar 
        currentView={view} 
        onViewChange={(v) => handleNavigate(v)} 
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
            Removido 'flex-col' para evitar problemas de altura no mobile.
        */}
        
        {/* NEW HOME PAGE DASHBOARD */}
        <div style={{ display: view === 'HOME' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0">
            <HomePage onNavigate={handleNavigate} />
        </div>

        <div style={{ display: view === 'SCANNER' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0">
            <ScannerSystem />
        </div>
        
        <div style={{ display: view === 'CREATOR' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0">
            <PatternCreator onNavigateToAtelier={() => handleNavigate('ATELIER')} />
        </div>

        <div style={{ display: view === 'ATELIER' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0">
            <AtelierSystem 
                onNavigateToMockup={() => handleNavigate('MOCKUP')} 
                onNavigateToLayerStudio={() => handleNavigate('LAYER_STUDIO')}
            />
        </div>

        <div style={{ display: view === 'LAYER_STUDIO' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0">
            <LayerStudio 
                onNavigateBack={() => handleNavigate('ATELIER')} 
                onNavigateToMockup={() => handleNavigate('MOCKUP')}
            />
        </div>

        <div style={{ display: view === 'MOCKUP' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0">
            <MockupStudio />
        </div>

        <div style={{ display: view === 'HISTORY' ? 'block' : 'none' }} className="w-full h-full pb-20 md:pb-0 overflow-y-auto">
            <HistorySystem />
        </div>
      </main>
    </div>
  );
}
