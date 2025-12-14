
// api/modules/surface.js
// DEPARTAMENTO: ESTÚDIO DE DESIGN DE SUPERFÍCIE & TENDÊNCIAS
// RESPONSÁVEL: Diretor de Arte Vingi

export const analyzeSurfaceDesign = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    // 1. ANÁLISE PROFUNDA DE COR, TENDÊNCIA E MOTIVOS
    const ART_DIRECTOR_PROMPT = `
    ACT AS: Senior Textile Art Director & Trend Forecaster.
    TASK: Analyze the uploaded print/pattern to create a HIGH-LEVEL 'Market & Color Strategy'.
    
    1. COLOR ANALYSIS & TRENDS (Pantone TCX):
    - Extract 6 distinct colors.
    - Classify them (Base/Main/Accent/Shadow).
    - Assign a 'trendContext' (e.g., "WGSN S/S 25", "Color of the Year", "Tropical State of Mind").
    - Provide Pantone TCX code.
    
    2. MOTIF & TECHNIQUE BREAKDOWN (CRITICAL):
    - Identify specific motifs (e.g., "Oversized Lilies", "Hibiscus", "Palm Fronds", "Brush Strokes").
    - Identify the ARTISTIC TECHNIQUE (e.g., "Wet-on-wet Watercolor", "Vector Flat Illustration", "Gouache Hand-painted").
    - Identify the TEXTURE FEEL (e.g., "Cotton Canvas", "Silk Sheen", "Linen Texture").
    
    3. VISUAL SEARCH STRATEGY (SAFE SEARCH):
    - Create a search query for marketplaces.
    - IMPORTANT: Ensure the query describes the PATTERN, NOT a person.
    
    4. GENERATION PROMPT (HYPER-REALISTIC):
    - Write a prompt to RECREATE this texture using AI.
    - KEYWORD FOCUS: "Seamless Pattern", "Textile Design", [Technique identified], [Motifs identified].
    - VIBE: "High-end fashion print", "Detailed", "Professional Portfolio".
    - AVOID: "Woman", "Model", "Skin".
    
    OUTPUT JSON:
    { 
        "colors": [
            { "name": "Peach Fuzz", "hex": "#FFBE98", "code": "13-1023 TCX", "role": "Base", "trendContext": "Color of the Year 2024" }
        ], 
        "prompt": "Seamless watercolor pattern featuring oversized yellow lilies and pink hibiscus, wet-on-wet technique, white background, high detail textile design",
        "technicalSpecs": { 
            "technique": "Watercolor/Gouache", 
            "motifs": ["Yellow Lilies", "Pink Hibiscus", "Tropical Leaves"],
            "texture": "Cotton Poplin",
            "vibe": "Tropical Elegance"
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
    const motifs = analysis.technicalSpecs?.motifs ? analysis.technicalSpecs.motifs.join(' ') : '';
    // Termo visual foca em "Swatch" e "Seamless" para garantir flat lay
    const visualBase = `${motifs} seamless pattern swatch`;

    const createStudioLink = (storeName, type, urlBase, specificQuery, visualStyle, boost) => ({
        source: storeName,
        patternName: specificQuery, 
        type,
        linkType: "SEARCH_QUERY", // CRÍTICO: Ativa a busca visual no scraper
        url: `${urlBase}${encodeURIComponent(specificQuery)}`,
        // Backup super específico para garantir imagem plana
        backupSearchTerm: `"${storeName}" ${specificQuery} ${mainColors} ${visualStyle}`, 
        similarityScore: 90 + boost,
        imageUrl: null 
    });

    const matches = [];

    // 1. DIVISÃO TÊXTIL PROFISSIONAL (Visual: Flat Lay / Swatch)
    matches.push(createStudioLink("Patternbank", "PREMIUM", "https://patternbank.com/designs?search=", s.textile_professional, "textile design print flat swatch", 3));
    matches.push(createStudioLink("Designious", "VECTOR", "https://www.designious.com/?s=", s.vector_asset, "vector pack detail", 2));
    matches.push(createStudioLink("Lectra", "TECH", "https://www.lectra.com/search?q=", s.textile_professional, "digital fabric print", 1));

    // 2. DIVISÃO STOCK PHOTO (Visual: Texture Zoom)
    matches.push(createStudioLink("Shutterstock", "STOCK", "https://www.shutterstock.com/search/", s.stock_photo, "seamless pattern vector flat view", 3));
    matches.push(createStudioLink("Adobe Stock", "PRO", "https://stock.adobe.com/search?k=", s.stock_photo, "fabric texture background swatch", 3));
    matches.push(createStudioLink("Freepik", "STOCK", "https://www.freepik.com/search?format=search&query=", s.stock_photo, "seamless pattern vector flat", 2));
    matches.push(createStudioLink("Depositphotos", "STOCK", "https://depositphotos.com/stock-photos/", s.stock_photo, "pattern texture top view", 2));
    matches.push(createStudioLink("Istock", "STOCK", "https://www.istockphoto.com/search/2/image?phrase=", s.stock_photo, "fabric swatch", 2));

    // 3. DIVISÃO POD & TECIDOS (Visual: Printed Fabric)
    matches.push(createStudioLink("Spoonflower", "FABRIC", "https://www.spoonflower.com/en/shop?on=fabric&q=", s.fabric_pod, "printed fabric texture zoom", 3));
    matches.push(createStudioLink("Hawthorne Supply", "MODERN", "https://www.hawthornesupplyco.com/search?q=", s.fabric_pod, "quilting cotton fabric swatch", 2));
    matches.push(createStudioLink("Fabric.com", "RETAIL", "https://www.fabric.com/find?searchText=", s.fabric_pod, "fabric yardage photo", 1));
    matches.push(createStudioLink("Joann", "CRAFT", "https://www.joann.com/search?q=", s.fabric_pod, "fabric bolt photo", 1));
    matches.push(createStudioLink("Mood Fabrics", "LUXE", "https://www.moodfabrics.com/search?q=", s.textile_professional, "silk fabric swatch", 2));

    // 4. DIVISÃO DE ATIVOS & MARKETPLACES (Visual: Digital Paper)
    matches.push(createStudioLink("Creative Market", "INDIE", "https://creativemarket.com/search?q=", s.vector_asset, "digital paper background texture", 2));
    matches.push(createStudioLink("Etsy Digital", "MKT", "https://www.etsy.com/search?q=", s.craft_digital, "digital paper seamless", 2));
    matches.push(createStudioLink("Rawpixel", "ART", "https://www.rawpixel.com/search/", s.vintage_archive, "public domain pattern art cc0", 1));
    matches.push(createStudioLink("Vecteezy", "VECTOR", "https://www.vecteezy.com/free-vector/", s.vector_asset, "vector pattern flat", 1));

    return matches;
};
