
import React, { useState, useEffect } from 'react';
import { ExternalLink, ArrowRightCircle } from 'lucide-react';
import { ExternalPatternMatch } from '../types';

// --- HELPERS INTERNOS DO CARD ---
const getBrandIcon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
const getBackupIcon = (domain: string) => `https://icons.duckduckgo.com/ip3/${domain}.ico`;
const getProxyUrl = (url: string) => `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&h=400&fit=cover&a=top&output=webp`;

export const generateSafeUrl = (match: ExternalPatternMatch): string => {
    let url = match?.url || '';
    const source = match?.source || 'Web';
    const patternName = match?.patternName || 'Sewing Pattern';
    
    // Limpeza de termos para busca
    const cleanSearchTerm = encodeURIComponent(patternName.replace(/ pattern| sewing| molde| vestido| dress| pdf| download/gi, '').trim());
    const fullSearchTerm = encodeURIComponent(patternName + ' sewing pattern');

    // Se é um link direto "genérico" ou SEARCH_QUERY, validamos
    if (match.linkType === 'SEARCH_QUERY' || !url.includes('/')) {
        // Confirma se a URL de busca está bem formada, senão recria
        if (!url.includes('=')) {
             if (source.toLowerCase().includes('etsy')) return `https://www.etsy.com/search?q=${fullSearchTerm}`;
             if (source.toLowerCase().includes('burda')) return `https://www.burdastyle.com/catalogsearch/result/?q=${cleanSearchTerm}`;
             if (source.toLowerCase().includes('vikisews')) return `https://vikisews.com/search/?q=${cleanSearchTerm}`;
             if (source.toLowerCase().includes('shutterstock')) return `https://www.shutterstock.com/search/${cleanSearchTerm}`;
             if (source.toLowerCase().includes('patternbank')) return `https://patternbank.com/search?q=${cleanSearchTerm}`;
             return `https://www.google.com/search?q=${fullSearchTerm}`;
        }
    }

    return url;
};

export const PatternVisualCard: React.FC<{ match: ExternalPatternMatch }> = ({ match }) => {
    if (!match) return null;

    const safeUrl = generateSafeUrl(match);
    
    // Se a IA já mandou uma imagem válida, usa. Senão null.
    const initialImage = (match.imageUrl && match.imageUrl.length > 10) ? match.imageUrl : null;
    const [displayImage, setDisplayImage] = useState<string | null>(initialImage);
    const [usingProxy, setUsingProxy] = useState(false);
    
    let domain = '';
    try { 
        if (safeUrl) domain = new URL(safeUrl).hostname; 
    } catch (e) { domain = 'google.com'; }
    
    const primaryIcon = getBrandIcon(domain);
    const backupIcon = getBackupIcon(domain);

    useEffect(() => {
        // Se já temos imagem inicial e não estamos usando proxy, exibe e para.
        if (initialImage && !usingProxy) {
            setDisplayImage(initialImage);
            return;
        }

        // Não tenta preview de páginas de busca genéricas do Google, pois bloqueiam scraping.
        // Mas TENTA para sites específicos de Patterns (Shutterstock, Etsy, etc).
        if (!safeUrl || safeUrl.includes('google.com/search')) return;

        let isMounted = true;
        
        // Delay randômico para não sobrecarregar em listas grandes
        const delay = Math.random() * 2000;

        const timer = setTimeout(() => {
            fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'GET_LINK_PREVIEW', targetUrl: safeUrl })
            })
            .then(res => res.json())
            .then(data => {
                if (isMounted && data.success && data.image) {
                    setDisplayImage(getProxyUrl(data.image));
                    setUsingProxy(true);
                }
            })
            .catch(() => {
                // Silently fail, keep generic icon
            });
        }, delay); 

        return () => { isMounted = false; clearTimeout(timer); };
    }, [safeUrl, initialImage]);

    const handleError = () => {
        if (displayImage !== primaryIcon && displayImage !== backupIcon) {
            setDisplayImage(primaryIcon);
        } else if (displayImage === primaryIcon) {
            setDisplayImage(backupIcon);
        }
    };

    const finalImage = displayImage || primaryIcon;
    const isBrandIcon = finalImage === primaryIcon || finalImage === backupIcon;
    const isPremium = match.type === 'PAGO' || match.type === 'PREMIUM' || match.type === 'ROYALTY-FREE';

    return (
        <div onClick={() => safeUrl && window.open(safeUrl, '_blank')} className="bg-white rounded-xl border border-gray-200 hover:shadow-xl cursor-pointer transition-all hover:-translate-y-1 group overflow-hidden flex flex-col h-full animate-fade-in relative">
            <div className={`overflow-hidden relative border-b border-gray-100 flex items-center justify-center ${isBrandIcon ? 'h-24 bg-gray-50 p-4' : 'h-48 bg-white'}`}>
                <img 
                    src={finalImage} 
                    alt={match.source || 'Source'} 
                    onError={handleError}
                    loading="lazy"
                    className={`transition-all duration-700 ${isBrandIcon ? 'w-16 h-16 object-contain mix-blend-multiply opacity-60 grayscale' : 'w-full h-full object-cover group-hover:scale-105'}`}
                />
                <div className="absolute top-2 right-2 z-20">
                    <ExternalLink size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 bg-white/80 p-0.5 rounded shadow-sm"/>
                </div>
            </div>

            <div className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate max-w-[70%]">{match.source || 'WEB'}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${isPremium ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                        {match.type || 'N/A'}
                    </span>
                </div>
                <h3 className="font-bold text-sm text-gray-800 line-clamp-2 leading-tight mb-2 flex-1 group-hover:text-vingi-600 transition-colors">
                    {match.patternName || 'Design Identificado'}
                </h3>
                <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-xs text-vingi-500 font-medium">
                    <span>Ver Original</span>
                    <ArrowRightCircle size={14} className="group-hover:translate-x-1 transition-transform"/>
                </div>
            </div>
        </div>
    );
};
