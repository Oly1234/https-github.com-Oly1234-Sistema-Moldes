
// api/modules/clothing.js
// DEPARTAMENTO: ENGENHARIA DE VESTUÁRIO
// RESPONSÁVEL: Diretor Técnico Vingi

export const analyzeClothingDna = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    // PROMPT DE ALTA PRECISÃO TÉCNICA
    // O objetivo é encontrar o MOLDE, não a roupa pronta.
    const DIRECTOR_PROMPT = `
    Analyze this garment photo. Act as a Technical Pattern Maker.
    
    TASK: Extract technical keywords to find the SEWING PATTERN.
    
    OUTPUT JSON ONLY:
    1. "patternName": The specific industry name (e.g., "Milkmaid Dress", "Paperbag Waist Trousers", "Boxy Camp Collar Shirt").
    2. "hunterQuery": A specific search string to find the PATTERN ENVELOPE or FINISHED MAKE. Combine: Style Name + Key Detail + "Sewing Pattern". (e.g. "Puff sleeve milkmaid dress sewing pattern").
    3. "technicalDna": {
        "silhouette": "...",
        "neckline": "...",
        "details": "..."
    }
    `;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const parts = [{ inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }];
    parts.push({ text: DIRECTOR_PROMPT });

    const googleResponse = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) });
    const dataMain = await googleResponse.json();
    const text = dataMain.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("Falha na análise visual.");

    const analysis = JSON.parse(cleanJson(text));
    return analysis;
};

export const getClothingStores = (analysis) => {
    const baseTerm = analysis.patternName;
    // Hunter Query: O termo exato para caçar o molde
    const hunterQuery = analysis.hunterQuery || `${baseTerm} sewing pattern`;
    
    // Termo Visual: Focado em encontrar a foto da CAPA do molde ou peça pronta bem feita
    const visualDescription = `${hunterQuery} model photo`;

    const createLink = (storeName, type, urlBase, visualStyle, boost, variantSuffix = '') => {
        // Busca Visual no Scraper:
        // Ex: "McCall's" "Milkmaid Dress Sewing Pattern" "Model Photo"
        const highlySpecificSearch = `"${storeName}" ${hunterQuery} ${visualStyle} -drawing -sketch`;
        
        // URL de Busca:
        // Usamos o 'hunterQuery' para garantir que a busca no site (Etsy/Simplicity) seja específica
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
    matches.exact.push(createLink("Simplicity", "BIG 4", "https://simplicity.com/search.php?search_query=", "pattern envelope model", 3));
    matches.exact.push(createLink("McCall's", "BIG 4", "https://simplicity.com/search.php?search_query=", "sewing pattern finished garment", 3));
    matches.exact.push(createLink("Vogue", "COUTURE", "https://simplicity.com/search.php?search_query=", "runway fashion photo", 3));
    matches.exact.push(createLink("Burda", "EURO", "https://www.burdastyle.com/catalogsearch/result/?q=", "magazine editorial photo", 3));
    
    // 2. INDIE & MODERN (Alta Qualidade Visual)
    matches.close.push(createLink("Closet Core", "PREMIUM", "https://closetcorepatterns.com/search?q=", "indie pattern photoshoot", 3));
    matches.close.push(createLink("The Assembly Line", "SCANDI", "https://theassemblylineshop.com/search?q=", "minimalist fashion photography", 2));
    matches.close.push(createLink("Papercut", "MODERN", "https://papercutpatterns.com/search?q=", "lookbook photo", 2));
    matches.close.push(createLink("Friday Pattern", "FUN", "https://fridaypatterncompany.com/search?q=", "model photoshoot", 2));
    matches.close.push(createLink("Vikisews", "TRENDY", "https://vikisews.com/search/?q=", "fashion editorial", 2));
    
    // 3. MARKETPLACES (Volume e Variedade)
    // Forçamos "Sewing Pattern" na busca do Etsy para não vir roupa pronta
    matches.adventurous.push(createLink("Etsy", "PDF", "https://www.etsy.com/search?q=", "sewing pattern pdf photography", 1, "PDF"));
    matches.adventurous.push(createLink("Etsy", "VINTAGE", "https://www.etsy.com/search?q=", "vintage pattern envelope photo", 1, "Vintage"));
    matches.adventurous.push(createLink("The Fold Line", "DATABASE", "https://thefoldline.com/?s=", "pattern review photo", 1));
    matches.adventurous.push(createLink("Makerist", "EU MKT", "https://www.makerist.com/patterns?q=", "finished project photo", 1));
    matches.adventurous.push(createLink("Mood Fabrics", "FREE", "https://www.moodfabrics.com/blog/?s=", "sewn real garment photo", 2));

    return matches;
};
