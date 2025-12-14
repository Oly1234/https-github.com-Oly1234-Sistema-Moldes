
// api/modules/clothing.js
// DEPARTAMENTO: ENGENHARIA DE VESTUÁRIO
// RESPONSÁVEL: Diretor Técnico Vingi

export const analyzeClothingDna = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    // PROMPT DE ALTA PRECISÃO TÉCNICA COM GROUNDING
    const DIRECTOR_PROMPT = `
    ACT AS: Technical Pattern Maker & Fashion Historian.
    
    CONTEXT: The user uploaded a photo of a garment. You must find the REAL, EXISTING sewing pattern for it.
    
    TOOL USE: Use Google Search to verify if the pattern exists (e.g., check if "McCall's 7974" actually matches the visual).
    
    TASK: 
    1. Identify the garment structure (Silhouette, Neckline, Sleeves).
    2. Search for the specific commercial pattern name (e.g. "Simplicity 8555", "The Assembly Line Cuff Top").
    3. Generate a "Hunter Query" optimized for finding the PATTERN ENVELOPE image.
    
    OUTPUT JSON ONLY:
    {
        "patternName": "The specific commercial name found (e.g. 'Vogue V9075')",
        "hunterQuery": "The best search query to see the pattern envelope (e.g. 'Vogue V9075 sewing pattern envelope')",
        "technicalDna": {
            "silhouette": "...",
            "neckline": "...",
            "details": "..."
        }
    }
    `;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const payload = {
        contents: [{ 
            parts: [
                { text: DIRECTOR_PROMPT },
                { inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }
            ] 
        }],
        tools: [{ googleSearch: {} }], // ATIVAÇÃO DO GROUNDING (Search Real)
        generation_config: { response_mime_type: "application/json" }
    };

    try {
        const googleResponse = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const dataMain = await googleResponse.json();
        
        // Verifica se a busca foi usada
        const groundingMetadata = dataMain.candidates?.[0]?.groundingMetadata;
        
        const text = dataMain.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) throw new Error("Falha na análise visual.");

        const analysis = JSON.parse(cleanJson(text));
        
        // Se o Grounding achou algo relevante, podemos injetar nos metadados (opcional, aqui mantemos o foco no JSON)
        return analysis;

    } catch (e) {
        console.error("Clothing Dept Error:", e);
        // Fallback se o Grounding falhar (tenta sem tools ou devolve erro genérico)
        throw new Error("Erro na análise de engenharia: " + e.message);
    }
};

export const getClothingStores = (analysis) => {
    const baseTerm = analysis.patternName;
    // Hunter Query: O termo exato para caçar o molde
    const hunterQuery = analysis.hunterQuery || `${baseTerm} sewing pattern`;
    
    // Termo Visual: Focado em encontrar a foto da CAPA do molde ou peça pronta bem feita
    // Adicionamos "photoshoot" ou "envelope" para guiar o scraper de imagem
    const visualDescription = `${hunterQuery} envelope model photo`;

    const createLink = (storeName, type, urlBase, suffix, boost, variantSuffix = '') => {
        // Busca Visual no Scraper (Inversão de Fluxo):
        // A query visual deve ser extremamente específica para o Proxy do Bing achar a imagem certa de primeira.
        // Ex: "Simplicity 8555 sewing pattern envelope"
        const highlySpecificSearch = `${baseTerm} ${storeName} sewing pattern ${variantSuffix} -drawing`.trim();
        
        // URL de Busca (Navegação do Usuário):
        const searchUrl = `${urlBase}${encodeURIComponent(hunterQuery + ' ' + variantSuffix)}`;
        
        return {
            source: storeName + (variantSuffix ? ` ${variantSuffix}` : ''),
            patternName: baseTerm, 
            description: visualDescription, 
            type,
            linkType: "SEARCH_QUERY",
            url: searchUrl,
            backupSearchTerm: highlySpecificSearch, 
            similarityScore: 90 + boost,
            imageUrl: null
        };
    };

    const matches = { exact: [], close: [], adventurous: [] };

    // 1. GIGANTES (Big 4 & Commercial)
    matches.exact.push(createLink("Simplicity", "BIG 4", "https://simplicity.com/search.php?search_query=", "pattern envelope", 3));
    matches.exact.push(createLink("McCall's", "BIG 4", "https://simplicity.com/search.php?search_query=", "sewing pattern", 3));
    matches.exact.push(createLink("Vogue", "COUTURE", "https://simplicity.com/search.php?search_query=", "runway pattern", 3));
    matches.exact.push(createLink("Burda", "EURO", "https://www.burdastyle.com/catalogsearch/result/?q=", "magazine photo", 3));
    
    // 2. INDIE & MODERN (Alta Qualidade Visual)
    matches.close.push(createLink("Closet Core", "PREMIUM", "https://closetcorepatterns.com/search?q=", "indie pattern", 3));
    matches.close.push(createLink("The Assembly Line", "SCANDI", "https://theassemblylineshop.com/search?q=", "minimalist pattern", 2));
    matches.close.push(createLink("Papercut", "MODERN", "https://papercutpatterns.com/search?q=", "lookbook", 2));
    matches.close.push(createLink("Vikisews", "TRENDY", "https://vikisews.com/search/?q=", "editorial", 2));
    
    // 3. MARKETPLACES
    matches.adventurous.push(createLink("Etsy", "PDF", "https://www.etsy.com/search?q=", "sewing pattern pdf", 1, "PDF"));
    matches.adventurous.push(createLink("Etsy", "VINTAGE", "https://www.etsy.com/search?q=", "vintage pattern", 1, "Vintage"));
    matches.adventurous.push(createLink("The Fold Line", "DATABASE", "https://thefoldline.com/?s=", "review", 1));
    matches.adventurous.push(createLink("Mood Fabrics", "FREE", "https://www.moodfabrics.com/blog/?s=", "free pattern", 2));

    return matches;
};
