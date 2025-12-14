
// api/modules/surface.js
// DEPARTAMENTO: ESTÚDIO DE DESIGN DE SUPERFÍCIE & COLORIMETRIA
// RESPONSÁVEL: Diretor de Arte Vingi

export const analyzeSurfaceDesign = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    // 1. ANÁLISE PROFUNDA DE COR E ESTILO
    const ART_DIRECTOR_PROMPT = `
    ACT AS: Senior Textile Art Director & Colorist.
    TASK: Analyze the uploaded print/pattern to create a comprehensive 'Market & Color Strategy'.
    
    1. COLOR ANALYSIS (PANTONE TCX):
    - Extract 6 distinct colors from the image.
    - Classify them: 'Base' (Background), 'Main' (Dominant Element), 'Secondary' (Details), 'Accent' (Pop of color), 'Shadow' (Dark tones).
    - Provide a plausible Pantone TCX code for each (e.g., "19-4052 TCX").
    
    2. VISUAL SEARCH STRATEGY:
    - We need to find this EXACT style on marketplaces.
    - KEY: You MUST include the DOMINANT COLORS in the search query.
    - Example: Instead of "Tropical floral", use "Mustard Yellow and Fuchsia Tropical Floral".
    
    OUTPUT JSON:
    { 
        "colors": [
            { "name": "Classic Blue", "hex": "#0f4c81", "code": "19-4052 TCX", "role": "Base" },
            { "name": "Living Coral", "hex": "#ff6f61", "code": "16-1546 TCX", "role": "Accent" }
            ... (6 colors total)
        ], 
        "technicalSpecs": { 
            "technique": "Watercolor/Vector/Gouache/Photo", 
            "elements": ["Palm leaf", "Hibiscus", "Geometric"] 
        },
        "marketStrategy": {
            "textile_professional": "Highly specific query for Patternbank (e.g. 'Oversized watercolor floral yellow pink')",
            "fabric_pod": "Fabric-focused query for Spoonflower (e.g. 'Seamless tropical hibiscus mustard background')",
            "vector_asset": "Graphic asset query for Creative Market (e.g. 'Hand-painted tropical vector pack')",
            "vintage_archive": "Historical query (e.g. '1960s floral fabric scan')",
            "craft_digital": "Craft query (e.g. 'Tropical digital paper yellow pink')"
        }
    }
    `;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const visionPayload = {
        contents: [{ parts: [{ text: ART_DIRECTOR_PROMPT }, { inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }] }],
        generation_config: { response_mime_type: "application/json" }
    };

    const visionRes = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(visionPayload) });
    const visionData = await visionRes.json();
    const text = visionData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("O Diretor de Arte não conseguiu analisar a estampa.");
    
    const analysis = JSON.parse(cleanJson(text));
    
    // Fallback de prompt
    if (!analysis.prompt) analysis.prompt = analysis.marketStrategy.textile_professional;
    
    return analysis;
};

export const getSurfaceMarketplaces = (analysis) => {
    const s = analysis.marketStrategy;
    // Extraímos as cores principais para ajudar no "backup search" caso a query principal falhe
    const mainColors = analysis.colors.slice(0, 2).map(c => c.name).join(' ');

    const createStudioLink = (storeName, type, urlBase, specificQuery, visualStyle, boost) => ({
        source: storeName,
        patternName: specificQuery, 
        type,
        linkType: "SEARCH_QUERY",
        url: `${urlBase}${encodeURIComponent(specificQuery)}`,
        // Backup Search: Adiciona as cores explicitamente para garantir realismo
        backupSearchTerm: `"${storeName}" ${specificQuery} ${mainColors} ${visualStyle}`, 
        similarityScore: 90 + boost,
        imageUrl: null 
    });

    const matches = [];

    // 1. DIVISÃO TÊXTIL PROFISSIONAL (Patternbank, Designious)
    matches.push(createStudioLink("Patternbank", "PREMIUM", "https://patternbank.com/designs?search=", s.textile_professional, "textile design print flat", 2));
    matches.push(createStudioLink("Designious", "VECTOR", "https://www.designious.com/?s=", s.vector_asset, "vector pack detail", 1));
    matches.push(createStudioLink("Textile Hive", "ARCHIVE", "https://www.textilehive.com/search?q=", s.vintage_archive, "fabric swatch high res", 1));

    // 2. DIVISÃO POD & TECIDOS (Spoonflower, Raspberry Creek)
    matches.push(createStudioLink("Spoonflower", "FABRIC", "https://www.spoonflower.com/en/shop?on=fabric&q=", s.fabric_pod, "printed fabric texture zoom", 2));
    matches.push(createStudioLink("Raspberry Creek", "US FABRIC", "https://raspberrycreekfabrics.com/search?q=", s.fabric_pod, "fabric print close up", 1));
    matches.push(createStudioLink("Hawthorne Supply", "MODERN", "https://www.hawthornesupplyco.com/search?q=", s.fabric_pod, "quilting cotton fabric swatch", 1));

    // 3. DIVISÃO DE ATIVOS DIGITAIS (Creative Market, Adobe, Freepik)
    matches.push(createStudioLink("Creative Market", "INDIE", "https://creativemarket.com/search?q=", s.vector_asset, "pattern background texture", 2));
    matches.push(createStudioLink("Freepik", "STOCK", "https://www.freepik.com/search?format=search&query=", s.vector_asset, "seamless pattern vector flat", 0));
    matches.push(createStudioLink("Adobe Stock", "PRO", "https://stock.adobe.com/search?k=", s.textile_professional, "fabric texture background", 1));
    matches.push(createStudioLink("Shutterstock", "STOCK", "https://www.shutterstock.com/search/", s.vector_asset, "seamless pattern vector", 0));
    matches.push(createStudioLink("Rawpixel", "ART", "https://www.rawpixel.com/search/", s.vintage_archive, "public domain pattern art cc0", 1));
    
    // 4. DIVISÃO DE ARQUIVO & HISTÓRIA (Museus)
    matches.push(createStudioLink("V&A Museum", "HISTORY", "https://collections.vam.ac.uk/search/?q=", s.vintage_archive, "textile fragment museum", 2));
    matches.push(createStudioLink("The Met", "MUSEUM", "https://www.metmuseum.org/search-results?q=", s.vintage_archive, "pattern design art", 1));

    // 5. DIVISÃO DE ARTESANATO (Etsy)
    matches.push(createStudioLink("Etsy Digital", "MKT", "https://www.etsy.com/search?q=", s.craft_digital, "digital paper seamless", 1));
    matches.push(createStudioLink("Zazzle", "POD", "https://www.zazzle.com/s/", s.craft_digital, "pattern texture", 0));
    matches.push(createStudioLink("Redbubble", "ARTIST", "https://www.redbubble.com/shop/?query=", s.craft_digital, "pattern design artwork", 0));

    return matches;
};
