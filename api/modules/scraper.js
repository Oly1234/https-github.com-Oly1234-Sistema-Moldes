
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

    // SUB-ROTINA: Coleta Ampliada no Bing
    const fetchCandidatesFromBing = async (term, specificDomain = null) => {
        if (!term) return [];
        
        let query = term.replace(/sewing pattern/gi, 'pattern').trim();
        
        // Estratégia de Domínio + Visual
        // Se temos um domínio, pedimos imagens DELE.
        if (specificDomain) {
            query += ` site:${specificDomain}`;
        }

        // Adiciona "keywords visuais" para evitar logotipos/texto
        // query += " (photo OR photography OR model)"; 

        const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&scenario=ImageBasicHover`;
        const html = await fetchHtml(searchUrl);
        if (!html) return [];

        const candidates = [];
        // Regex ajustado para pegar thumbnails de alta qualidade se possível
        const regex = /murl&quot;:&quot;(https?:\/\/[^&]+)&quot;.*?&quot;t&quot;:&quot;([^&]+)&quot;/g;
        let match;
        let count = 0;
        
        // COLETAMOS MAIS CANDIDATOS (15) para o Curador ter opções
        while ((match = regex.exec(html)) !== null && count < 15) {
            candidates.push({ url: match[1], title: match[2] });
            count++;
        }
        return candidates;
    };

    // --- EXECUÇÃO DO PROCESSO ---
    let imageUrl = null;
    let domain = '';
    try { domain = new URL(targetUrl).hostname; } catch(e) {}

    // 1. TENTATIVA DIRETA (Seletores DOM)
    // Mantemos essa etapa pois é a mais rápida e precisa SE o site permitir acesso direto.
    const html = await fetchHtml(targetUrl);
    if (html) {
        // Seletores aprimorados para ignorar logos
        const storeSelectors = [
            // Específicos por Loja (Prioridade Alta)
            { domain: 'patternbank', regex: /<img[^>]+class="[^"]*design-image[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'spoonflower', regex: /<img[^>]+class="[^"]*product-image[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'burdastyle', regex: /<img[^>]+class="product-image-photo[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'simplicity', regex: /<img[^>]+class="card-image[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'etsy', regex: /v2-listing-card__img[\s\S]*?src="([^"]+)"/i },
            // Genéricos Inteligentes (OpenGraph geralmente é a melhor imagem definida pelo site)
            { domain: '', regex: /<meta property="og:image" content="([^"]+)"/i },
            { domain: '', regex: /<meta name="twitter:image" content="([^"]+)"/i }
        ];

        const activeSelector = storeSelectors.find(s => targetUrl.includes(s.domain) && s.domain !== '');
        if (activeSelector) {
            const match = html.match(activeSelector.regex);
            if (match && match[1]) imageUrl = match[1];
        }
        
        // Se falhar o específico, tenta o OpenGraph genérico
        if (!imageUrl) {
             const ogMatch = html.match(storeSelectors.find(s => s.regex.toString().includes('og:image')).regex);
             if (ogMatch && ogMatch[1]) imageUrl = ogMatch[1];
        }
    }

    // 2. CURADORIA VISUAL (Se a direta falhou ou foi rejeitada ou é backupSearch)
    // Se temos um termo de busca backup, usamos o Curador para achar a MELHOR imagem visualmente
    if (backupSearchTerm) {
        let candidates = [];
        
        // Busca Candidatos no Domínio Específico
        if (domain && domain.length > 3 && !domain.includes('google')) {
             candidates = await fetchCandidatesFromBing(backupSearchTerm, domain);
        }

        // Se não achou nada no domínio, busca na web geral (fallback)
        if (candidates.length === 0) {
             candidates = await fetchCandidatesFromBing(backupSearchTerm, null);
        }

        if (candidates.length > 0) {
            if (userReferenceImage && apiKey) {
                // ACIONA O DEPARTAMENTO DE CURADORIA
                // O Curador vai decidir qual imagem é o "Gêmeo Visual"
                imageUrl = await selectVisualTwin(apiKey, candidates, userReferenceImage, contextType);
            } else {
                // Fallback sem IA (Usa hash para diversidade)
                let domainHash = 0;
                try { domainHash = domain.charCodeAt(0); } catch(e) { domainHash = 1; }
                const diversityOffset = domainHash % Math.min(candidates.length, 3);
                imageUrl = candidates[diversityOffset].url;
            }
        }
    }

    // 3. HIGIENIZAÇÃO (Limpeza Final)
    if (imageUrl) {
        imageUrl = imageUrl.replace(/&amp;/g, '&');
        if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
        // Correções específicas de CDN conhecidos
        if (imageUrl.includes('etsystatic')) imageUrl = imageUrl.replace('340x270', '794xN'); // Etsy High Res
        if (imageUrl.includes('cdn.shopify.com') && imageUrl.includes('_small')) imageUrl = imageUrl.replace('_small', '_600x600');
    }
    
    return imageUrl;
};
