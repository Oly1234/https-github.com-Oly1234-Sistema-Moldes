
import React, { useState, useEffect } from 'react';
import { ExternalLink, ArrowRightCircle } from 'lucide-react';
import { ExternalPatternMatch } from '../types';

// --- HELPERS INTERNOS DO CARD ---
// Tenta Google Favicons primeiro, se falhar, o onError vai tentar fallback ou imagem padrão
const getBrandIcon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
const getBackupIcon = (domain: string) => `https://icons.duckduckgo.com/ip3/${domain}.ico`;

// Proxy de Imagem Gratuito e Rápido (wsrv.nl)
const getProxyUrl = (url: string) => `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&h=400&fit=cover&a=top&output=webp`;

export const generateSafeUrl = (match: ExternalPatternMatch): string => {
    const url = match?.url || '';
    const source = match?.source || 'Web';
    const patternName = match?.patternName || 'Sewing Pattern';

    const cleanSearchTerm = encodeURIComponent(patternName.replace(/ pattern| sewing| molde| vestido| dress| pdf| download/gi, '').trim());
    const fullSearchTerm = encodeURIComponent(patternName + ' sewing pattern');

    const lowerUrl = url.toLowerCase();
    const lowerSource = source.toLowerCase();

    if (lowerSource.includes('etsy') || lowerUrl.includes('etsy.com')) {
        if (lowerUrl.includes('/search')) return url;
        return `https://www.etsy.com/search?q=${fullSearchTerm}&explicit=1&ship_to=BR`;
    }
    if (lowerSource.includes('burda') || lowerUrl.includes('burdastyle')) {
         if (lowerUrl.includes('catalogsearch')) return url;
        return `https://www.burdastyle.com/catalogsearch/result/?q=${cleanSearchTerm}`;
    }
    return url;
};

export const PatternVisualCard: React.FC<{ match: ExternalPatternMatch }> = ({ match }) => {
    if (!match) return null;

    const safeUrl = generateSafeUrl(match);
    
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
        if (initialImage && !usingProxy) {
            setDisplayImage(initialImage);
            return;
        }

        if (!safeUrl || safeUrl.includes('/search') || safeUrl.includes('google.com')) return;

        let isMounted = true;
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
        .catch(() => {});

        return () => { isMounted = false; };
    }, [safeUrl, initialImage]);

    const handleError = () => {
        // Se a imagem atual (seja produto ou favicon primário) falhar
        if (displayImage !== primaryIcon && displayImage !== backupIcon) {
            // Tenta o ícone primário (Google)
            setDisplayImage(primaryIcon);
        } else if (displayImage === primaryIcon) {
            // Se o Google falhou, tenta backup (DuckDuckGo)
            setDisplayImage(backupIcon);
        }
        // Se ambos falharem, o browser mostra ícone quebrado (aceitável)
    };

    const finalImage = displayImage || primaryIcon;
    const isBrandIcon = finalImage === primaryIcon || finalImage === backupIcon;
    const isPremium = match.type === 'PAGO' || match.type === 'PREMIUM';

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
                    {match.patternName || 'Molde Identificado'}
                </h3>
                <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-xs text-vingi-500 font-medium">
                    <span>Ver Molde</span>
                    <ArrowRightCircle size={14} className="group-hover:translate-x-1 transition-transform"/>
                </div>
            </div>
        </div>
    );
};
