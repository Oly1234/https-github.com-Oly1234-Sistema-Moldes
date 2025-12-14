
// api/modules/surface.js
// DEPARTAMENTO: ESTÚDIO DE DESIGN DE SUPERFÍCIE & TENDÊNCIAS
// RESPONSÁVEL: Diretor de Arte Vingi

export const analyzeSurfaceDesign = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    // 1. ANÁLISE PROFUNDA DE COR E TENDÊNCIA
    const ART_DIRECTOR_PROMPT = `
    ACT AS: Senior Textile Art Director & Trend Forecaster.
    TASK: Analyze the uploaded print/pattern to create a comprehensive 'Market & Color Strategy'.
    
    1. COLOR ANALYSIS & TRENDS (Pantone TCX):
    - Extract 6 distinct colors.
    - Classify them (Base/Main/Accent/Shadow).
    - Assign a 'trendContext' (e.g., "WGSN S/S 25", "Color of the Year").
    - Provide Pantone TCX code.
    
    2. VISUAL SEARCH STRATEGY (SAFE SEARCH):
    - Create a search query for marketplaces (Shutterstock, Patternbank).
    - IMPORTANT: Ensure the query describes the PATTERN (e.g., "Watercolor Floral"), NOT a person wearing it.
    - Include dominant colors.
    
    3. GENERATION PROMPT (SAFETY FIRST):
    - Write a prompt to RECREATE this texture using AI.
    - KEYWORD FOCUS: "Seamless Pattern", "Texture", "Vector", "Illustration".
    - AVOID: "Woman", "Model", "Skin", "Body". Focus ONLY on the artwork.
    
    OUTPUT JSON:
    { 
        "colors": [
            { "name": "Peach Fuzz", "hex": "#FFBE98", "code": "13-1023 TCX", "role": "Base", "trendContext": "Color of the Year 2024" }
        ], 
        "prompt": "Safe generation prompt (e.g. 'Seamless vector pattern of tropical hibiscus flowers, yellow and pink, flat illustration')",
        "technicalSpecs": { 
            "technique": "Watercolor/Vector", 
            "elements": ["Palm leaf"] 
        },
        "marketStrategy": {
            "textile_professional": "Patternbank query",
            "fabric_pod": "Spoonflower query",
            "stock_photo": "Shutterstock query",
            "vector_asset": "Creative Market query",
            "vintage_archive": "Museum query",
            "craft_digital": "Etsy query"
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
    
    if (!analysis.prompt) analysis.prompt = analysis.marketStrategy.textile_professional;
    
    return analysis;
};

export const getSurfaceMarketplaces = (analysis) => {
    const s = analysis.marketStrategy;
    const mainColors = analysis.colors.slice(0, 2).map(c => c.name).join(' ');

    const createStudioLink = (storeName, type, urlBase, specificQuery, visualStyle, boost) => ({
        source: storeName,
        patternName: specificQuery, 
        type,
        linkType: "SEARCH_QUERY",
        url: `${urlBase}${encodeURIComponent(specificQuery)}`,
        // Backup com foco em 'texture' para garantir flat lay
        backupSearchTerm: `"${storeName}" ${specificQuery} ${mainColors} ${visualStyle}`, 
        similarityScore: 90 + boost,
        imageUrl: null 
    });

    const matches = [];

    // Prioridade para sites de TEXTURA e não de PRODUTO FINAL
    matches.push(createStudioLink("Patternbank", "PREMIUM", "https://patternbank.com/designs?search=", s.textile_professional, "textile design print flat swatch", 2));
    matches.push(createStudioLink("Shutterstock", "STOCK", "https://www.shutterstock.com/search/", s.stock_photo, "seamless pattern vector flat view", 2));
    matches.push(createStudioLink("Spoonflower", "FABRIC", "https://www.spoonflower.com/en/shop?on=fabric&q=", s.fabric_pod, "printed fabric texture zoom", 2));
    
    matches.push(createStudioLink("Adobe Stock", "PRO", "https://stock.adobe.com/search?k=", s.stock_photo, "fabric texture background swatch", 2));
    matches.push(createStudioLink("Designious", "VECTOR", "https://www.designious.com/?s=", s.vector_asset, "vector pack detail", 1));
    matches.push(createStudioLink("Creative Market", "INDIE", "https://creativemarket.com/search?q=", s.vector_asset, "digital paper background texture", 2));
    
    matches.push(createStudioLink("Hawthorne Supply", "MODERN", "https://www.hawthornesupplyco.com/search?q=", s.fabric_pod, "quilting cotton fabric swatch", 1));
    matches.push(createStudioLink("Etsy Digital", "MKT", "https://www.etsy.com/search?q=", s.craft_digital, "digital paper seamless", 1));
    matches.push(createStudioLink("Rawpixel", "ART", "https://www.rawpixel.com/search/", s.vintage_archive, "public domain pattern art cc0", 1));

    return matches;
};
