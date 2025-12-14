
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
    4. VIBE: Vintage, Modern, Boho, Minimalist.

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
    const baseTerm = analysis.patternName; // Ex: Boho Wrap Dress

    // Função que cria uma identidade visual para a busca de backup
    const createStoreLink = (storeName, type, urlBase, visualStyle, boost) => {
        // Estratégia de Termo Único:
        // [Nome da Loja] + [Nome do Molde] + [Estilo Visual Desejado]
        // Ex: "Burda Style Boho Wrap Dress magazine photo"
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

    // 1. EXACT (Marcas Oficiais - Foco em Capas de Envelope e Modelos Reais)
    matches.exact.push(createStoreLink("Simplicity", "USA", "https://simplicity.com/search.php?search_query=", "model wearing dress", 2));
    matches.exact.push(createStoreLink("Burda Style", "GER", "https://www.burdastyle.com/catalogsearch/result/?q=", "magazine model photo", 2));
    matches.exact.push(createStoreLink("Vogue Patterns", "USA", "https://simplicity.com/search.php?search_query=", "fashion photography", 1));
    matches.exact.push(createStoreLink("McCall's", "USA", "https://simplicity.com/search.php?search_query=", "envelope cover model", 1));
    matches.exact.push(createStoreLink("Vikisews", "RU", "https://vikisews.com/search/?q=", "garment photoshoot", 1));

    // 2. CLOSE (Indies e Modernos - Foco em Fotos de Usuários ou Capas Artísticas)
    matches.close.push(createStoreLink("The Fold Line", "UK", "https://thefoldline.com/?s=", "pattern cover", 2));
    matches.close.push(createStoreLink("Tilly and the Buttons", "UK", "https://shop.tillyandthebuttons.com/search?q=", "real person wearing", 1));
    matches.close.push(createStoreLink("Papercut Patterns", "NZ", "https://papercutpatterns.com/search?q=", "model editorial", 1));
    matches.close.push(createStoreLink("Sew Over It", "UK", "https://sewoverit.com/?s=", "finished garment", 1));
    matches.close.push(createStoreLink("Mood Fabrics", "FREE", "https://www.moodfabrics.com/blog/?s=", "sewn garment photo", 1));

    // 3. ADVENTUROUS (Marketplaces - Foco em Variedade)
    matches.adventurous.push(createStoreLink("Etsy", "MKT", "https://www.etsy.com/search?q=", "sewing pattern photo", 1));
    matches.adventurous.push(createStoreLink("Makerist", "EU", "https://www.makerist.com/search?q=", "pattern usage photo", 0));
    matches.adventurous.push(createStoreLink("Lekala", "CAD", "https://www.lekala.co/catalog?q=", "technical drawing garment", -1));
    matches.adventurous.push(createStoreLink("Google Shopping", "WEB", "https://www.google.com/search?tbm=shop&q=", "garment", -2));

    return matches;
};
