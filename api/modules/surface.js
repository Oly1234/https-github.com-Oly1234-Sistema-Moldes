
// api/modules/surface.js
// DEPARTAMENTO: ESTÚDIO DE DESIGN DE SUPERFÍCIE & TENDÊNCIAS
// RESPONSÁVEL: Diretor de Arte Vingi

export const analyzeSurfaceDesign = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    // 1. O DIRETOR DE ARTE ANALISA O ESTILO E DEFINE A ESTRATÉGIA DE MERCADO
    const ART_DIRECTOR_PROMPT = `
    ACT AS: Senior Textile Art Director.
    TASK: Analyze the uploaded print/pattern to define a 'Market Strategy'.
    
    CONTEXT:
    We need to find similar prints on different specialized marketplaces.
    - Patternbank needs professional textile terms (e.g. "Watercolour tropical oversized").
    - Spoonflower needs fabric-ready terms (e.g. "Seamless palm leaf repeating").
    - Creative Market needs asset terms (e.g. "Vector jungle foliage pack").
    - Etsy needs craft terms (e.g. "Digital paper tropical background").

    OUTPUT JSON:
    { 
        "colors": [{"name": "Name", "hex": "#000", "code": "TCX..."}], 
        "technicalSpecs": { "technique": "Watercolor/Vector/Photo", "elements": ["Palm", "Hibiscus"] },
        "marketStrategy": {
            "textile_professional": "Specific query for high-end textile sites (Patternbank)",
            "fabric_pod": "Specific query for POD fabric sites (Spoonflower)",
            "vector_asset": "Specific query for graphic design assets (Creative Market, Freepik)",
            "vintage_archive": "Specific query for historical archives (V&A, Museums)",
            "craft_digital": "Specific query for digital crafters (Etsy)"
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
    
    // Fallback de prompt de geração se não vier (para uso no gerador)
    if (!analysis.prompt) analysis.prompt = analysis.marketStrategy.textile_professional;
    
    return analysis;
};

export const getSurfaceMarketplaces = (analysis) => {
    const s = analysis.marketStrategy;
    
    // Factory de Links do Estúdio
    // Agora cada loja recebe seu termo ESPECÍFICO (s.textile_professional, s.vector_asset, etc)
    // E o título do card reflete essa especificidade, não um nome genérico.
    const createStudioLink = (storeName, type, urlBase, specificQuery, visualStyle, boost) => ({
        source: storeName,
        patternName: specificQuery, // O NOME AGORA É ESPECÍFICO, NÃO GENÉRICO
        type,
        linkType: "SEARCH_QUERY",
        url: `${urlBase}${encodeURIComponent(specificQuery)}`,
        backupSearchTerm: `"${storeName}" ${specificQuery} ${visualStyle}`, 
        similarityScore: 90 + boost,
        imageUrl: null 
    });

    const matches = [];

    // 1. DIVISÃO TÊXTIL PROFISSIONAL (Patternbank, Designious)
    matches.push(createStudioLink("Patternbank", "PREMIUM", "https://patternbank.com/designs?search=", s.textile_professional, "textile design print close-up", 2));
    matches.push(createStudioLink("Designious", "VECTOR", "https://www.designious.com/?s=", s.vector_asset, "vector pack seamless detail", 1));
    matches.push(createStudioLink("Textile Hive", "ARCHIVE", "https://www.textilehive.com/search?q=", s.vintage_archive, "vintage fabric swatch", 1));

    // 2. DIVISÃO POD & TECIDOS (Spoonflower, Raspberry Creek)
    matches.push(createStudioLink("Spoonflower", "FABRIC", "https://www.spoonflower.com/en/shop?on=fabric&q=", s.fabric_pod, "printed fabric swatch zoom", 2));
    matches.push(createStudioLink("Raspberry Creek", "US FABRIC", "https://raspberrycreekfabrics.com/search?q=", s.fabric_pod, "fabric print jersey", 1));
    matches.push(createStudioLink("Hawthorne Supply", "MODERN", "https://www.hawthornesupplyco.com/search?q=", s.fabric_pod, "quilting cotton fabric", 1));

    // 3. DIVISÃO DE ATIVOS DIGITAIS (Creative Market, Adobe, Freepik)
    matches.push(createStudioLink("Creative Market", "INDIE", "https://creativemarket.com/search?q=", s.vector_asset, "digital paper background texture", 2));
    matches.push(createStudioLink("Freepik", "STOCK", "https://www.freepik.com/search?format=search&query=", s.vector_asset, "seamless vector pattern flat", 0));
    matches.push(createStudioLink("Adobe Stock", "PRO", "https://stock.adobe.com/search?k=", s.textile_professional, "background texture wallpaper", 1));
    matches.push(createStudioLink("Shutterstock", "STOCK", "https://www.shutterstock.com/search/", s.vector_asset, "seamless pattern vector", 0));
    matches.push(createStudioLink("Rawpixel", "ART", "https://www.rawpixel.com/search/", s.vintage_archive, "public domain pattern art", 1));
    
    // 4. DIVISÃO DE ARQUIVO & HISTÓRIA (Museus)
    matches.push(createStudioLink("V&A Museum", "HISTORY", "https://collections.vam.ac.uk/search/?q=", s.vintage_archive, "historical textile fragment", 2));
    matches.push(createStudioLink("The Met", "MUSEUM", "https://www.metmuseum.org/search-results?q=", s.vintage_archive, "historical pattern art", 1));

    // 5. DIVISÃO DE ARTESANATO (Etsy)
    matches.push(createStudioLink("Etsy Digital", "MKT", "https://www.etsy.com/search?q=", s.craft_digital, "digital paper pack", 1));
    matches.push(createStudioLink("Zazzle", "POD", "https://www.zazzle.com/s/", s.craft_digital, "printed pattern product", 0));
    matches.push(createStudioLink("Redbubble", "ARTIST", "https://www.redbubble.com/shop/?query=", s.craft_digital, "pattern design product", 0));

    return matches;
};
