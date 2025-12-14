
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
        setTimeout(() => controller.abort(), 6000); 
        try {
            const response = await fetch(url, { headers: browserHeaders, signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        } catch (e) {
            return null;
        }
    };

    // SUB-ROTINA: Busca no Bing (Otimizada para Texturas)
    const fetchCandidatesFromBing = async (term) => {
        if (!term) return [];
        
        // Limpeza e Foco em Textura/Close-up
        const cleanTerm = term.replace(/seamless pattern/gi, '').trim();
        // Adiciona "texture zoom" ou "swatch" para buscar o detalhe da estampa
        const query = `${cleanTerm} seamless pattern texture swatch close-up`; 
        
        const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&scenario=ImageBasicHover`;
        const html = await fetchHtml(searchUrl);
        if (!html) return [];

        const candidates = [];
        const regex = /murl&quot;:&quot;(https?:\/\/[^&]+)&quot;.*?&quot;t&quot;:&quot;([^&]+)&quot;/g;
        let match;
        let count = 0;
        
        while ((match = regex.exec(html)) !== null && count < 6) {
            candidates.push({ url: match[1], title: match[2] });
            count++;
        }
        return candidates;
    };

    // SUB-ROTINA: Juiz Visual (IA)
    const selectBestMatchAI = async (candidates, userRefImage) => {
        if (!candidates || candidates.length === 0) return null;
        if (!userRefImage || !apiKey) return candidates[0].url; 

        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const candidatesText = candidates.map((c, i) => `ID ${i}: ${c.title}`).join('\n');
            
            // Prompt focado em Texturas e Cores
            const JUDGE_PROMPT = `
            TASK: Visual Texture Matcher.
            INPUT: User Reference Texture + Candidate Images.
            GOAL: Select the image ID that matches the COLOR PALETTE and MOTIF STYLE (e.g., Floral, Geometric).
            
            RULES: 
            1. REJECT generic logos, mockups of mugs/pillows if a flat texture is available.
            2. PREFER flat lay texture swatches.
            3. Must match the visual vibe of the user image.
            
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

    // --- LÓGICA PRINCIPAL DO CRAWLER CIRÚRGICO ---
    let imageUrl = null;
    
    // 1. TENTATIVA DIRETA NO SITE (Seletores de Marketplaces de Design)
    const html = await fetchHtml(targetUrl);
    
    if (html) {
        // MAPA DE SELETORES ESPECÍFICOS (Surface Design)
        const storeSelectors = [
            // Patternbank (Geralmente divs com background ou img tags específicas)
            { domain: 'patternbank.com', regex: /<img[^>]+class="[^"]*design-image[^"]*"[^>]+src="([^"]+)"/i },
            // Spoonflower (Muitas vezes usa classes product-image)
            { domain: 'spoonflower.com', regex: /<img[^>]+class="[^"]*product-image[^"]*"[^>]+src="([^"]+)"/i },
            // Creative Market
            { domain: 'creativemarket.com', regex: /<img[^>]+class="[^"]*product-card-img[^"]*"[^>]+src="([^"]+)"/i },
            // Adobe Stock / Shutterstock (Thumbnails)
            { domain: 'stock.adobe.com', regex: /<img[^>]+itemprop="thumbnailUrl"[^>]+src="([^"]+)"/i },
            { domain: 'shutterstock.com', regex: /<img[^>]+data-src="([^"]+)"[^>]+class="[^"]*jss[^"]*"/i },
            // Etsy (Reuso do seletor de clothing, mas funciona pra digital)
            { domain: 'etsy.com', regex: /v2-listing-card__img[\s\S]*?src="([^"]+)"/i },
            // Design Bundles
            { domain: 'designbundles.net', regex: /<img[^>]+class="product-image[^"]*"[^>]+src="([^"]+)"/i },
            // Genérico E-commerce (WooCommerce/Shopify grids)
            { domain: '', regex: /<img[^>]+class="[^"]*(grid-view-item__image|product-card__image|woocommerce-loop-product__link)[^"]*"[^>]+src="([^"]+)"/i }
        ];

        const activeSelector = storeSelectors.find(s => targetUrl.includes(s.domain) && s.domain !== '');
        
        if (activeSelector) {
            const match = html.match(activeSelector.regex);
            if (match && match[1]) imageUrl = match[1];
        }

        // Fallback Genérico de Grid (Evita Logos)
        if (!imageUrl) {
            const productImgRegex = /<img[^>]+src="([^"]+)"[^>]+class="[^"]*(product|item|card|grid|result)[^"]*"[^>]*>/i;
            const match = html.match(productImgRegex);
            
            // Backup: Imagens quadradas médias (padrão de thumbnails de pattern)
            const backupGridRegex = /<img[^>]+src="([^"]+)"[^>]+alt="[^"]*"[^>]*width="[2-9][0-9][0-9]"[^>]*>/i;
            
            if (match && match[1] && !match[1].includes('logo') && !match[1].includes('icon')) {
                imageUrl = match[1];
            } else {
                 const match2 = html.match(backupGridRegex);
                 if (match2 && match2[1]) imageUrl = match2[1];
            }
        }
    }

    // 2. FALLBACK PARA BING (Apenas se falhar extração direta)
    if ((!imageUrl || imageUrl.includes('logo') || imageUrl.includes('.svg') || imageUrl.length < 20) && backupSearchTerm) {
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
        if (imageUrl.includes('etsystatic')) {
            imageUrl = imageUrl.replace('340x270', '794xN').replace('il_fullxfull', 'il_794xN');
        }
    }
    
    return imageUrl;
};
