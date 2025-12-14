
// api/modules/clothing.js
// DEPARTAMENTO: ENGENHARIA DE VESTUÁRIO
// RESPONSÁVEL: Diretor Técnico Vingi

export const analyzeClothingDna = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    const DIRECTOR_PROMPT = `
    ACT AS: Senior Technical Fashion Director.
    TASK: Analyze the garment photo to create a specialized 'Visual Search Brief' to find REAL SEWN EXAMPLES.
    
    INPUT: User uploaded photo of a garment.
    
    OUTPUT JSON:
    { 
        "patternName": "Specific Technical Name (e.g. 'Milkmaid Puff Sleeve Mini Dress')", 
        "visualDescription": "Visual keywords focused on the FINISHED GARMENT PHOTO (e.g. 'Woman wearing square neck puff sleeve dress, studio photography, white background, realistic')",
        "technicalDna": { 
            "silhouette": "...", "neckline": "...", "sleeve": "...", 
            "length": "...", "fit": "...", "fabric": "..." 
        }
    }
    `;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const parts = [{ inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }];
    parts.push({ text: DIRECTOR_PROMPT });

    const googleResponse = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) });
    const dataMain = await googleResponse.json();
    const text = dataMain.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("O Diretor Técnico não conseguiu analisar a imagem.");

    const analysis = JSON.parse(cleanJson(text));
    return analysis;
};

export const getClothingStores = (analysis) => {
    const baseTerm = analysis.patternName;
    // CRÍTICO: Força a busca por "Finished Garment" ou "Sewn" para evitar envelopes desenhados
    const visualTerm = `${analysis.patternName} sewn garment model photo`;

    const createLink = (storeName, type, urlBase, visualStyle, boost) => {
        // A busca de backup agora é extremamente específica para fotografia real
        const highlySpecificSearch = `"${storeName}" ${baseTerm} ${visualStyle} -drawing -illustration -sketch`;
        
        return {
            source: storeName,
            patternName: baseTerm, 
            description: visualTerm, 
            type,
            linkType: "SEARCH_QUERY",
            url: `${urlBase}${encodeURIComponent(baseTerm)}`,
            backupSearchTerm: highlySpecificSearch, 
            similarityScore: 90 + boost,
            imageUrl: null
        };
    };

    const matches = { exact: [], close: [], adventurous: [] };

    // 1. GIGANTES (Big 4 & Commercial) - Foco em "Model"
    matches.exact.push(createLink("Simplicity", "BIG 4", "https://simplicity.com/search.php?search_query=", "model wearing pattern photo", 3));
    matches.exact.push(createLink("McCall's", "BIG 4", "https://simplicity.com/search.php?search_query=", "finished garment photography", 3));
    matches.exact.push(createLink("Vogue Patterns", "COUTURE", "https://simplicity.com/search.php?search_query=", "runway style photo", 3));
    matches.exact.push(createLink("Burda Style", "EURO", "https://www.burdastyle.com/catalogsearch/result/?q=", "magazine editorial model photo", 3));
    matches.exact.push(createLink("Butterick", "CLASSIC", "https://simplicity.com/search.php?search_query=", "classic dress model photo", 2));

    // 2. INDIE & MODERN (Alta Qualidade Visual) - Foco em "Photoshoot"
    matches.close.push(createLink("Closet Core", "PREMIUM", "https://closetcorepatterns.com/search?q=", "indie pattern photoshoot real", 3));
    matches.close.push(createLink("Merchant & Mills", "RUSTIC", "https://merchantandmills.com/?s=", "linen dress photography professional", 2));
    matches.close.push(createLink("The Assembly Line", "SCANDI", "https://theassemblylineshop.com/search?q=", "minimalist fashion photography", 2));
    matches.close.push(createLink("Papercut Patterns", "MODERN", "https://papercutpatterns.com/search?q=", "editorial lookbook photo", 2));
    matches.close.push(createLink("Friday Pattern Co", "FUN", "https://fridaypatterncompany.com/search?q=", "model smiling photoshoot", 2));
    matches.close.push(createLink("Tilly and the Buttons", "BEGINNER", "https://shop.tillyandthebuttons.com/search?q=", "bright sewing blog photo", 2));
    matches.close.push(createLink("Seamwork", "MAGAZINE", "https://www.seamwork.com/catalog?q=", "lifestyle photography woman", 2));
    matches.close.push(createLink("True Bias", "URBAN", "https://truebias.com/search?q=", "street style sewing photo", 2));

    // 3. MARKETPLACES & ACERVOS GLOBAIS (Volume) - Foco em "Product Shot"
    matches.adventurous.push(createLink("Etsy", "GLOBAL", "https://www.etsy.com/search?q=", "clothing photography listing", 1));
    matches.adventurous.push(createLink("The Fold Line", "DATABASE", "https://thefoldline.com/?s=", "pattern review photo user", 1));
    matches.adventurous.push(createLink("Makerist", "EU MKT", "https://www.makerist.com/patterns?q=", "sewing project photo finished", 1));
    matches.adventurous.push(createLink("Mood Fabrics", "FREE", "https://www.moodfabrics.com/blog/?s=", "sewn garment real photo blog", 2));
    matches.adventurous.push(createLink("Amazon Fashion", "RETAIL", "https://www.amazon.com/s?k=", "clothing product shot white background", 1));
    matches.adventurous.push(createLink("Minerva", "COMMUNITY", "https://www.minerva.com/mp?search=", "fabric dress make photo", 1));

    return matches;
};
