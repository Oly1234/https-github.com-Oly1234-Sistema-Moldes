
// api/modules/clothing.js
// DEPARTAMENTO: ENGENHARIA DE VESTUÁRIO
// RESPONSÁVEL: Diretor Técnico Vingi

export const analyzeClothingDna = async (apiKey, mainImageBase64, mainMimeType, cleanJson) => {
    // O Diretor Técnico agora é instruído a ser mais descritivo visualmente
    const DIRECTOR_PROMPT = `
    ACT AS: Senior Technical Fashion Director.
    TASK: Analyze the garment photo to create a specialized 'Visual Search Brief'.
    
    INPUT: User uploaded photo of a garment.
    
    OUTPUT JSON:
    { 
        "patternName": "Technical Name (e.g. 'Milkmaid Mini Dress')", 
        "visualDescription": "Highly descriptive visual text for finding SIMILAR PHOTOS (e.g. 'Woman wearing floral puff sleeve square neck mini dress summer photoshoot')",
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
    const baseTerm = analysis.patternName;
    // O termo visual agora é chave para encontrar fotos reais, não capas
    const visualTerm = analysis.visualDescription || baseTerm;

    const createLink = (storeName, type, urlBase, visualStyle, boost) => {
        // CONSTRUÇÃO DO TERMO DE BUSCA VISUAL:
        // "Nome da Loja" + "Descrição Visual da Roupa" + "Estilo da Foto (Modelo/Photoshoot)"
        // Ex: "Burda Style" "Floral mini dress" "Model photoshoot"
        const highlySpecificSearch = `"${storeName}" ${visualTerm} ${visualStyle}`;
        
        return {
            source: storeName,
            patternName: baseTerm, 
            description: visualTerm, 
            type,
            linkType: "SEARCH_QUERY",
            url: `${urlBase}${encodeURIComponent(visualTerm)}`,
            backupSearchTerm: highlySpecificSearch, 
            similarityScore: 90 + boost,
            imageUrl: null
        };
    };

    const matches = { exact: [], close: [], adventurous: [] };

    // --- SETOR A: BIG 4 (Foco em Capa/Envelope, mas tentamos modelo real) ---
    matches.exact.push(createLink("Simplicity", "BIG 4", "https://simplicity.com/search.php?search_query=", "sewing pattern model photo", 2));
    matches.exact.push(createLink("McCall's", "BIG 4", "https://simplicity.com/search.php?search_query=", "pattern model wearing", 2));
    matches.exact.push(createLink("Vogue Patterns", "COUTURE", "https://simplicity.com/search.php?search_query=", "high fashion photography", 2));
    matches.exact.push(createLink("Burda Style", "EURO", "https://www.burdastyle.com/catalogsearch/result/?q=", "magazine editorial photo", 2));
    
    // --- SETOR B: INDIE (Foco em Photoshoot Limpo) ---
    matches.close.push(createLink("Closet Core", "PREMIUM", "https://closetcorepatterns.com/search?q=", "photoshoot model", 2));
    matches.close.push(createLink("Merchant & Mills", "RUSTIC", "https://merchantandmills.com/?s=", "garment photography", 2));
    matches.close.push(createLink("The Assembly Line", "SCANDI", "https://theassemblylineshop.com/search?q=", "minimalist fashion photo", 2));
    matches.close.push(createLink("Papercut Patterns", "MODERN", "https://papercutpatterns.com/search?q=", "editorial lookbook", 2));
    matches.close.push(createLink("Friday Pattern Co", "FUN", "https://fridaypatterncompany.com/search?q=", "model smiling photo", 2));
    matches.close.push(createLink("Vikisews", "RUSSIAN", "https://vikisews.com/search/?q=", "fashion studio photography", 2));
    matches.close.push(createLink("Fibre Mood", "TRENDY", "https://www.fibremood.com/en/patterns?search=", "street style photography", 2));

    // --- SETOR C: MARKETPLACES (Foco em Produto Final) ---
    matches.adventurous.push(createLink("Etsy", "GLOBAL", "https://www.etsy.com/search?q=", "clothing photography", 1));
    matches.adventurous.push(createLink("The Fold Line", "DATABASE", "https://thefoldline.com/?s=", "sewing pattern review photo", 1));
    matches.adventurous.push(createLink("Mood Fabrics", "FREE", "https://www.moodfabrics.com/blog/?s=", "garment sewn photo", 1));

    return matches;
};
