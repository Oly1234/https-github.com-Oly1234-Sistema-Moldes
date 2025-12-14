
// api/modules/surface.js
// ESPECIALIDADE: Design de Estampas, Pantones & Marketplaces Digitais

export const analyzeSurfaceDesign = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    // ANALISADOR TÊXTIL AVANÇADO (ENGENHEIRO TÊXTIL SÊNIOR)
    const MASTER_VISION_PROMPT = `
    ACT AS: Senior Textile Engineer & Surface Designer.
    TASK: Technical Deconstruction of the Uploaded Pattern/Texture.
    
    ANALYZE:
    1. REPEAT SYSTEM: Is it Half-Drop, Block, Brick, Diamond, or Random?
    2. MOTIF SCALE: Large (>20cm), Medium (5-10cm), Small (<5cm), Micro.
    3. DENSITY/COVERAGE: High (Packed), Medium, Low (Sparse/Open Ground).
    4. KEY ELEMENTS: List specific motifs (e.g. 'Watercolor Peony', 'Chevron', 'Paisley').
    5. TECHNIQUE: Vector, Watercolor, Ikat, Screen Print, Digital.
    6. COLORS: Extract up to 5 dominant colors with names and hex codes.
    
    OUTPUT JSON:
    { 
        "prompt": "High-fidelity generation prompt for a Seamless Repeat Pattern matching this style exactly.", 
        "colors": [{"name": "Pantone-ish Name", "hex": "#RRGGBB"}], 
        "technicalSpecs": { 
            "repeat": "Half-Drop/Block/etc", 
            "scale": "Large/Medium/Small", 
            "density": "High/Low",
            "elements": ["Element 1", "Element 2"],
            "technique": "Vector/Watercolor"
        },
        "searchQuery": "Optimized search query for digital pattern marketplaces (e.g. 'Watercolor floral seamless pattern half-drop')"
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
    
    if (!text) throw new Error("Falha na análise da estampa");
    
    return JSON.parse(cleanJson(text));
};

export const getSurfaceMarketplaces = (analysis) => {
    const baseQuery = analysis.searchQuery || `${analysis.technicalSpecs.technique} ${analysis.technicalSpecs.elements[0]} pattern`;
    
    const createMarketLink = (source, type, urlBase, querySuffix, boost) => ({
        source,
        patternName: `${analysis.technicalSpecs.elements[0]} (${type})`, 
        type,
        linkType: "SEARCH_QUERY",
        url: `${urlBase}${encodeURIComponent(baseQuery + " " + querySuffix)}`,
        // Backup termo único para cada marketplace
        backupSearchTerm: `${source} ${baseQuery} seamless pattern texture`, 
        similarityScore: 90 + boost,
        imageUrl: null 
    });

    // MATRIZ DE MARKETPLACES DE DESIGN TÊXTIL (DIGITAL)
    const patternMarketplaces = [
        // Marketplaces Globais (Premium)
        { name: "Patternbank", type: "PREMIUM", url: "https://patternbank.com/designs?search=", suffix: "", boost: 2 },
        { name: "Print Pattern Repeat", type: "STUDIO", url: "https://printpatternrepeat.com/?s=", suffix: "", boost: 1 },
        { name: "Pattern Design", type: "EUROPE", url: "https://patterndesigns.com/en/search/", suffix: "", boost: 0 },
        
        // Marketplaces Independentes & Vetores
        { name: "Creative Market", type: "INDIE", url: "https://creativemarket.com/search?q=", suffix: "seamless pattern", boost: 1 },
        { name: "VectorStock", type: "VETOR", url: "https://www.vectorstock.com/royalty-free-vectors/", suffix: "seamless pattern vector", boost: 0 },
        { name: "Depositphotos", type: "STOCK", url: "https://depositphotos.com/stock-photos/", suffix: "seamless pattern", boost: -1 },
        { name: "Adobe Stock", type: "PRO", url: "https://stock.adobe.com/search?k=", suffix: "seamless pattern", boost: -1 },
        
        // Ferramentas & Freemium
        { name: "Vecteezy", type: "FREE/PAID", url: "https://www.vecteezy.com/free-vector/", suffix: "seamless pattern", boost: -1 },
        { name: "Etsy Digital", type: "DIGITAL", url: "https://www.etsy.com/search?q=", suffix: "digital seamless pattern commercial license", boost: 0 },
        { name: "Spoonflower", type: "FABRIC", url: "https://www.spoonflower.com/en/shop?on=fabric&q=", suffix: "", boost: 0 },
        { name: "Patterncooler", type: "TOOL", url: "https://www.google.com/search?q=site:patterncooler.com+", suffix: "", boost: -5 }
    ];

    return patternMarketplaces.map(store => createMarketLink(store.name, store.type, store.url, store.suffix, store.boost));
};
