
// api/modules/scraper.js
// DEPARTAMENTO: AQUISIÇÃO DE DADOS (O Coletor)
// RESPONSÁVEL: Vingi Scout Team

import { selectVisualTwin } from './curator.js';

export const getLinkPreview = async (targetUrl, backupSearchTerm, userReferenceImage, apiKey, contextType = 'CLOTHING') => {
    
    const browserHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    };

    const fetchHtml = async (url) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 8000); // Mais tempo para coleta
        try {
            const response = await fetch(url, { headers: browserHeaders, signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        } catch (e) { return null; }
    };

    // SUB-ROTINA: Coleta Ampliada no Bing (COM DEDUPLICAÇÃO)
    const fetchCandidatesFromBing = async (term, specificDomain = null) => {
        if (!term) return [];
        
        let query = term.replace(/sewing pattern/gi, 'pattern').trim();
        
        // Estratégia de Domínio + Visual
        if (specificDomain) {
            query += ` site:${specificDomain}`;
        }

        const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&scenario=ImageBasicHover`;
        const html = await fetchHtml(searchUrl);
        if (!html) return [];

        const candidates = [];
        const seenUrls = new Set(); // DEDUPLICAÇÃO: Rastreia URLs já vistas
        
        // Regex ajustado para pegar thumbnails
        const regex = /murl&quot;:&quot;(https?:\/\/[^&]+)&quot;.*?&quot;t&quot;:&quot;([^&]+)&quot;/g;
        let match;
        let count = 0;
        
        while ((match = regex.exec(html)) !== null && count < 15) {
            const url = match[1];
            const title = match[2];
            
            // Só adiciona se a URL for nova
            if (!seenUrls.has(url)) {
                candidates.push({ url, title });
                seenUrls.add(url);
                count++;
            }
        }
        return candidates;
    };

    // --- EXECUÇÃO DO PROCESSO ---
    let imageUrl = null;
    let domain = '';
    try { domain = new URL(targetUrl).hostname; } catch(e) {}

    // 1. TENTATIVA DIRETA (Seletores DOM)
    const html = await fetchHtml(targetUrl);
    if (html) {
        const storeSelectors = [
            { domain: 'patternbank', regex: /<img[^>]+class="[^"]*design-image[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'spoonflower', regex: /<img[^>]+class="[^"]*product-image[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'burdastyle', regex: /<img[^>]+class="product-image-photo[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'simplicity', regex: /<img[^>]+class="card-image[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'etsy', regex: /v2-listing-card__img[\s\S]*?src="([^"]+)"/i },
            { domain: '', regex: /<meta property="og:image" content="([^"]+)"/i },
            { domain: '', regex: /<meta name="twitter:image" content="([^"]+)"/i }
        ];

        const activeSelector = storeSelectors.find(s => targetUrl.includes(s.domain) && s.domain !== '');
        if (activeSelector) {
            const match = html.match(activeSelector.regex);
            if (match && match[1]) imageUrl = match[1];
        }
        
        if (!imageUrl) {
             const ogMatch = html.match(storeSelectors.find(s => s.regex.toString().includes('og:image')).regex);
             if (ogMatch && ogMatch[1]) imageUrl = ogMatch[1];
        }
    }

    // 2. CURADORIA VISUAL
    if (backupSearchTerm) {
        let candidates = [];
        
        if (domain && domain.length > 3 && !domain.includes('google')) {
             candidates = await fetchCandidatesFromBing(backupSearchTerm, domain);
        }

        if (candidates.length === 0) {
             candidates = await fetchCandidatesFromBing(backupSearchTerm, null);
        }

        if (candidates.length > 0) {
            if (userReferenceImage && apiKey) {
                // Curador seleciona o melhor candidato
                imageUrl = await selectVisualTwin(apiKey, candidates, userReferenceImage, contextType);
            } else {
                // Fallback com Hash para garantir estabilidade visual sem IA
                let domainHash = 0;
                try { domainHash = domain.charCodeAt(0); } catch(e) { domainHash = 1; }
                const diversityOffset = domainHash % Math.min(candidates.length, 3);
                imageUrl = candidates[diversityOffset].url;
            }
        }
    }

    // 3. HIGIENIZAÇÃO
    if (imageUrl) {
        imageUrl = imageUrl.replace(/&amp;/g, '&');
        if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
        if (imageUrl.includes('etsystatic')) imageUrl = imageUrl.replace('340x270', '794xN');
        if (imageUrl.includes('cdn.shopify.com') && imageUrl.includes('_small')) imageUrl = imageUrl.replace('_small', '_600x600');
    }
    
    return imageUrl;
};
