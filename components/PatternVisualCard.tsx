
import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, ArrowRightCircle, Search, ShoppingBag } from 'lucide-react';
import { ExternalPatternMatch } from '../types';

// --- HELPERS VISUAIS ---
const getBrandIcon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
const getProxyUrl = (url: string) => `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&h=400&fit=cover&a=top&output=webp`;

// Cache Simples para evitar refetching
const imgCache = new Map<string, string>();

interface PatternVisualCardProps {
    match: ExternalPatternMatch;
    userReferenceImage?: string | null;
}

const createTinyRef = async (base64: string): Promise<string | null> => {
    return new Promise(resolve => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = 200 / Math.max(img.width, img.height);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]); 
        };
        img.onerror = () => resolve(null);
    });
};

export const PatternVisualCard: React.FC<PatternVisualCardProps> = ({ match, userReferenceImage }) => {
    if (!match) return null;

    const safeUrl = match.url;
    // Tenta pegar do cache primeiro
    const cachedImg = safeUrl ? imgCache.get(safeUrl) : null;
    const initialImgRaw = cachedImg || match.imageUrl;

    // Estado da imagem a ser exibida
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    
    const cardRef = useRef<HTMLDivElement>(null);
    
    let domain = '';
    try { if (safeUrl) domain = new URL(safeUrl).hostname; } catch (e) { domain = 'google.com'; }
    const primaryIcon = getBrandIcon(domain);

    // Observer para Lazy Loading real
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); }
        }, { rootMargin: '100px' });
        if (cardRef.current) observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, []);

    // 1. Lógica de Busca da Imagem (Scraping)
    useEffect(() => {
        if (!isVisible || !safeUrl) return;

        // Se já temos imagem inicial (do cache ou da prop), usamos ela (com proxy)
        if (initialImgRaw && initialImgRaw.length > 10) {
            setImgSrc(getProxyUrl(initialImgRaw));
            return;
        }

        // Se não, vamos buscar
        setLoading(true);
        let active = true;

        const fetchScrapedImage = async () => {
            try {
                let tinyRef = null;
                if (userReferenceImage) { tinyRef = await createTinyRef(userReferenceImage); }

                const res = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'GET_LINK_PREVIEW', 
                        targetUrl: safeUrl,
                        backupSearchTerm: match.backupSearchTerm || match.patternName,
                        userReferenceImage: tinyRef
                    })
                });
                const data = await res.json();
                
                if (active) {
                    if (data.success && data.image) {
                        imgCache.set(safeUrl, data.image);
                        // Tenta com proxy primeiro
                        setImgSrc(getProxyUrl(data.image));
                    } else {
                        // Se falhar o scraping, usa o ícone
                        setImgSrc(primaryIcon);
                        setHasError(true); // Marca como erro para aplicar estilo de fallback
                    }
                }
            } catch (e) {
                if (active) { setImgSrc(primaryIcon); setHasError(true); }
            } finally {
                if (active) setLoading(false);
            }
        };

        const timeout = setTimeout(fetchScrapedImage, Math.random() * 800);
        return () => { active = false; clearTimeout(timeout); };
    }, [isVisible, safeUrl, initialImgRaw, match.backupSearchTerm, userReferenceImage]);


    // 2. Handler de Erro de Imagem (A Mágica do Fallback)
    const handleImageError = () => {
        if (!imgSrc) return;

        // Se falhou o proxy (wsrv.nl), tenta a imagem original direta
        if (imgSrc.includes('wsrv.nl')) {
            const originalUrl = decodeURIComponent(imgSrc.split('?url=')[1].split('&')[0]);
            setImgSrc(originalUrl);
        } 
        // Se falhou a original ou já era outra coisa, fallback para o ícone
        else if (imgSrc !== primaryIcon) {
            setImgSrc(primaryIcon);
            setHasError(true);
        }
    };

    return (
        <div ref={cardRef} onClick={() => safeUrl && window.open(safeUrl, '_blank')} className="bg-white rounded-xl border border-gray-200 hover:shadow-xl cursor-pointer transition-all hover:-translate-y-1 group overflow-hidden flex flex-col h-full animate-fade-in relative min-h-[260px]">
            <div className="overflow-hidden relative border-b border-gray-100 flex items-center justify-center h-48 bg-gray-50">
                {loading && (
                    <div className="absolute inset-0 bg-gray-100/50 flex items-center justify-center z-10 backdrop-blur-[1px]">
                        <div className="flex flex-col items-center gap-2">
                             <div className="w-4 h-4 border-2 border-vingi-500 border-t-transparent rounded-full animate-spin"></div>
                             <span className="text-[8px] font-bold text-vingi-400 animate-pulse">AI SEARCH</span>
                        </div>
                    </div>
                )}
                
                <img 
                    src={imgSrc || primaryIcon} 
                    alt={match.source} 
                    onError={handleImageError}
                    loading="lazy"
                    className={`transition-all duration-700 w-full h-full ${
                        hasError || imgSrc === primaryIcon 
                        ? 'object-contain p-12 opacity-30 grayscale mix-blend-multiply' 
                        : 'object-cover group-hover:scale-105'
                    }`}
                />
                
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
