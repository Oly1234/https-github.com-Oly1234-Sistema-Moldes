
// api/modules/scraper.js
// ESPECIALIDADE: Web Scraping & Busca Inteligente

export const getLinkPreview = async (targetUrl, backupSearchTerm, userReferenceImage, apiKey, cleanJson) => {
    
    const browserHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    };

    const fetchHtml = async (url) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 6000); 
        try {
            const response = await fetch(url, { headers: browserHeaders, signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        } catch (e) { return null; }
    };

    // SUB-ROTINA: Busca no Bing (Diversificada)
    const fetchCandidatesFromBing = async (term) => {
        if (!term) return [];
        // Termo limpo mas mantendo a "assinatura" da loja (ex: "model", "envelope")
        const query = term.replace(/sewing pattern/gi, 'pattern').trim();
        const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&scenario=ImageBasicHover`;
        const html = await fetchHtml(searchUrl);
        if (!html) return [];

        const candidates = [];
        const regex = /murl&quot;:&quot;(https?:\/\/[^&]+)&quot;.*?&quot;t&quot;:&quot;([^&]+)&quot;/g;
        let match;
        let count = 0;
        while ((match = regex.exec(html)) !== null && count < 8) {
            candidates.push({ url: match[1], title: match[2] });
            count++;
        }
        return candidates;
    };

    // SUB-ROTINA: Juiz Visual (IA) - Relaxado para "Vibe Match"
    const selectBestMatchAI = async (candidates, userRefImage, diversityOffset) => {
        if (!candidates || candidates.length === 0) return null;
        if (!userRefImage || !apiKey) {
            // LÓGICA DE DIVERSIDADE DETERMINÍSTICA (SEM IA)
            // Se não tiver imagem de referência, usa o offset para garantir
            // que lojas diferentes peguem resultados diferentes (0, 1, ou 2)
            const safeIndex = diversityOffset % Math.min(candidates.length, 3);
            return candidates[safeIndex].url;
        }

        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const candidatesText = candidates.map((c, i) => `ID ${i}: ${c.title}`).join('\n');
            
            // Prompt relaxado: "Diferenciar bastante desde que lembre bem"
            const JUDGE_PROMPT = `
            TASK: Select the best image.
            CONTEXT: The user wants to buy a product similar to the reference.
            
            RULES:
            1. LOOK FOR: High quality product photos (Models for clothes, Swatches for fabric).
            2. AVOID: Generic logos, blurry text, pixelated icons.
            3. VIBE MATCH: It doesn't need to be identical. If the reference is a floral dress, pick any nice floral dress pattern.
            4. DIVERSITY: Prefer an image that looks distinct and specific to the search term "${backupSearchTerm}".
            
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
            
            // Se a IA retornar erro ou ID inválido, usa o offset de diversidade
            let bestIndex = decision.bestId !== undefined ? decision.bestId : 0;
            if (!candidates[bestIndex]) bestIndex = 0;
            
            return candidates[bestIndex].url;

        } catch (e) {
            // Fallback com diversidade
            const safeIndex = diversityOffset % Math.min(candidates.length, 3);
            return candidates[safeIndex].url;
        }
    };

    // --- LÓGICA PRINCIPAL ---
    let imageUrl = null;
    
    // 1. TENTATIVA DIRETA (Seletores específicos)
    const html = await fetchHtml(targetUrl);
    if (html) {
        // Seletores otimizados para principais lojas
        const storeSelectors = [
            { domain: 'patternbank', regex: /<img[^>]+class="[^"]*design-image[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'spoonflower', regex: /<img[^>]+class="[^"]*product-image[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'simplicity', regex: /<img[^>]+class="card-image[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'burdastyle', regex: /<img[^>]+class="product-image-photo[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'etsy', regex: /v2-listing-card__img[\s\S]*?src="([^"]+)"/i },
            // Genérico E-commerce (pega a primeira imagem de produto do grid)
            { domain: '', regex: /<img[^>]+src="([^"]+)"[^>]+class="[^"]*(product|item|card|grid)[^"]*"[^>]*>/i }
        ];

        const activeSelector = storeSelectors.find(s => targetUrl.includes(s.domain) && s.domain !== '');
        if (activeSelector) {
            const match = html.match(activeSelector.regex);
            if (match && match[1]) imageUrl = match[1];
        }
        
        // Seletor Genérico se falhar o específico
        if (!imageUrl) {
             const genericMatch = html.match(storeSelectors[storeSelectors.length-1].regex);
             if (genericMatch && genericMatch[1] && !genericMatch[1].includes('logo')) imageUrl = genericMatch[1];
        }
    }

    // 2. FALLBACK PARA BING (Com Diversidade Forçada)
    if ((!imageUrl || imageUrl.includes('logo') || imageUrl.length < 20) && backupSearchTerm) {
        const candidates = await fetchCandidatesFromBing(backupSearchTerm);
        if (candidates.length > 0) {
            // Cálculo do Offset de Diversidade baseado no domínio
            // Ex: "simplicity.com".length = 14 -> offset 2
            // Ex: "etsy.com".length = 8 -> offset 2
            // Ex: "burda".length = 5 -> offset 2
            // Usamos o CharCode do primeiro caractere para variar mais
            let domainHash = 0;
            try { domainHash = new URL(targetUrl).hostname.charCodeAt(0); } catch(e) { domainHash = 1; }
            const diversityOffset = domainHash % 3;

            if (userReferenceImage && apiKey) {
                imageUrl = await selectBestMatchAI(candidates, userReferenceImage, diversityOffset);
            } else {
                // Sem IA: Usa a matemática para escolher imagens diferentes para lojas diferentes
                imageUrl = candidates[diversityOffset % candidates.length].url;
            }
        }
    }

    // Limpeza Final
    if (imageUrl) {
        imageUrl = imageUrl.replace(/&amp;/g, '&');
        if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
        if (imageUrl.includes('etsystatic')) imageUrl = imageUrl.replace('340x270', '794xN');
    }
    
    return imageUrl;
};
