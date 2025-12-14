
// api/modules/clothing.js
// ESPECIALIDADE: Engenharia Reversa de Vestuário & Busca de Moldes Físicos/PDF

export const analyzeClothingDna = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    const SEARCH_GEN_PROMPT = `
    ACT AS: Senior Pattern Maker.
    TASK: Analyze the garment to find the exact sewing pattern style.
    
    ANALYSIS REQUIRED:
    1. CATEGORY: Dress, Top, Skirt, Pants, Coat.
    2. KEY FEATURE 1: (e.g. Puff Sleeve, Raglan, Pleated).
    3. KEY FEATURE 2: (e.g. V-Neck, Wrap, Empire Waist).
    4. VIBE: Vintage, Modern, Boho, Minimalist, Utilitarian.

    OUTPUT JSON:
    { 
        "patternName": "Concise Name (e.g. 'Boho Wrap Dress')", 
        "technicalDna": { 
            "silhouette": "...", "neckline": "...", "sleeve": "...", 
            "length": "...", "fit": "...", "fabric": "..." 
        }, 
        "searchQuery": "General search terms (e.g. 'Wrap dress sewing pattern')" 
    }
    `;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const parts = [{ inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }];
    parts.push({ text: SEARCH_GEN_PROMPT });

    const googleResponse = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) });
    const dataMain = await googleResponse.json();
    const text = dataMain.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("Falha na análise visual da roupa");

    const analysis = JSON.parse(cleanJson(text));
    return analysis;
};

export const getClothingStores = (analysis) => {
    const baseTerm = analysis.patternName;

    // Factory de Links com Identidade Visual
    const createStoreLink = (storeName, type, urlBase, visualStyle, boost) => {
        // O termo de backup inclui características visuais da marca para guiar a IA/Bing
        const specificBackupTerm = `"${storeName}" ${baseTerm} sewing pattern ${visualStyle}`;
        
        return {
            source: storeName,
            patternName: baseTerm,
            type,
            linkType: "SEARCH_QUERY",
            url: `${urlBase}${encodeURIComponent(analysis.searchQuery)}`,
            backupSearchTerm: specificBackupTerm, 
            similarityScore: 90 + boost,
            imageUrl: null
        };
    };

    const matches = { exact: [], close: [], adventurous: [] };

    // 1. EXACT: Marcas Comerciais & Tradicionais (Foco: Envelope & Modelo de Estúdio)
    matches.exact.push(createStoreLink("Simplicity", "USA", "https://simplicity.com/search.php?search_query=", "envelope cover", 2));
    matches.exact.push(createStoreLink("Burda Style", "GER", "https://www.burdastyle.com/catalogsearch/result/?q=", "magazine editorial", 2));
    matches.exact.push(createStoreLink("Vogue Patterns", "USA", "https://simplicity.com/search.php?search_query=", "fashion photography high end", 2));
    matches.exact.push(createStoreLink("McCall's", "USA", "https://simplicity.com/search.php?search_query=", "pattern envelope", 1));
    matches.exact.push(createStoreLink("Vikisews", "RU", "https://vikisews.com/search/?q=", "modern minimalism photoshoot", 2));
    matches.exact.push(createStoreLink("Fibre Mood", "BE", "https://www.fibremood.com/en/patterns?search=", "trendy street style", 1));

    // 2. CLOSE: Marcas Indie Premium (Foco: Estilo de Vida & Minimalismo)
    matches.close.push(createStoreLink("Closet Core", "CAN", "https://closetcorepatterns.com/search?q=", "studio photoshoot clean", 2));
    matches.close.push(createStoreLink("Merchant & Mills", "UK", "https://merchantandmills.com/?s=", "rustic linen aesthetic", 2));
    matches.close.push(createStoreLink("The Assembly Line", "SWE", "https://theassemblylineshop.com/search?q=", "scandi minimalist fashion", 2));
    matches.close.push(createStoreLink("Grainline Studio", "USA", "https://grainlinestudio.com/search?q=", "casual modern fit", 1));
    matches.close.push(createStoreLink("Papercut Patterns", "NZ", "https://papercutpatterns.com/search?q=", "sustainable fashion editorial", 1));
    matches.close.push(createStoreLink("Tilly and the Buttons", "UK", "https://shop.tillyandthebuttons.com/search?q=", "colorful cheerful sewing", 1));
    matches.close.push(createStoreLink("True Bias", "USA", "https://truebias.com/search?q=", "urban modern clothing", 1));
    matches.close.push(createStoreLink("Friday Pattern Co", "USA", "https://fridaypatterncompany.com/search?q=", "fun youthful fashion", 1));

    // 3. ADVENTUROUS: Gratuito, Vintage & Marketplaces (Foco: Variedade)
    matches.adventurous.push(createStoreLink("Peppermint Mag", "FREE", "https://peppermintmag.com/?s=", "fashion editorial outdoor", 2));
    matches.adventurous.push(createStoreLink("Mood Fabrics", "FREE", "https://www.moodfabrics.com/blog/?s=", "sewn garment tutorial", 1));
    matches.adventurous.push(createStoreLink("Etsy", "MKT", "https://www.etsy.com/search?q=", "handmade clothing photography", 1));
    matches.adventurous.push(createStoreLink("The Fold Line", "HUB", "https://thefoldline.com/?s=", "pattern cover collage", 1));
    matches.adventurous.push(createStoreLink("Makerist", "EU", "https://www.makerist.com/search?q=", "sewing project photo", 0));
    matches.adventurous.push(createStoreLink("Vintage Patterns", "RETRO", "https://www.google.com/search?tbm=isch&q=site:vintagepatterns.wikia.com+", "illustration vintage drawing", 0));
    matches.adventurous.push(createStoreLink("Lekala", "CAD", "https://www.lekala.co/catalog?q=", "technical line drawing", -1));
    matches.adventurous.push(createStoreLink("Dr. Cos", "COS", "https://dr-cos.info/?s=", "cosplay costume guide", -1));

    return matches;
};
