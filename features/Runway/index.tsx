
import React from 'react';
import { Camera } from 'lucide-react';
import { useDevice } from '../../hooks/useDevice';
import { RunwayDesktop } from './RunwayDesktop';
import { useRunwayStore } from './useRunwayStore';

export const VirtualRunway: React.FC = () => {
    const { isMobile } = useDevice();
    const store = useRunwayStore();

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden relative">
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-50 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-vingi-900 p-2 rounded-lg text-white shadow-lg"><Camera size={18}/></div>
                    <span className="font-black text-sm uppercase tracking-widest text-gray-900">Virtual Runway Pro</span>
                </div>
                {store.selectedBase && (
                    <button onClick={store.reset} className="text-[10px] font-black uppercase text-gray-500 hover:text-white transition-colors">Nova Simulação</button>
                )}
            </header>

            {!store.selectedBase ? (
                <div className="flex-1">
                    {isMobile ? (
                        <div className="p-12 text-center font-black uppercase text-gray-400">Layout Mobile do Runway em carregamento...</div>
                    ) : (
                        <RunwayDesktop 
                            searchQuery={store.searchQuery}
                            setSearchQuery={store.setSearchQuery}
                            isSearching={store.isSearching}
                            whiteBases={store.whiteBases}
                            onSearch={store.handleSearch}
                            onSelectBase={store.setSelectedBase}
                        />
                    )}
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center bg-black">
                     <div className="p-12 text-center">
                        <img src={store.selectedBase} className="max-h-[70vh] rounded-3xl shadow-2xl mb-8" />
                        <div className="flex gap-4 justify-center">
                            <button onClick={store.reset} className="px-8 py-3 bg-white text-black rounded-xl font-black uppercase text-xs tracking-widest">Trocar Modelo</button>
                        </div>
                     </div>
                </div>
            )}
        </div>
    );
};
