
// api/modules/clothing.js
// DEPARTAMENTO: ENGENHARIA DE VESTUÁRIO & COMPRAS TÉCNICAS
// RESPONSÁVEL: Diretor Técnico Vingi

export const analyzeClothingDna = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    // 1. O DIRETOR TÉCNICO ANALISA A PEÇA
    const DIRECTOR_PROMPT = `
    ACT AS: Senior Technical Fashion Director.
    TASK: Analyze the garment photo to create a specialized 'Pattern Buying Brief'.
    
    VISUAL DNA EXTRACTION:
    - Look at the Reference Image specifically.
    - Describe the PRINT/FABRIC visually (e.g., "Red large scale floral", "Blue geometric", "Solid white linen").
    - Describe the CUT accurately (e.g., "Puff sleeve milkmaid dress", "Wide leg pleated trousers").
    
    OUTPUT JSON:
    { 
        "patternName": "Technical Name (e.g. 'Milkmaid Mini Dress')", 
        "visualDescription": "Specific visual description for search (e.g. 'Floral puff sleeve square neck mini dress pattern')",
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
    // 2. O COMPRADOR (BUYER) EXECUTA A BUSCA GLOBAL
    // Ele usa a "visualDescription" para encontrar gêmeos visuais, não apenas o nome técnico.
    const baseTerm = analysis.patternName;
    const visualTerm = analysis.visualDescription || baseTerm;

    const createLink = (storeName, type, urlBase, visualStyle, boost) => {
        // Truque de Mestre: O termo de backup combina a loja + o visual exato da foto
        // Isso ajuda o Scraper a achar a imagem certa dentro do site
        const highlySpecificSearch = `"${storeName}" ${visualTerm} sewing pattern ${visualStyle}`;
        
        return {
            source: storeName,
            patternName: baseTerm, // Nome Técnico (Exibido)
            description: visualTerm, // Contexto Visual (Usado pelo Scraper)
            type,
            linkType: "SEARCH_QUERY",
            url: `${urlBase}${encodeURIComponent(visualTerm)}`,
            backupSearchTerm: highlySpecificSearch, 
            similarityScore: 90 + boost,
            imageUrl: null
        };
    };

    const matches = { exact: [], close: [], adventurous: [] };

    // --- SETOR A: BIG 4 & COMMERCIAL (Estúdio) ---
    matches.exact.push(createLink("Simplicity", "BIG 4", "https://simplicity.com/search.php?search_query=", "envelope cover", 2));
    matches.exact.push(createLink("McCall's", "BIG 4", "https://simplicity.com/search.php?search_query=", "pattern envelope", 2));
    matches.exact.push(createLink("Vogue Patterns", "COUTURE", "https://simplicity.com/search.php?search_query=", "high fashion model", 2));
    matches.exact.push(createLink("Butterick", "CLASSIC", "https://simplicity.com/search.php?search_query=", "retro envelope", 1));
    matches.exact.push(createLink("Burda Style", "EURO", "https://www.burdastyle.com/catalogsearch/result/?q=", "magazine editorial", 2));
    matches.exact.push(createLink("Know Me", "INDIE-COLLAB", "https://simplicity.com/search.php?search_query=", "modern street style", 1));
    matches.exact.push(createLink("New Look", "EASY", "https://simplicity.com/search.php?search_query=", "simple garment photo", 1));
    matches.exact.push(createLink("Kwik Sew", "BASIC", "https://simplicity.com/search.php?search_query=", "activewear photo", 0));

    // --- SETOR B: INDIE DARLINGS (Estilo de Vida) ---
    matches.close.push(createLink("Closet Core", "PREMIUM", "https://closetcorepatterns.com/search?q=", "studio photoshoot clean", 2));
    matches.close.push(createLink("Merchant & Mills", "RUSTIC", "https://merchantandmills.com/?s=", "linen fabric aesthetic", 2));
    matches.close.push(createLink("The Assembly Line", "SCANDI", "https://theassemblylineshop.com/search?q=", "minimalist fashion", 2));
    matches.close.push(createLink("Papercut Patterns", "MODERN", "https://papercutpatterns.com/search?q=", "eco fashion editorial", 2));
    matches.close.push(createLink("Friday Pattern Co", "FUN", "https://fridaypatterncompany.com/search?q=", "cheerful model pose", 2));
    matches.close.push(createLink("Grainline Studio", "CASUAL", "https://grainlinestudio.com/search?q=", "everyday wear photo", 1));
    matches.close.push(createLink("Tilly and the Buttons", "BEGINNER", "https://shop.tillyandthebuttons.com/search?q=", "bright colorful studio", 1));
    matches.close.push(createLink("True Bias", "URBAN", "https://truebias.com/search?q=", "city lifestyle photo", 1));
    matches.close.push(createLink("Helen's Closet", "COMFY", "https://helensclosetpatterns.com/?s=", "comfortable clothing fit", 1));
    matches.close.push(createLink("Megan Nielsen", "AUSSIE", "https://megannielsen.com/search?q=", "professional model studio", 1));
    matches.close.push(createLink("Named Clothing", "FINNISH", "https://www.namedclothing.com/search?q=", "edgy fashion cut", 1));
    matches.close.push(createLink("Sew House Seven", "OUTDOOR", "https://sewhouse7.com/search?q=", "natural light photography", 1));
    matches.close.push(createLink("I AM Patterns", "FRENCH", "https://iampatterns.fr/en/?s=", "chic french style", 1));
    matches.close.push(createLink("Vikisews", "RUSSIAN", "https://vikisews.com/search/?q=", "high end minimalism", 2));
    matches.close.push(createLink("Fibre Mood", "TRENDY", "https://www.fibremood.com/en/patterns?search=", "street style trend", 2));
    matches.close.push(createLink("Seamwork", "SUBSCRIPTION", "https://www.seamwork.com/catalog?q=", "lifestyle sewing photo", 1));
    matches.close.push(createLink("Cashmerette", "CURVY", "https://cashmerette.com/search?q=", "plus size model studio", 2));
    matches.close.push(createLink("Deer and Doe", "FRENCH", "https://shop.deer-and-doe.fr/en/search?controller=search&s=", "romantic sewing pattern", 1));

    // --- SETOR C: MARKETPLACES & DISCOVERY (Aventureiro) ---
    matches.adventurous.push(createLink("Etsy", "GLOBAL MARKET", "https://www.etsy.com/search?q=", "handmade clothing photo", 1));
    matches.adventurous.push(createLink("The Fold Line", "DATABASE", "https://thefoldline.com/?s=", "pattern catalog collage", 1));
    matches.adventurous.push(createLink("Makerist", "EU MARKET", "https://www.makerist.com/search?q=", "sewing project flatlay", 0));
    matches.adventurous.push(createLink("Mood Fabrics", "FREE", "https://www.moodfabrics.com/blog/?s=", "fashion illustration sketch", 1));
    matches.adventurous.push(createLink("Peppermint Mag", "FREE", "https://peppermintmag.com/?s=", "magazine editorial outdoor", 1));
    matches.adventurous.push(createLink("Fabrics-Store", "FREE LINEN", "https://blog.fabrics-store.com/?s=", "linen dress tutorial", 0));
    matches.adventurous.push(createLink("Lekala", "CUSTOM FIT", "https://www.lekala.co/catalog?q=", "technical line drawing", -1));
    matches.adventurous.push(createLink("Bootstrap Fashion", "MADE TO MEASURE", "https://bootstrapfashion.com/catalogsearch/result/?q=", "3d garment render", -1));
    matches.adventurous.push(createLink("Vintage Pattern Wiki", "ARCHIVE", "https://vintagepatterns.wikia.com/wiki/Special:Search?query=", "vintage illustration scan", 0));
    matches.adventurous.push(createLink("eBay", "SECOND HAND", "https://www.ebay.com/sch/i.html?_nkw=", "vintage envelope photo", -1));
    matches.adventurous.push(createLink("Amazon Patterns", "RETAIL", "https://www.amazon.com/s?k=", "product package shot", -1));
    matches.adventurous.push(createLink("Minerva", "COMMUNITY", "https://www.minerva.com/mp?search=", "user made garment selfie", 0));
    matches.adventurous.push(createLink("Something Delightful", "CONGLOMERATE", "https://somethingdelightful.com/search.php?search_query=", "sewing pattern envelope", 0));
    matches.adventurous.push(createLink("Style Arc", "INDUSTRY", "https://www.stylearc.com/?s=", "technical fashion sketch", 0));

    return matches;
};
