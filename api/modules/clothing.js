
// api/modules/clothing.js
// DEPARTAMENTO: ENGENHARIA DE VESTUÁRIO
// RESPONSÁVEL: Diretor Técnico Vingi

export const analyzeClothingDna = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    const DIRECTOR_PROMPT = `
    ACT AS: Senior Technical Fashion Director.
    TASK: Analyze the garment photo to create a specialized 'Visual Search Brief'.
    
    INPUT: User uploaded photo of a garment.
    
    OUTPUT JSON:
    { 
        "patternName": "Technical Name (e.g. 'Milkmaid Mini Dress')", 
        "visualDescription": "Highly descriptive visual text for finding SIMILAR PHOTOS (e.g. 'Woman wearing floral puff sleeve square neck mini dress summer photoshoot')",
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
    // O termo visual agora força "Photo" ou "Model" para garantir que a imagem de preview seja humana
    const visualTerm = (analysis.visualDescription || baseTerm) + " sewing pattern model photo";

    const createLink = (storeName, type, urlBase, visualStyle, boost) => {
        // A chave aqui é o backupSearchTerm ser visualmente rico para o Scraper encontrar uma foto boa
        const highlySpecificSearch = `"${storeName}" ${visualTerm} ${visualStyle}`;
        
        return {
            source: storeName,
            patternName: baseTerm, 
            description: visualTerm, 
            type,
            linkType: "SEARCH_QUERY", // Indica que é uma busca, acionando a lógica visual no scraper
            url: `${urlBase}${encodeURIComponent(baseTerm)}`,
            backupSearchTerm: highlySpecificSearch, 
            similarityScore: 90 + boost,
            imageUrl: null
        };
    };

    const matches = { exact: [], close: [], adventurous: [] };

    // 1. GIGANTES (Big 4 & Commercial)
    matches.exact.push(createLink("Simplicity", "BIG 4", "https://simplicity.com/search.php?search_query=", "pattern envelope model", 3));
    matches.exact.push(createLink("McCall's", "BIG 4", "https://simplicity.com/search.php?search_query=", "sewing pattern wearing", 3));
    matches.exact.push(createLink("Vogue Patterns", "COUTURE", "https://simplicity.com/search.php?search_query=", "high fashion photoshoot", 3));
    matches.exact.push(createLink("Burda Style", "EURO", "https://www.burdastyle.com/catalogsearch/result/?q=", "magazine editorial photo", 3));
    matches.exact.push(createLink("Butterick", "CLASSIC", "https://simplicity.com/search.php?search_query=", "vintage style photo", 2));
    matches.exact.push(createLink("Kwik Sew", "BASIC", "https://simplicity.com/search.php?search_query=", "garment photo", 2));

    // 2. INDIE & MODERN (Alta Qualidade Visual)
    matches.close.push(createLink("Closet Core", "PREMIUM", "https://closetcorepatterns.com/search?q=", "indie pattern photoshoot", 3));
    matches.close.push(createLink("Merchant & Mills", "RUSTIC", "https://merchantandmills.com/?s=", "linen dress photography", 2));
    matches.close.push(createLink("The Assembly Line", "SCANDI", "https://theassemblylineshop.com/search?q=", "minimalist fashion", 2));
    matches.close.push(createLink("Papercut Patterns", "MODERN", "https://papercutpatterns.com/search?q=", "editorial lookbook", 2));
    matches.close.push(createLink("Friday Pattern Co", "FUN", "https://fridaypatterncompany.com/search?q=", "smiling model photo", 2));
    matches.close.push(createLink("Tilly and the Buttons", "BEGINNER", "https://shop.tillyandthebuttons.com/search?q=", "bright sewing photo", 2));
    matches.close.push(createLink("Grainline Studio", "CASUAL", "https://grainlinestudio.com/search?q=", "casual wear photo", 2));
    matches.close.push(createLink("Seamwork", "MAGAZINE", "https://www.seamwork.com/catalog?q=", "lifestyle photography", 2));
    matches.close.push(createLink("True Bias", "URBAN", "https://truebias.com/search?q=", "street style sewing", 2));
    matches.close.push(createLink("Megan Nielsen", "AUSSIE", "https://megannielsen.com/search?q=", "studio photography", 2));

    // 3. MARKETPLACES & ACERVOS GLOBAIS (Volume)
    matches.adventurous.push(createLink("Etsy", "GLOBAL", "https://www.etsy.com/search?q=", "clothing photography listing", 1));
    matches.adventurous.push(createLink("The Fold Line", "DATABASE", "https://thefoldline.com/?s=", "pattern review photo", 1));
    matches.adventurous.push(createLink("Makerist", "EU MKT", "https://www.makerist.com/patterns?q=", "sewing project photo", 1));
    matches.adventurous.push(createLink("SewingPatterns.com", "ARCHIVE", "https://sewingpatterns.com/search?q=", "pattern cover", 1));
    matches.adventurous.push(createLink("Mood Fabrics", "FREE", "https://www.moodfabrics.com/blog/?s=", "sewn garment real photo", 2));
    matches.adventurous.push(createLink("Peppermint Mag", "FREE", "https://peppermintmag.com/?s=", "fashion editorial", 2));
    matches.adventurous.push(createLink("Lekala", "CUSTOM", "https://www.lekala.co/catalog?q=", "technical drawing model", 1));
    matches.adventurous.push(createLink("Amazon Fashion", "RETAIL", "https://www.amazon.com/s?k=", "clothing product shot", 1));
    matches.adventurous.push(createLink("eBay Vintage", "VINTAGE", "https://www.ebay.com/sch/i.html?_nkw=", "vintage envelope photo", 1));
    matches.adventurous.push(createLink("Minerva", "COMMUNITY", "https://www.minerva.com/mp?search=", "community make photo", 1));

    return matches;
};
