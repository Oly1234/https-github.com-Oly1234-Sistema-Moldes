
// api/modules/surface.js
// DEPARTAMENTO: ESTÚDIO DE DESIGN DE SUPERFÍCIE
// RESPONSÁVEL: Diretor de Arte Vingi

export const analyzeSurfaceDesign = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    // PROMPT FOCADO EM "GOOGLE LENS" DE TEXTURA
    // Instrução explícita para ignorar o objeto (ex: vestido) e descrever apenas a arte (ex: floral).
    const ART_DIRECTOR_PROMPT = `
    Analyze the PRINT/PATTERN/TEXTURE of this image. IGNORE the object/garment shape.
    
    Output JSON:
    1. "printDescription": Visual description of the ARTWORK ONLY (e.g. "Watercolor tropical floral print seamless").
    2. "colors": Array of 4-5 dominant colors with hex and Pantone name.
    3. "technicalSpecs": { "motifs": ["Flower", "Stripe"], "technique": "Watercolor/Vector", "vibe": "Boho/Modern" }.
    4. "marketQuery": A query to find this TEXTURE FILE on stock sites (e.g. "Seamless watercolor floral pattern swatch").
    `;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const visionPayload = {
        contents: [{ parts: [{ text: ART_DIRECTOR_PROMPT }, { inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }] }],
        generation_config: { response_mime_type: "application/json" }
    };

    const visionRes = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(visionPayload) });
    const visionData = await visionRes.json();
    const text = visionData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("Falha na análise de estampa.");
    
    const analysis = JSON.parse(cleanJson(text));
    
    // Fallback de segurança
    if (!analysis.prompt) analysis.prompt = analysis.printDescription || "Seamless pattern";
    
    return analysis;
};

export const getSurfaceMarketplaces = (analysis) => {
    // A query de mercado gerada pela IA é usada diretamente. 
    // Ela é focada em "Swatch" e "Seamless" para trazer texturas planas.
    const query = analysis.marketQuery || `${analysis.printDescription} seamless pattern`;
    const visualStyle = "flat view texture swatch seamless";

    const createStudioLink = (storeName, type, urlBase, visualBoost) => ({
        source: storeName,
        patternName: query, 
        type,
        linkType: "SEARCH_QUERY", // Ativa busca visual no scraper
        url: `${urlBase}${encodeURIComponent(query)}`,
        // Backup Search Term altamente visual para o Scraper (Google Lens logic)
        backupSearchTerm: `"${storeName}" ${query} ${visualStyle}`, 
        similarityScore: 90 + visualBoost,
        imageUrl: null 
    });

    const matches = [];

    // 1. TÊXTIL & VECTOR (Foco em arquivos)
    matches.push(createStudioLink("Patternbank", "PREMIUM", "https://patternbank.com/designs?search=", 3));
    matches.push(createStudioLink("Spoonflower", "FABRIC", "https://www.spoonflower.com/en/shop?on=fabric&q=", 3));
    matches.push(createStudioLink("Designious", "VECTOR", "https://www.designious.com/?s=", 2));
    
    // 2. STOCK IMAGES (Volume)
    matches.push(createStudioLink("Shutterstock", "STOCK", "https://www.shutterstock.com/search/", 3));
    matches.push(createStudioLink("Adobe Stock", "PRO", "https://stock.adobe.com/search?k=", 3));
    matches.push(createStudioLink("Freepik", "FREE", "https://www.freepik.com/search?format=search&query=", 2));
    matches.push(createStudioLink("Depositphotos", "STOCK", "https://depositphotos.com/stock-photos/", 2));

    // 3. MARKETPLACES
    matches.push(createStudioLink("Etsy Digital", "MKT", "https://www.etsy.com/search?q=", 2));
    matches.push(createStudioLink("Creative Market", "INDIE", "https://creativemarket.com/search?q=", 2));
    matches.push(createStudioLink("Rawpixel", "VINTAGE", "https://www.rawpixel.com/search/", 1));

    return matches;
};
