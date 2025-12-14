
import React, { useState, useEffect } from 'react';
import { ExternalLink, ArrowRightCircle } from 'lucide-react';
import { ExternalPatternMatch } from '../types';

// --- HELPERS INTERNOS DO CARD ---
const getBrandIcon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

export const generateSafeUrl = (match: ExternalPatternMatch): string => {
    const { url, source, patternName } = match;
    const lowerSource = source.toLowerCase();
    const lowerUrl = url.toLowerCase();
    const cleanSearchTerm = encodeURIComponent(patternName.replace(/ pattern| sewing| molde| vestido| dress| pdf| download/gi, '').trim());
    const fullSearchTerm = encodeURIComponent(patternName + ' sewing pattern');

    const isGenericLink = url.split('/').length < 4 && !url.includes('search');

    if (lowerSource.includes('etsy') || lowerUrl.includes('etsy.com')) {
        if (lowerUrl.includes('/search')) return url;
        return `https://www.etsy.com/search?q=${fullSearchTerm}&explicit=1&ship_to=BR`;
    }
    if (lowerSource.includes('burda') || lowerUrl.includes('burdastyle')) {
         if (lowerUrl.includes('catalogsearch')) return url;
        return `https://www.burdastyle.com/catalogsearch/result/?q=${cleanSearchTerm}`;
    }
    if (lowerSource.includes('mood') || lowerUrl.includes('moodfabrics')) {
        return `https://www.moodfabrics.com/blog/?s=${cleanSearchTerm}`;
    }
    if (isGenericLink) {
         return `https://www.google.com/search?q=${fullSearchTerm}+site:${lowerSource}`;
    }
    return url;
};

export const PatternVisualCard: React.FC<{ match: ExternalPatternMatch }> = ({ match }) => {
    const safeUrl = generateSafeUrl(match);
    const [displayImage, setDisplayImage] = useState<string | null>(match.imageUrl || null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    
    let domain = '';
    try { domain = new URL(safeUrl).hostname; } catch (e) { domain = 'google.com'; }
    const brandIcon = getBrandIcon(domain);

    useEffect(() => {
        // Se já temos uma imagem válida (não vazia) vinda da IA, usamos ela.
        if (match.imageUrl && match.imageUrl.length > 50) return;
        
        // Evita gastar recursos buscando imagens para links de busca genérica
        if (safeUrl.includes('/search') || safeUrl.includes('google.com')) return;

        let isMounted = true;
        setLoadingPreview(true);

        // Chama o backend "Stealth" para baixar a imagem real
        fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'GET_LINK_PREVIEW', targetUrl: safeUrl })
        })
        .then(res => res.json())
        .then(data => {
            if (isMounted && data.success && data.image) {
                setDisplayImage(data.image);
            }
        })
        .catch(err => console.log("Preview fail:", err))
        .finally(() => {
            if (isMounted) setLoadingPreview(false);
        });

        return () => { isMounted = false; };
    }, [safeUrl, match.imageUrl]);

    const finalImage = displayImage || brandIcon;
    const isBrandIcon = finalImage === brandIcon;

    return (
        <div onClick={() => window.open(safeUrl, '_blank')} className="bg-white rounded-xl border border-gray-200 hover:shadow-xl cursor-pointer transition-all hover:-translate-y-1 group overflow-hidden flex flex-col h-full animate-fade-in relative">
            
            {/* Visual Header */}
            <div className={`overflow-hidden relative border-b border-gray-100 flex items-center justify-center ${isBrandIcon ? 'h-24 bg-gray-50 p-4' : 'h-48 bg-white'}`}>
                
                {/* Loader enquanto busca a imagem stealth */}
                {loadingPreview && (
                    <div className="absolute top-2 left-2 z-20 bg-white/80 rounded-full p-1 shadow-sm backdrop-blur">
                        <div className="w-3 h-3 border-2 border-vingi-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
                
                <img 
                    src={finalImage} 
                    alt={match.source} 
                    className={`transition-all duration-700 ${isBrandIcon ? 'w-16 h-16 object-contain mix-blend-multiply opacity-60 grayscale' : 'w-full h-full object-cover group-hover:scale-105'}`}
                    onError={(e) => { 
                        (e.target as HTMLImageElement).src = brandIcon; 
                        setDisplayImage(brandIcon); 
                    }}
                />
                
                <div className="absolute top-2 right-2 z-20">
                    <ExternalLink size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 bg-white/80 p-0.5 rounded shadow-sm"/>
                </div>
            </div>

            {/* Content Body */}
            <div className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate max-w-[70%]">{match.source}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${match.type === 'PAGO' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                        {match.type}
                    </span>
                </div>
                <h3 className="font-bold text-sm text-gray-800 line-clamp-2 leading-tight mb-2 flex-1 group-hover:text-vingi-600 transition-colors">{match.patternName}</h3>
                
                <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-xs text-vingi-500 font-medium">
                    <span>Ver Molde</span>
                    <ArrowRightCircle size={14} className="group-hover:translate-x-1 transition-transform"/>
                </div>
            </div>
        </div>
    );
};
