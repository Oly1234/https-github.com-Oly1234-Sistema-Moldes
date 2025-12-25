
import React, { useState, useEffect } from 'react';
import { History, Trash2, Cloud, ExternalLink } from 'lucide-react';
import { ScanHistoryItem } from '../types';

export const HistorySystem: React.FC = () => {
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

  useEffect(() => {
      const storedHistory = localStorage.getItem('vingi_scan_history');
      if (storedHistory) setHistory(JSON.parse(storedHistory));
  }, []);

  const clearHistory = () => {
      localStorage.removeItem('vingi_scan_history'); 
      setHistory([]);
  };

  const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/19UC2beAjjSn2s4ROtj6gp6VtKSpdoApR?usp=sharing";

  return (
      <div className="p-6 max-w-5xl mx-auto min-h-full animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <History size={28} className="text-vingi-600"/> Histórico
            </h2>
            <div className="flex gap-2">
                <button onClick={() => window.open(DRIVE_FOLDER_URL, '_blank')} className="text-blue-600 bg-blue-50 text-xs font-bold flex items-center gap-2 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors border border-blue-200">
                    <Cloud size={14}/> Biblioteca Nuvem
                </button>
                {history.length > 0 && (
                    <button onClick={clearHistory} className="text-red-500 text-xs font-bold flex items-center gap-1 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
                        <Trash2 size={14}/> Limpar
                    </button>
                )}
            </div>
          </div>

          {history.length === 0 ? (
              <div className="text-center text-gray-400 mt-20 p-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <History size={48} className="mx-auto mb-4 opacity-20"/>
                  <p>Sem histórico de escaneamento recente.</p>
                  <button onClick={() => window.open(DRIVE_FOLDER_URL, '_blank')} className="mt-4 text-blue-500 font-bold text-sm hover:underline flex items-center justify-center gap-1">
                      Ver arquivos salvos no Drive <ExternalLink size={12}/>
                  </button>
              </div>
          ) : (
              <div className="grid gap-4">
                  {history.map(item => (
                      <div key={item.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center hover:shadow-md transition-all">
                          <div>
                            <span className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">{new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString()}</span>
                            <h4 className="font-bold text-gray-800 text-lg">{item.patternName}</h4>
                            <p className="text-xs text-gray-500">{item.dnaSummary}</p>
                          </div>
                          <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded">{item.category}</span>
                      </div>
                  ))}
              </div>
          )}
      </div>
  );
};
