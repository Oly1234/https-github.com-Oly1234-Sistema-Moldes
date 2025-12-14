
// api/modules/clothing.js
// ESPECIALIDADE: Engenharia Reversa de Vestuário & Busca de Moldes Físicos/PDF

export const analyzeClothingDna = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    const SEARCH_GEN_PROMPT = `
    ACT AS: Senior Pattern Maker & Garment Technologist.
    TASK: Analyze the garment image to find the exact sewing pattern available for purchase.
    
    ANALYSIS REQUIRED:
    1. SILHOUETTE: (e.g., A-line, Sheath, Wrap, Empire).
    2. NECKLINE: (e.g., V-neck, Boat, Cowl, Sweetheart).
    3. SLEEVE: (e.g., Raglan, Set-in, Bishop, Cap).
    4. LENGTH: (e.g., Mini, Midi, Maxi, Floor).
    5. FABRIC SUGGESTION: (e.g., Chiffon, Heavy Cotton, Jersey).
    6. COMPLEXITY: Beginner, Intermediate, Advanced.

    OUTPUT JSON:
    { 
        "patternName": "Technical Name (e.g. 'Wrap Dress with Bishop Sleeves')", 
        "category": "Dress/Top/Pants",
        "technicalDna": { 
            "silhouette": "...", "neckline": "...", "sleeve": "...", 
            "length": "...", "fit": "...", "fabric": "..." 
        }, 
        "searchQuery": "Optimized English query for pattern shops (e.g. 'Boho wrap dress sewing pattern pdf')" 
    }
    `;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const parts = [{ inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }];
    parts.push({ text: SEARCH_GEN_PROMPT });

    const googleResponse = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) });
    const dataMain = await googleResponse.json();
    const text = dataMain.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("Falha na análise visual da roupa");

    const analysis = JSON.parse(cleanJson(text));
    return analysis;
};

export const getClothingStores = (analysis) => {
    const mainQuery = analysis.searchQuery || `${analysis.patternName} sewing pattern`;
    const shortName = analysis.patternName;

    // Função de criação de link com termo de backup ÚNICO para cada loja
    const createRealLink = (source, type, urlBase, termQuery, score) => ({
        source, 
        patternName: shortName, 
        type, 
        linkType: "SEARCH_QUERY",
        url: `${urlBase}${encodeURIComponent(termQuery)}`,
        // Backup Term inclui o NOME DA LOJA para forçar imagens diferentes no Bing
        backupSearchTerm: `${source} ${termQuery} sewing pattern cover`, 
        similarityScore: score, 
        imageUrl: null 
    });

    // MATRIZ DE LOJAS DE MOLDES (CLOTHING PATTERNS)
    const stores = [
        // 1. Clássicos & Editoras (Alta Precisão)
        { name: "Simplicity", type: "USA", url: "https://simplicity.com/search.php?search_query=", group: "exact", boost: 2 },
        { name: "Burda Style", type: "GER", url: "https://www.burdastyle.com/catalogsearch/result/?q=", group: "exact", boost: 2 },
        { name: "Vogue Patterns", type: "USA", url: "https://simplicity.com/search.php?search_query=", group: "exact", boost: 1 },
        { name: "McCall's", type: "USA", url: "https://simplicity.com/search.php?search_query=", group: "exact", boost: 1 },
        
        // 2. Indies Premium & Modernos
        { name: "Tilly and the Buttons", type: "UK", url: "https://shop.tillyandthebuttons.com/search?q=", group: "exact", boost: 1 },
        { name: "Papercut Patterns", type: "NZ", url: "https://papercutpatterns.com/search?q=", group: "close", boost: 1 },
        { name: "Sew Over It", type: "UK", url: "https://sewoverit.com/?s=", group: "close", boost: 1 },
        { name: "Thread Theory", type: "MENS", url: "https://threadtheory.ca/search?q=", group: "close", boost: 0 },
        { name: "The Fold Line", type: "UK/MKT", url: "https://thefoldline.com/?s=", group: "close", boost: 2 },
        { name: "Vikisews", type: "RU/US", url: "https://vikisews.com/search/?q=", group: "exact", boost: 1 },
        
        // 3. Grátis & Comunidade
        { name: "FreeSewing", type: "OPEN", url: "https://freesewing.org/search/?q=", group: "exact", boost: 0 },
        { name: "Dr-Cos", type: "JP/COS", url: "https://dr-cos.info/?s=", group: "adventurous", boost: -1 },
        { name: "Pattydoo", type: "GER", url: "https://www.pattydoo.de/en/search?s=", group: "close", boost: 0 },
        { name: "Grasser", type: "RU", url: "https://en-grasser.com/search/?q=", group: "exact", boost: 0 },
        { name: "Mood Fabrics", type: "FREE", url: "https://www.moodfabrics.com/blog/?s=", group: "close", boost: 1 },
        
        // 4. Sob Medida & CAD
        { name: "Lekala", type: "CAD", url: "https://www.lekala.co/catalog?q=", group: "exact", boost: -1 },
        { name: "Sewist", type: "CAD", url: "https://www.sewist.com/search?q=", group: "exact", boost: -1 },
        
        // 5. Marketplaces Globais
        { name: "Etsy Global", type: "MKT", url: "https://www.etsy.com/search?q=", group: "exact", boost: 1 },
        { name: "Makerist", type: "EU", url: "https://www.makerist.com/search?q=", group: "close", boost: 0 },
        { name: "Google Shopping", type: "GERAL", url: "https://www.google.com/search?tbm=shop&q=", group: "adventurous", boost: -2 }
    ];

    const matches = { exact: [], close: [], adventurous: [] };
    stores.forEach(store => {
        let score = 90 + store.boost;
        if (store.group === 'close') score = 80 + store.boost;
        if (store.group === 'adventurous') score = 70 + store.boost;
        const link = createRealLink(store.name, store.type, store.url, mainQuery, score);
        matches[store.group].push(link);
    });

    return matches;
};
