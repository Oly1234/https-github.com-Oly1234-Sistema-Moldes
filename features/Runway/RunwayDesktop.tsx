
import React from 'react';
import { Camera, Search, Loader2, Play } from 'lucide-react';
import { SmartImageViewer } from '../../components/Shared';

interface RunwayProps {
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    isSearching: boolean;
    whiteBases: string[];
    onSearch: () => void;
    onSelectBase: (u: string) => void;
}

export const RunwayDesktop: React.FC<RunwayProps> = (props) => {
    return (
        <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar">
            <div className="p-12 max-w-[1400px] mx-auto w-full space-y-12">
                <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-gray-100 flex flex-col items-center text-center gap-8">
                    <div className="w-20 h-20 bg-vingi-900 rounded-3xl flex items-center justify-center text-white shadow-xl"><Camera size={40}/></div>
                    <div className="max-w-2xl">
                        <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tight mb-4">Provador Mágico AI</h2>
                        <p className="text-gray-500 font-medium">Busque um modelo humano em fundo branco (vestido, camiseta, calça) para aplicarmos sua estampa com inteligência de profundidade.</p>
                    </div>
                    <div className="flex w-full max-w-3xl gap-4 bg-gray-50 p-3 rounded-3xl border border-gray-100">
                        <input 
                            type="text" 
                            value={props.searchQuery} 
                            onChange={e => props.setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && props.onSearch()}
                            placeholder="Ex: Modelo usando vestido longo branco..." 
                            className="flex-1 bg-transparent px-6 py-4 font-bold text-lg outline-none text-gray-800"
                        />
                        <button onClick={props.onSearch} disabled={props.isSearching} className="bg-vingi-900 text-white px-12 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-3">
                            {props.isSearching ? <Loader2 className="animate-spin"/> : <Search size={20}/>} Buscar
                        </button>
                    </div>
                </div>

                {props.whiteBases.length > 0 && (
                    <div className="grid grid-cols-4 gap-8 animate-fade-in pb-24">
                        {props.whiteBases.map((u, i) => (
                            <div key={i} onClick={() => props.onSelectBase(u)} className="group cursor-pointer space-y-4">
                                <div className="aspect-[3/4] rounded-[2.5rem] overflow-hidden bg-white shadow-lg border-4 border-white transition-all group-hover:shadow-2xl group-hover:scale-[1.02] relative">
                                    <img src={u} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-vingi-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-vingi-900 shadow-2xl"><Play size={24} fill="currentColor" className="ml-1"/></div>
                                    </div>
                                </div>
                                <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Base detectada #{i+1}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
