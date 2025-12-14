
// DEPARTAMENTO: FORENSE VISUAL (The Lens)
// Responsabilidade: Descrever EXATAMENTE o que é visto para fins de busca visual.

export const analyzeVisualDNA = async (apiKey, imageBase64, mimeType, cleanJson, context = 'TEXTURE') => {
    // Contexto TEXTURE = Foca na arte (Flat lay)
    // Contexto GARMENT = Foca na construção (Molde)
    
    let SYSTEM_PROMPT = '';

    if (context === 'TEXTURE') {
        SYSTEM_PROMPT = `
        ACT AS: Surface Design Archivist.
        TASK: Describe the ARTWORK/TEXTURE only. Ignore any 3D object shape.
        
        OUTPUT JSON:
        1. "visualDescription": Precise keywords for a search engine (e.g. "Seamless watercolor tropical floral pattern white background").
        2. "technicalSpecs": { 
            "technique": "Watercolor/Vector/Pixel", 
            "motifs": ["Hibiscus", "Palm"], 
            "texture": "Canvas/Silk/Paper" 
        }
        `;
    } else {
        SYSTEM_PROMPT = `
        ACT AS: Technical Fashion Pattern Maker.
        TASK: Describe the GARMENT CONSTRUCTION.
        
        OUTPUT JSON:
        1. "visualDescription": Technical keywords for finding the SEWING PATTERN (e.g. "Bias cut slip dress cowl neck pattern").
        2. "technicalSpecs": { 
            "silhouette": "A-Line/Sheath", 
            "neckline": "Cowl/V-Neck", 
            "details": "Spaghetti straps" 
        }
        `;
    }

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: SYSTEM_PROMPT }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generation_config: { response_mime_type: "application/json" }
    };

    const response = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    return JSON.parse(cleanJson(text));
};
