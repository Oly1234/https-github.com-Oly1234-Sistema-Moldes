
import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, ArrowRightCircle, Search, ShoppingBag, Share2, ImageOff } from 'lucide-react';
import { ExternalPatternMatch } from '../types';

// --- HELPERS VISUAIS ---
const getBrandIcon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

// Cache Simples em memória para não piscar imagens ao rolar
const imgCache = new Map<string, string>();

interface PatternVisualCardProps {
    match: ExternalPatternMatch;
    userReferenceImage?: string | null;
}

export const PatternVisualCard: React.FC<PatternVisualCardProps> = ({ match, userReferenceImage }) => {
    if (!match) return null;

    const safeUrl = match.url;
    // O Scraper agora retorna uma URL TBN (Thumbnail) síncrona, mas a chamamos via API para manter padrão
    // Porém, podemos otimizar: se já temos o termo de backup, podemos montar a URL TBN direto no front se quisermos agilidade extrema.
    // Vamos manter a chamada à API para consistência, mas o backend apenas formata a string.
    
    const [imgSrc, setImgSrc] = useState<string | null>(imgCache.get(safeUrl) || null);
    const [hasError, setHasError] = useState(false);
    const [loading, setLoading] = useState(!imgSrc);
    const [isVisible, setIsVisible] = useState(false);
    
    // Debug Visual: Mostrar o que está sendo buscado
    const displayQuery = match.backupSearchTerm || match.patternName;

    const cardRef = useRef<HTMLDivElement>(null);
    
    let domain = '';
    try { if (safeUrl) domain = new URL(safeUrl).hostname; } catch (e) { domain = 'google.com'; }
    const primaryIcon = getBrandIcon(domain);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); }
        }, { rootMargin: '200px' }); // Carrega um pouco antes de aparecer
        if (cardRef.current) observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible || !safeUrl || imgSrc) return;

        setLoading(true);
        let active = true;

        const fetchImage = async () => {
            try {
                // Chama nosso backend scraper que agora usa a estratégia "Inversão de Fluxo" (Bing TBN)
                const res = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'GET_LINK_PREVIEW', 
                        targetUrl: safeUrl,
                        backupSearchTerm: match.backupSearchTerm || match.patternName,
                        linkType: match.linkType,
                        // Não enviamos userReferenceImage para poupar banda, pois o TBN é baseado em texto
                    })
                });
                const data = await res.json();
                
                if (active) {
                    if (data.success && data.image) {
                        imgCache.set(safeUrl, data.image);
                        setImgSrc(data.image);
                    } else {
                        // Se falhar o TBN, usa o ícone da marca
                        setImgSrc(primaryIcon);
                        setHasError(true);
                    }
                }
            } catch (e) {
                if (active) { setImgSrc(primaryIcon); setHasError(true); }
            } finally {
                if (active) setLoading(false);
            }
        };

        // Pequeno delay aleatório para não disparar 50 requests simultâneos no browser
        const timeout = setTimeout(fetchImage, Math.random() * 300);
        return () => { active = false; clearTimeout(timeout); };
    }, [isVisible, safeUrl, match.backupSearchTerm, match.patternName]);

    const handleImageError = () => {
        // Se o proxy principal falhar, tenta fallback para o ícone
        if (imgSrc !== primaryIcon) {
            setImgSrc(primaryIcon);
            setHasError(true);
        }
    };

    const handleWhatsappShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!safeUrl) return;
        const text = `Encontrei este molde: *${match.patternName}* (${match.source})\n${safeUrl}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <div ref={cardRef} onClick={() => safeUrl && window.open(safeUrl, '_blank')} className="bg-white rounded-xl border border-gray-200 hover:shadow-xl cursor-pointer transition-all hover:-translate-y-1 group overflow-hidden flex flex-col h-full animate-fade-in relative min-h-[300px]">
            <div className="overflow-hidden relative border-b border-gray-100 flex items-center justify-center h-52 bg-gray-50">
                {loading && (
                    <div className="absolute inset-0 bg-gray-50 flex flex-col items-center justify-center z-10 px-4 text-center">
                        <div className="w-5 h-5 border-2 border-vingi-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <span className="text-[9px] font-mono text-gray-400 truncate w-full">🔎 {displayQuery}</span>
                    </div>
                )}
                
                <img 
                    src={imgSrc || primaryIcon} 
                    alt={match.source} 
                    onError={handleImageError}
                    loading="lazy"
                    className={`transition-all duration-700 w-full h-full ${
                        hasError || imgSrc === primaryIcon 
                        ? 'object-contain p-12 opacity-40 grayscale mix-blend-multiply' 
                        : 'object-cover group-hover:scale-105'
                    }`}
                />
                
                {/* Labels de Tipo */}
                <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
                     <span className={`text-[8px] font-bold px-2 py-1 rounded-full shadow-sm backdrop-blur-md text-white ${match.linkType === 'SEARCH_QUERY' ? 'bg-blue-600/80' : 'bg-green-600/80'}`}>
                         {match.linkType === 'SEARCH_QUERY' ? 'BUSCA INTELIGENTE' : 'PRODUTO DIRETO'}
                     </span>
                </div>

                {/* Badge de Depuração da Query (Visível apenas se houver imagem carregada para confirmar match) */}
                {!loading && !hasError && imgSrc !== primaryIcon && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[8px] text-white/90 font-mono truncate">match: {displayQuery}</p>
                    </div>
                )}
            </div>

            <div className="p-3 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest truncate max-w-[70%]">{match.source}</span>
                    {hasError && <span className="text-[8px] text-red-400 flex items-center gap-1"><ImageOff size={8}/> Sem Preview</span>}
                </div>
                
                <h3 className="font-bold text-sm text-gray-800 line-clamp-2 leading-tight mb-2 flex-1 group-hover:text-vingi-600 transition-colors">
                    {match.patternName}
                </h3>
                
                <div className="mt-auto pt-3 border-t border-gray-50 flex items-center gap-2">
                    <button 
                        onClick={handleWhatsappShare} 
                        className="flex-1 bg-green-50 text-green-600 border border-green-100 hover:bg-green-100 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                        <Share2 size={12} /> Compartilhar
                    </button>
                    <div className="bg-vingi-50 text-vingi-600 p-2 rounded-lg">
                         <ArrowRightCircle size={14}/>
                    </div>
                </div>
            </div>
        </div>
    );
};
