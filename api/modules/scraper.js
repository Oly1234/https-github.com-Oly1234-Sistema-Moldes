
// api/modules/scraper.js
// ESPECIALIDADE: Web Scraping, Busca de Imagens no Bing & Link Preview

export const getLinkPreview = async (targetUrl, backupSearchTerm, userReferenceImage, apiKey, cleanJson) => {
    
    const browserHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache'
    };

    const fetchHtml = async (url) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000); 
        try {
            const response = await fetch(url, { headers: browserHeaders, signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        } catch (e) {
            return null;
        }
    };

    // SUB-ROTINA: Busca no Bing (Fallback Poderoso)
    const fetchCandidatesFromBing = async (term) => {
        if (!term) return [];
        // Limpeza agressiva para garantir foco no PRODUTO/ESTAMPA
        let cleanTerm = term.replace(/sewing pattern/gi, '').trim();
        const query = `${cleanTerm} sewing pattern garment texture -logo -icon -banner`;
        const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&scenario=ImageBasicHover`;
        const html = await fetchHtml(searchUrl);
        if (!html) return [];

        const candidates = [];
        // Regex otimizado para extrair imagens reais do Bing
        const regex = /murl&quot;:&quot;(https?:\/\/[^&]+)&quot;.*?&quot;t&quot;:&quot;([^&]+)&quot;/g;
        let match;
        let count = 0;
        
        while ((match = regex.exec(html)) !== null && count < 8) {
            candidates.push({ url: match[1], title: match[2] });
            count++;
        }

        if (candidates.length === 0) {
             const regex2 = /"murl":"(https?:\/\/[^"]+)".*?"t":"([^"]+)"/g;
             while ((match = regex2.exec(html)) !== null && count < 8) {
                candidates.push({ url: match[1], title: match[2] });
                count++;
            }
        }
        return candidates;
    };

    // SUB-ROTINA: Juiz Visual (IA) - Agora mais rigoroso
    const selectBestMatchAI = async (candidates, userRefImage) => {
        if (!candidates || candidates.length === 0) return null;
        if (!userRefImage || !apiKey) return candidates[0].url; 

        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const candidatesText = candidates.map((c, i) => `ID ${i}: [TITLE: ${c.title}]`).join('\n');
            
            const JUDGE_PROMPT = `
            TASK: Visual Curator.
            INPUT: 1 User Reference Image + List of Search Result Titles.
            GOAL: Pick the Image ID that represents a SIMILAR TEXTURE/PATTERN or GARMENT STYLE to the user image.
            
            STRICT RULES:
            1. REJECT LOGOS, ICONS, or TEXT BANNERS.
            2. REJECT "PDF Download" generic placeholders.
            3. Prioritize actual photos of fabric or model wearing the item.
            4. If the user image is a floral print, look for floral terms in titles.
            
            CANDIDATES:
            ${candidatesText}
            
            OUTPUT JSON: { "bestId": 0 }
            `;

            const payload = {
                contents: [{
                    parts: [
                        { text: JUDGE_PROMPT },
                        { inline_data: { mime_type: "image/jpeg", data: userRefImage } } 
                    ]
                }],
                generation_config: { response_mime_type: "application/json" }
            };

            const response = await fetch(endpoint, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const decision = JSON.parse(cleanJson(text));
            const bestIndex = decision.bestId !== undefined ? decision.bestId : 0;
            return candidates[bestIndex] ? candidates[bestIndex].url : candidates[0].url;

        } catch (e) {
            return candidates[0].url;
        }
    };

    // LÓGICA PRINCIPAL DO CRAWLER
    let imageUrl = null;
    const isSearchPage = targetUrl.includes('/search') || targetUrl.includes('?q=') || targetUrl.includes('query=');
    
    // 1. TENTATIVA DIRETA NO SITE (Parsing Inteligente de Grid)
    const html = await fetchHtml(targetUrl);
    
    if (html) {
        if (isSearchPage) {
            // Em páginas de busca, NÃO queremos o og:image (que geralmente é o logo).
            // Queremos a primeira imagem de produto do grid.
            const productImgRegex = /<img[^>]+src="([^"]+)"[^>]+class="[^"]*(product|item|card|grid|result)[^"]*"[^>]*>/i;
            const match = html.match(productImgRegex);
            
            // Regex alternativo para grids comuns de e-commerce (Shopify, WooCommerce, Magento)
            const backupGridRegex = /<img[^>]+src="([^"]+)"[^>]+alt="[^"]*"[^>]*width="[2-9][0-9][0-9]"[^>]*>/i;
            
            if (match && match[1] && !match[1].includes('logo') && !match[1].includes('icon')) {
                imageUrl = match[1];
            } else {
                 const match2 = html.match(backupGridRegex);
                 if (match2 && match2[1]) imageUrl = match2[1];
            }
        } else {
            // Em páginas de produto único, JSON-LD ou OG:Image são reis.
            const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
            let match;
            while ((match = jsonLdRegex.exec(html)) !== null) {
                try {
                    const json = JSON.parse(match[1]);
                    const extract = (obj) => {
                        if (!obj) return null;
                        if (obj.image) return Array.isArray(obj.image) ? obj.image[0] : (typeof obj.image === 'object' ? obj.image.url : obj.image);
                        if (obj.thumbnailUrl) return obj.thumbnailUrl;
                        return null;
                    };
                    const img = extract(json) || (json.itemListElement && extract(json.itemListElement[0]?.item));
                    if (img) { imageUrl = img; break; }
                } catch (e) {}
            }
            if (!imageUrl) {
                const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
                if (og) imageUrl = og[1];
            }
        }
    }

    // 2. FALLBACK PARA BING (Se o site falhou ou bloqueou)
    // Se não achamos imagem ou se achamos algo que parece um logo/ícone pequeno
    if ((!imageUrl || imageUrl.includes('logo') || imageUrl.includes('.svg')) && backupSearchTerm) {
        const candidates = await fetchCandidatesFromBing(backupSearchTerm);
        if (candidates.length > 0) {
            if (userReferenceImage && apiKey) {
                imageUrl = await selectBestMatchAI(candidates, userReferenceImage);
            } else {
                imageUrl = candidates[0].url;
            }
        }
    }

    // Limpeza Final da URL
    if (imageUrl) {
        imageUrl = imageUrl.replace(/&amp;/g, '&');
        if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
        // Fix específico para Etsy (pegar resolução maior se disponível)
        if (imageUrl.includes('etsystatic') && (imageUrl.includes('340x270') || imageUrl.includes('il_fullxfull'))) {
            imageUrl = imageUrl.replace('340x270', '794xN').replace('il_fullxfull', 'il_794xN');
        }
    }
    
    return imageUrl;
};
