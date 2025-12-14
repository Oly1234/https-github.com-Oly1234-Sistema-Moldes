
// api/modules/clothing.js
// DEPARTAMENTO: ENGENHARIA DE VESTUÁRIO
// RESPONSÁVEL: Diretor Técnico Vingi

export const analyzeClothingDna = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    // PROMPT OTIMIZADO PARA VELOCIDADE E DETALHE
    const DIRECTOR_PROMPT = `
    Analyze this garment photo. Return JSON ONLY.
    
    Extract:
    1. "patternName": Precise technical name (e.g. "Bias Cut Slip Dress").
    2. "visualSearchKeywords": A powerful search string combining fabric, length, and key detail (e.g. "Satin midi slip dress cowl neck").
    3. "technicalDna": Details for the user (silhouette, neckline, sleeve, fabric).
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
    // O termo visual agora usa as keywords ricas geradas pela IA
    const visualQuery = analysis.visualSearchKeywords || `${baseTerm} garment`;
    const visualDescription = `${visualQuery} model photoshoot`;

    const createLink = (storeName, type, urlBase, visualStyle, boost, variantSuffix = '') => {
        // Busca altamente específica para evitar desenhos e focar em fotos reais
        const highlySpecificSearch = `"${storeName}" ${visualQuery} ${visualStyle} -drawing -sketch -illustration`;
        
        return {
            source: storeName + (variantSuffix ? ` ${variantSuffix}` : ''),
            patternName: baseTerm, 
            description: visualDescription, 
            type,
            linkType: "SEARCH_QUERY",
            url: `${urlBase}${encodeURIComponent(visualQuery)}`,
            backupSearchTerm: highlySpecificSearch, 
            similarityScore: 90 + boost,
            imageUrl: null
        };
    };

    const matches = { exact: [], close: [], adventurous: [] };

    // 1. GIGANTES (Big 4 & Commercial)
    matches.exact.push(createLink("Simplicity", "BIG 4", "https://simplicity.com/search.php?search_query=", "model wearing pattern", 3));
    matches.exact.push(createLink("McCall's", "BIG 4", "https://simplicity.com/search.php?search_query=", "sewing pattern finished garment", 3));
    matches.exact.push(createLink("Vogue", "COUTURE", "https://simplicity.com/search.php?search_query=", "fashion runway photo", 3));
    matches.exact.push(createLink("Burda", "EURO", "https://www.burdastyle.com/catalogsearch/result/?q=", "magazine editorial photo", 3));
    
    // 2. INDIE & MODERN (Alta Qualidade Visual)
    matches.close.push(createLink("Closet Core", "PREMIUM", "https://closetcorepatterns.com/search?q=", "indie pattern photoshoot", 3));
    matches.close.push(createLink("Merchant & Mills", "RUSTIC", "https://merchantandmills.com/?s=", "linen dress photography", 2));
    matches.close.push(createLink("The Assembly Line", "SCANDI", "https://theassemblylineshop.com/search?q=", "minimalist fashion", 2));
    matches.close.push(createLink("Papercut", "MODERN", "https://papercutpatterns.com/search?q=", "lookbook photo", 2));
    matches.close.push(createLink("Friday Pattern", "FUN", "https://fridaypatterncompany.com/search?q=", "model photoshoot", 2));
    matches.close.push(createLink("Vikisews", "TRENDY", "https://vikisews.com/search/?q=", "fashion editorial", 2));
    matches.close.push(createLink("Reformation", "STYLE", "https://www.google.com/search?tbm=isch&q=site:thereformation.com+", "dress photography", 2)); // Busca estilo

    // 3. MARKETPLACES (Volume e Variedade)
    matches.adventurous.push(createLink("Etsy", "PDF", "https://www.etsy.com/search?q=", "sewing pattern pdf photography", 1, "PDF"));
    matches.adventurous.push(createLink("Etsy", "VINTAGE", "https://www.etsy.com/search?q=", "vintage pattern envelope photo", 1, "Vintage"));
    matches.adventurous.push(createLink("The Fold Line", "DATABASE", "https://thefoldline.com/?s=", "pattern review photo", 1));
    matches.adventurous.push(createLink("Makerist", "EU MKT", "https://www.makerist.com/patterns?q=", "finished project photo", 1));
    matches.adventurous.push(createLink("Mood Fabrics", "FREE", "https://www.moodfabrics.com/blog/?s=", "sewn real garment photo", 2));
    matches.adventurous.push(createLink("Pinterest", "INSPIRATION", "https://www.pinterest.com/search/pins/?q=", "outfit photography", 1));
    matches.adventurous.push(createLink("eBay", "RESALE", "https://www.ebay.com/sch/i.html?_nkw=", "pattern envelope", 1));

    return matches;
};
