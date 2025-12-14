
// api/modules/surface.js
// ESPECIALIDADE: Design de Estampas

export const analyzeSurfaceDesign = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    const MASTER_VISION_PROMPT = `
    ACT AS: Surface Designer.
    TASK: Analyze the pattern style.
    
    ANALYZE:
    1. MOTIF: Floral, Geometric, Animal, Abstract.
    2. STYLE: Watercolor, Vector, Vintage, Modern.
    3. COLORS: Dominant colors.

    OUTPUT JSON:
    { 
        "prompt": "Generation prompt for this pattern.", 
        "colors": [{"name": "Color", "hex": "#000"}], 
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
        // Backup Term força imagens diferentes: Spoonflower mostra tecido, Creative Market mostra arte digital
        backupSearchTerm: `"${storeName}" ${baseQuery} ${visualStyle}`, 
        similarityScore: 90 + boost,
        imageUrl: null 
    });

    const matches = [];

    // Foco em Arte Digital Limpa
    matches.push(createMarketLink("Patternbank", "PREMIUM", "https://patternbank.com/designs?search=", "textile design print close-up", 2));
    matches.push(createMarketLink("Creative Market", "INDIE", "https://creativemarket.com/search?q=", "digital paper background texture", 1));
    matches.push(createMarketLink("Shutterstock", "STOCK", "https://www.shutterstock.com/search/", "seamless pattern vector flat", 0));
    
    // Foco em Tecido Real / Textura
    matches.push(createMarketLink("Spoonflower", "FABRIC", "https://www.spoonflower.com/en/shop?on=fabric&q=", "printed fabric swatch zoom", 1));
    matches.push(createMarketLink("Etsy Digital", "MKT", "https://www.etsy.com/search?q=", "digital paper pack", 1));
    matches.push(createMarketLink("Adobe Stock", "PRO", "https://stock.adobe.com/search?k=", "background texture wallpaper", 0));

    return matches;
};
