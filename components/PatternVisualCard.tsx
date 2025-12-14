
import React, { useState, useEffect } from 'react';
import { ExternalLink, ArrowRightCircle } from 'lucide-react';
import { ExternalPatternMatch } from '../types';

// --- HELPERS INTERNOS DO CARD ---
const getBrandIcon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

// Proxy de Imagem Gratuito e Rápido (wsrv.nl)
// Redimensiona, converte para WebP e, crucialmente, mascara a origem para evitar bloqueios 403
const getProxyUrl = (url: string) => `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&h=400&fit=cover&a=top&output=webp`;

export const generateSafeUrl = (match: ExternalPatternMatch): string => {
    const { url, source, patternName } = match;
    const cleanSearchTerm = encodeURIComponent(patternName.replace(/ pattern| sewing| molde| vestido| dress| pdf| download/gi, '').trim());
    const fullSearchTerm = encodeURIComponent(patternName + ' sewing pattern');

    const lowerUrl = url.toLowerCase();
    const lowerSource = source.toLowerCase();

    // Lógica de Link Inteligente
    if (lowerSource.includes('etsy') || lowerUrl.includes('etsy.com')) {
        if (lowerUrl.includes('/search')) return url;
        return `https://www.etsy.com/search?q=${fullSearchTerm}&explicit=1&ship_to=BR`;
    }
    if (lowerSource.includes('burda') || lowerUrl.includes('burdastyle')) {
         if (lowerUrl.includes('catalogsearch')) return url;
        return `https://www.burdastyle.com/catalogsearch/result/?q=${cleanSearchTerm}`;
    }
    // Adicione mais regras específicas aqui se necessário
    
    return url;
};

export const PatternVisualCard: React.FC<{ match: ExternalPatternMatch }> = ({ match }) => {
    const safeUrl = generateSafeUrl(match);
    const [displayImage, setDisplayImage] = useState<string | null>(match.imageUrl || null);
    const [usingProxy, setUsingProxy] = useState(false);
    
    let domain = '';
    try { domain = new URL(safeUrl).hostname; } catch (e) { domain = 'google.com'; }
    const brandIcon = getBrandIcon(domain);

    useEffect(() => {
        // Se já temos imagem da IA e ela não falhou ainda
        if (match.imageUrl && match.imageUrl.length > 50 && !usingProxy) {
            setDisplayImage(match.imageUrl); // Tenta usar direto primeiro
            return;
        }

        // Se for URL genérica, não tenta scrapear
        if (safeUrl.includes('/search') || safeUrl.includes('google.com')) return;

        // Tenta buscar imagem real via backend (Stealth Scraper)
        let isMounted = true;
        fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'GET_LINK_PREVIEW', targetUrl: safeUrl })
        })
        .then(res => res.json())
        .then(data => {
            if (isMounted && data.success && data.image) {
                // Ao receber a URL, passamos pelo proxy para garantir display
                setDisplayImage(getProxyUrl(data.image));
                setUsingProxy(true);
            }
        })
        .catch(() => {}); // Falha silenciosa

        return () => { isMounted = false; };
    }, [safeUrl, match.imageUrl]);

    const handleError = () => {
        // Se a imagem falhar (seja direta ou proxy), fallback para o ícone da marca
        if (displayImage !== brandIcon) {
            setDisplayImage(brandIcon);
        }
    };

    const finalImage = displayImage || brandIcon;
    const isBrandIcon = finalImage === brandIcon;

    return (
        <div onClick={() => window.open(safeUrl, '_blank')} className="bg-white rounded-xl border border-gray-200 hover:shadow-xl cursor-pointer transition-all hover:-translate-y-1 group overflow-hidden flex flex-col h-full animate-fade-in relative">
            
            {/* Visual Header */}
            <div className={`overflow-hidden relative border-b border-gray-100 flex items-center justify-center ${isBrandIcon ? 'h-24 bg-gray-50 p-4' : 'h-48 bg-white'}`}>
                
                <img 
                    src={finalImage} 
                    alt={match.source} 
                    onError={handleError}
                    loading="lazy"
                    className={`transition-all duration-700 ${isBrandIcon ? 'w-16 h-16 object-contain mix-blend-multiply opacity-60 grayscale' : 'w-full h-full object-cover group-hover:scale-105'}`}
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
