
// api/modules/surface.js
// ESPECIALIDADE: Design de Estampas

export const analyzeSurfaceDesign = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    const MASTER_VISION_PROMPT = `
    ACT AS: Pantone Color Specialist & Surface Designer.
    TASK: Analyze the pattern style and extract colors.
    
    ANALYZE:
    1. MOTIF: Floral, Geometric, Animal, Abstract.
    2. STYLE: Watercolor, Vector, Vintage, Modern.
    3. COLORS: Identify dominant colors.
    
    COLOR MAPPING RULES:
    - For each color, find the closest PANTONE FASHION, HOME + INTERIORS (TCX) code.
    - Check if it is a "Color of the Year" (COY) from 2020-2025.
    - Provide a "trendStatus" (e.g., "COY 2024", "Classic", "Trending").

    OUTPUT JSON:
    { 
        "prompt": "Generation prompt for this pattern.", 
        "colors": [
            {
                "name": "Viva Magenta", 
                "hex": "#BE3455", 
                "code": "18-1750 TCX", 
                "trendStatus": "COY 2023" 
            }
        ], 
        "technicalSpecs": { "technique": "Vector/Watercolor", "elements": ["Flower"] },
        "searchQuery": "Simple query (e.g. 'Blue floral seamless pattern')"
    }
    `;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const visionPayload = {
        contents: [{ parts: [{ text: MASTER_VISION_PROMPT }, { inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }] }],
        generation_config: { response_mime_type: "application/json" }
    };

    const visionRes = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(visionPayload) });
    const visionData = await visionRes.json();
    const text = visionData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Falha na análise");
    return JSON.parse(cleanJson(text));
};

export const getSurfaceMarketplaces = (analysis) => {
    const baseQuery = analysis.searchQuery;
    
    // Identidade Visual por Marketplace
    const createMarketLink = (storeName, type, urlBase, visualStyle, boost) => ({
        source: storeName,
        patternName: `${analysis.technicalSpecs.elements[0]} Print`, 
        type,
        linkType: "SEARCH_QUERY",
        url: `${urlBase}${encodeURIComponent(baseQuery)}`,
        backupSearchTerm: `"${storeName}" ${baseQuery} ${visualStyle}`, 
        similarityScore: 90 + boost,
        imageUrl: null 
    });

    const matches = [];

    // 1. PREMIUM & STUDIO
    matches.push(createMarketLink("Patternbank", "PREMIUM", "https://patternbank.com/designs?search=", "textile design print close-up", 2));
    matches.push(createMarketLink("Spoonflower", "FABRIC", "https://www.spoonflower.com/en/shop?on=fabric&q=", "printed fabric swatch zoom", 2));
    matches.push(createMarketLink("Designious", "VECTOR", "https://www.designious.com/?s=", "vector pack seamless", 1));

    // 2. STOCK & VETORES
    matches.push(createMarketLink("Creative Market", "INDIE", "https://creativemarket.com/search?q=", "digital paper background texture", 1));
    matches.push(createMarketLink("Rawpixel", "ART", "https://www.rawpixel.com/search/", "public domain pattern art", 1));
    matches.push(createMarketLink("Freepik", "STOCK", "https://www.freepik.com/search?format=search&query=", "seamless vector pattern flat", 0));
    matches.push(createMarketLink("Adobe Stock", "PRO", "https://stock.adobe.com/search?k=", "background texture wallpaper", 0));
    matches.push(createMarketLink("Shutterstock", "STOCK", "https://www.shutterstock.com/search/", "seamless pattern vector", 0));
    
    // 3. HISTÓRICO & REFERÊNCIA
    matches.push(createMarketLink("V&A Museum", "HISTORY", "https://collections.vam.ac.uk/search/?q=", "historical textile fragment", 2));
    matches.push(createMarketLink("Textile Hive", "ARCHIVE", "https://www.textilehive.com/search?q=", "vintage textile swatch", 1));
    matches.push(createMarketLink("Etsy Digital", "MKT", "https://www.etsy.com/search?q=", "digital paper pack", 1));

    return matches;
};
