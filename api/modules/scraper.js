
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

    // SUB-ROTINA: Busca no Bing (Com Inteligência de Domínio)
    const fetchCandidatesFromBing = async (term, specificDomain = null) => {
        if (!term) return [];
        
        let query = term.replace(/sewing pattern/gi, 'pattern').trim();
        
        // NOVA TECNOLOGIA: Busca Dedicada por Site
        // Se tivermos o domínio, forçamos a busca DENTRO dele primeiro
        if (specificDomain) {
            query += ` site:${specificDomain}`;
        }

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

    // SUB-ROTINA: Juiz Visual (IA) - Modo Estrito
    const selectBestMatchAI = async (candidates, userRefImage) => {
        if (!candidates || candidates.length === 0) return null;
        if (!userRefImage || !apiKey) return candidates[0].url;

        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const candidatesText = candidates.map((c, i) => `ID ${i}: ${c.title}`).join('\n');
            
            // PROMPT ATUALIZADO: Foco em "Gêmeo Visual"
            const JUDGE_PROMPT = `
            ACT AS: Strict Visual Curator.
            TASK: Pick the image that is the "Visual Twin" of the User Reference.
            
            INPUT:
            - Reference Image (User's photo)
            - Candidate List (Search results)

            RULES:
            1. LINK DEDICATION: We prefer images that look like they belong to the specific store listed in the title.
            2. VISUAL MATCH: Match the COLOR, SHAPE, and ANGLE of the reference.
            3. IGNORE: Icons, Logos, Text-only images.
            4. PRIORITY: If the reference is a Model wearing a dress, pick a Model wearing a dress. If it's a technical drawing, pick a drawing.
            
            CANDIDATES:
            ${candidatesText}
            
            OUTPUT JSON ONLY: { "bestId": 0 }
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
            
            let bestIndex = decision.bestId !== undefined ? decision.bestId : 0;
            if (!candidates[bestIndex]) bestIndex = 0;
            
            return candidates[bestIndex].url;

        } catch (e) {
            return candidates[0].url;
        }
    };

    // --- LÓGICA PRINCIPAL DO SCRAPER ---
    let imageUrl = null;
    let domain = '';
    try { domain = new URL(targetUrl).hostname; } catch(e) {}

    // 1. TENTATIVA DIRETA (Seletores DOM)
    // ... (Mantido igual para velocidade)
    const html = await fetchHtml(targetUrl);
    if (html) {
        const storeSelectors = [
            { domain: 'patternbank', regex: /<img[^>]+class="[^"]*design-image[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'spoonflower', regex: /<img[^>]+class="[^"]*product-image[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'rawpixel', regex: /<img[^>]+data-src="([^"]+)"[^>]+class="[^"]*image[^"]*"/i },
            { domain: 'freepik', regex: /<img[^>]+src="([^"]+)"[^>]+class="[^"]*loaded[^"]*"/i },
            { domain: 'simplicity', regex: /<img[^>]+class="card-image[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'burdastyle', regex: /<img[^>]+class="product-image-photo[^"]*"[^>]+src="([^"]+)"/i },
            { domain: 'etsy', regex: /v2-listing-card__img[\s\S]*?src="([^"]+)"/i },
            { domain: '', regex: /<img[^>]+src="([^"]+)"[^>]+class="[^"]*(product|item|card|grid)[^"]*"[^>]*>/i }
        ];

        const activeSelector = storeSelectors.find(s => targetUrl.includes(s.domain) && s.domain !== '');
        if (activeSelector) {
            const match = html.match(activeSelector.regex);
            if (match && match[1]) imageUrl = match[1];
        }
        
        if (!imageUrl) {
             const genericMatch = html.match(storeSelectors[storeSelectors.length-1].regex);
             if (genericMatch && genericMatch[1] && !genericMatch[1].includes('logo')) imageUrl = genericMatch[1];
        }
    }

    // 2. FALLBACK INTELIGENTE (Se falhar a direta ou for imagem ruim)
    if ((!imageUrl || imageUrl.includes('logo') || imageUrl.length < 20) && backupSearchTerm) {
        
        // Estratégia A: Busca Dedicada (site:loja.com Termo)
        // Isso garante que a imagem venha DO SITE do link
        let candidates = [];
        if (domain && domain.length > 3 && !domain.includes('google')) {
             candidates = await fetchCandidatesFromBing(backupSearchTerm, domain);
        }

        // Estratégia B: Busca Genérica (Se a dedicada falhar)
        if (candidates.length === 0) {
             candidates = await fetchCandidatesFromBing(backupSearchTerm, null);
        }

        if (candidates.length > 0) {
            if (userReferenceImage && apiKey) {
                // Passamos para a IA escolher a imagem mais parecida com a referência
                imageUrl = await selectBestMatchAI(candidates, userReferenceImage);
            } else {
                // Fallback matemático se não tiver IA
                let domainHash = 0;
                try { domainHash = domain.charCodeAt(0); } catch(e) { domainHash = 1; }
                const diversityOffset = domainHash % candidates.length;
                imageUrl = candidates[diversityOffset].url;
            }
        }
    }

    // Limpeza Final
    if (imageUrl) {
        imageUrl = imageUrl.replace(/&amp;/g, '&');
        if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
        if (imageUrl.includes('etsystatic')) imageUrl = imageUrl.replace('340x270', '794xN');
        if (imageUrl.includes('cdn.shopify.com') && imageUrl.includes('_small')) imageUrl = imageUrl.replace('_small', '_600x600');
    }
    
    return imageUrl;
};
