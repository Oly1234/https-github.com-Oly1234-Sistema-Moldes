
import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, ArrowRightCircle, Search, ShoppingBag } from 'lucide-react';
import { ExternalPatternMatch } from '../types';

// --- HELPERS VISUAIS ---
const getBrandIcon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
// Proxy visual para garantir que imagens extraídas carreguem (evita bloqueio de hotlink no frontend)
const getProxyUrl = (url: string) => `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&h=400&fit=cover&a=top&output=webp`;

// Cache Simples em Memória para evitar re-requests na mesma sessão
const imgCache = new Map<string, string>();

export const PatternVisualCard: React.FC<{ match: ExternalPatternMatch }> = ({ match }) => {
    if (!match) return null;

    const safeUrl = match.url;
    const initialImage = (match.imageUrl && match.imageUrl.length > 10) ? match.imageUrl : null;
    
    const [displayImage, setDisplayImage] = useState<string | null>(initialImage);
    const [loading, setLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    
    let domain = '';
    try { if (safeUrl) domain = new URL(safeUrl).hostname; } catch (e) { domain = 'google.com'; }
    const primaryIcon = getBrandIcon(domain);

    // Observer para carregar a imagem apenas quando o card aparecer na tela
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); }
        }, { rootMargin: '100px' });
        if (cardRef.current) observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, []);

    // Scraping Trigger
    useEffect(() => {
        if (!isVisible || initialImage || !safeUrl) return;
        
        if (imgCache.has(safeUrl)) {
            setDisplayImage(getProxyUrl(imgCache.get(safeUrl)!));
            return;
        }

        setLoading(true);
        let active = true;

        const fetchScrapedImage = async () => {
            try {
                // Chama nosso "Python-in-Node" scraper
                const res = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'GET_LINK_PREVIEW', targetUrl: safeUrl })
                });
                const data = await res.json();
                
                if (active) {
                    if (data.success && data.image) {
                        imgCache.set(safeUrl, data.image);
                        setDisplayImage(getProxyUrl(data.image));
                    } else {
                        // Se falhar o scraping, fica com o ícone padrão (já definido no fallback do img tag)
                    }
                }
            } catch (e) {
                console.warn("Scraping fail:", e);
            } finally {
                if (active) setLoading(false);
            }
        };

        // Pequeno delay aleatório para evitar bombardear o backend
        const timeout = setTimeout(fetchScrapedImage, Math.random() * 800);
        return () => { active = false; clearTimeout(timeout); };
    }, [isVisible, safeUrl, initialImage]);

    return (
        <div ref={cardRef} onClick={() => safeUrl && window.open(safeUrl, '_blank')} className="bg-white rounded-xl border border-gray-200 hover:shadow-xl cursor-pointer transition-all hover:-translate-y-1 group overflow-hidden flex flex-col h-full animate-fade-in relative min-h-[260px]">
            <div className="overflow-hidden relative border-b border-gray-100 flex items-center justify-center h-48 bg-gray-50">
                {/* Loader Overlay */}
                {loading && (
                    <div className="absolute inset-0 bg-gray-100/50 flex items-center justify-center z-10 backdrop-blur-[1px]">
                        <div className="w-4 h-4 border-2 border-vingi-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
                
                {/* Imagem Principal ou Fallback para Ícone */}
                <img 
                    src={displayImage || primaryIcon} 
                    alt={match.source} 
                    onError={(e) => {
                        // Se a imagem extraída falhar ao carregar, volta para o ícone
                        e.currentTarget.src = primaryIcon;
                        e.currentTarget.classList.add('p-12', 'opacity-30', 'grayscale');
                        e.currentTarget.classList.remove('object-cover');
                        e.currentTarget.classList.add('object-contain');
                    }}
                    className={`transition-all duration-700 w-full h-full ${displayImage ? 'object-cover group-hover:scale-105' : 'object-contain p-12 opacity-30 grayscale mix-blend-multiply'}`}
                />
                
                {/* Badge de Busca */}
                <div className="absolute top-2 left-2 z-20">
                     {match.linkType === 'SEARCH_QUERY' ? (
                         <span className="bg-blue-600/90 text-white text-[9px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm backdrop-blur-sm"><Search size={8}/> BUSCA</span>
                     ) : (
                         <span className="bg-green-600/90 text-white text-[9px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm backdrop-blur-sm"><ShoppingBag size={8}/> PRODUTO</span>
                     )}
                </div>

                <div className="absolute top-2 right-2 z-20">
                    <ExternalLink size={14} className="text-gray-500 bg-white/90 p-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"/>
                </div>
            </div>

            <div className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate max-w-[70%]">{match.source}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-gray-100 bg-gray-50 text-gray-500 font-bold">
                        {match.type}
                    </span>
                </div>
                <h3 className="font-bold text-sm text-gray-800 line-clamp-2 leading-tight mb-2 flex-1 group-hover:text-vingi-600 transition-colors">
                    {match.patternName.replace('Busca: ', '')}
                </h3>
                <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-xs text-vingi-500 font-medium">
                    <span>Ver no site oficial</span>
                    <ArrowRightCircle size={14} className="group-hover:translate-x-1 transition-transform"/>
                </div>
            </div>
        </div>
    );
};
