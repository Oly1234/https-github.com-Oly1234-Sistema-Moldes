
import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, ArrowRightCircle, ImageOff } from 'lucide-react';
import { ExternalPatternMatch } from '../types';

// --- HELPERS ---
const getBrandIcon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
const getBackupIcon = (domain: string) => `https://icons.duckduckgo.com/ip3/${domain}.ico`;
const getProxyUrl = (url: string) => `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&h=400&fit=cover&a=top&output=webp`;

// Cache Local (Persistente)
const getCachedImage = (url: string) => {
    try {
        const key = `vingi_img_cache_${btoa(url).substring(0, 32)}`;
        const cached = localStorage.getItem(key);
        if (cached) {
            const { img, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 86400000) return img;
        }
    } catch (e) { return null; }
    return null;
};

const setCachedImage = (url: string, img: string) => {
    try {
        const key = `vingi_img_cache_${btoa(url).substring(0, 32)}`;
        localStorage.setItem(key, JSON.stringify({ img, timestamp: Date.now() }));
    } catch (e) {}
};

export const generateSafeUrl = (match: ExternalPatternMatch): string => {
    let url = match?.url || '';
    const source = match?.source || 'Web';
    const patternName = match?.patternName || 'Sewing Pattern';
    
    const cleanSearchTerm = encodeURIComponent(patternName.replace(/ pattern| sewing| molde| vestido| dress| pdf| download/gi, '').trim());
    const fullSearchTerm = encodeURIComponent(patternName + ' sewing pattern');

    if (match.linkType === 'SEARCH_QUERY' || !url.includes('/')) {
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
    const initialImage = (match.imageUrl && match.imageUrl.length > 10) ? match.imageUrl : null;
    
    const [displayImage, setDisplayImage] = useState<string | null>(initialImage);
    const [usingProxy, setUsingProxy] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    
    let domain = '';
    try { if (safeUrl) domain = new URL(safeUrl).hostname; } catch (e) { domain = 'google.com'; }
    
    const primaryIcon = getBrandIcon(domain);
    const backupIcon = getBackupIcon(domain);

    // --- LAZY LOADING OBSERVER ---
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect(); // Stop observing once visible
                }
            },
            { rootMargin: '50px' } // Preload a bit before showing
        );

        if (cardRef.current) observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, []);

    // --- FETCH LOGIC ---
    useEffect(() => {
        if (!isVisible) return; // Só executa se estiver visível
        if (initialImage && !usingProxy) { setDisplayImage(initialImage); return; }
        if (!safeUrl || safeUrl.includes('google.com/search')) return;

        // Check Cache
        const cached = getCachedImage(safeUrl);
        if (cached) {
            setDisplayImage(getProxyUrl(cached));
            setUsingProxy(true);
            return;
        }

        let isMounted = true;
        
        // Pequeno delay para distribuir carga
        const timer = setTimeout(() => {
            fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'GET_LINK_PREVIEW', targetUrl: safeUrl })
            })
            .then(res => res.json())
            .then(data => {
                if (isMounted && data.success && data.image) {
                    const finalImg = data.image;
                    setCachedImage(safeUrl, finalImg);
                    setDisplayImage(getProxyUrl(finalImg));
                    setUsingProxy(true);
                }
            })
            .catch(() => {});
        }, Math.random() * 500); // Delay menor pois o observer já controla o fluxo

        return () => { isMounted = false; clearTimeout(timer); };
    }, [safeUrl, initialImage, isVisible]);

    const handleError = () => {
        // Fallback chain: Primary Icon -> Backup Icon -> Generic Placeholder
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
        <div ref={cardRef} onClick={() => safeUrl && window.open(safeUrl, '_blank')} className="bg-white rounded-xl border border-gray-200 hover:shadow-xl cursor-pointer transition-all hover:-translate-y-1 group overflow-hidden flex flex-col h-full animate-fade-in relative min-h-[250px]">
            <div className={`overflow-hidden relative border-b border-gray-100 flex items-center justify-center ${isBrandIcon ? 'h-24 bg-gray-50 p-4' : 'h-48 bg-white'}`}>
                {isVisible ? (
                    <img 
                        src={finalImage} 
                        alt={match.source || 'Source'} 
                        onError={handleError}
                        className={`transition-all duration-700 ${isBrandIcon ? 'w-16 h-16 object-contain mix-blend-multiply opacity-60 grayscale' : 'w-full h-full object-cover group-hover:scale-105'}`}
                    />
                ) : (
                    <div className="w-full h-full bg-gray-50 animate-pulse" />
                )}
                
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
