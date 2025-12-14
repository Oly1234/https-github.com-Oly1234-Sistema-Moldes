
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

    // SUB-ROTINA: Juiz Visual (IA)
    const selectBestMatchAI = async (candidates, userRefImage, diversityOffset) => {
        if (!candidates || candidates.length === 0) return null;
        
        // Se não tiver chave ou imagem, usa lógica determinística
        if (!userRefImage || !apiKey) {
            const safeIndex = diversityOffset % Math.min(candidates.length, 3);
            return candidates[safeIndex].url;
        }

        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const candidatesText = candidates.map((c, i) => `ID ${i}: ${c.title} (URL: ...)`).join('\n');
            
            // PROMPT REFINADO: Comparação Visual Direta
            const JUDGE_PROMPT = `
            ACT AS: Visual Curator.
            TASK: Compare the User Reference Image with the Candidate Images descriptions/context.
            GOAL: Pick the Candidate ID that visualy resembles the Reference Image the most.
            
            CRITERIA:
            1. SIMILARITY: Must match the motif (e.g., if reference is floral, pick floral).
            2. QUALITY: Avoid low-res logos or icons. Prefer full product/pattern shots.
            3. CONTEXT: If the candidate title describes exactly what is seen in the reference, pick it.
            
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
            const safeIndex = diversityOffset % Math.min(candidates.length, 3);
            return candidates[safeIndex].url;
        }
    };

    // --- LÓGICA PRINCIPAL DO SCRAPER ---
    let imageUrl = null;
    
    // 1. TENTATIVA DIRETA
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

    // 2. FALLBACK COM CURADORIA VISUAL
    if ((!imageUrl || imageUrl.includes('logo') || imageUrl.length < 20) && backupSearchTerm) {
        const candidates = await fetchCandidatesFromBing(backupSearchTerm);
        if (candidates.length > 0) {
            // Se tiver a imagem de referência do usuário, usa a IA para escolher a melhor
            // Isso garante que cada link tenha uma imagem dedicada e próxima da referência
            if (userReferenceImage && apiKey) {
                // Passamos diversityOffset = 0 pois queremos a MELHOR escolha visual, 
                // a diversidade já vem do termo de busca único de cada loja
                imageUrl = await selectBestMatchAI(candidates, userReferenceImage, 0);
            } else {
                let domainHash = 0;
                try { domainHash = new URL(targetUrl).hostname.charCodeAt(0); } catch(e) { domainHash = 1; }
                const diversityOffset = domainHash % 3;
                imageUrl = candidates[diversityOffset % candidates.length].url;
            }
        }
    }

    if (imageUrl) {
        imageUrl = imageUrl.replace(/&amp;/g, '&');
        if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
        if (imageUrl.includes('etsystatic')) imageUrl = imageUrl.replace('340x270', '794xN');
        if (imageUrl.includes('cdn.shopify.com') && imageUrl.includes('_small')) imageUrl = imageUrl.replace('_small', '_600x600');
    }
    
    return imageUrl;
};
