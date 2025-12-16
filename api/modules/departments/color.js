
// DEPARTAMENTO: COLORIMETRIA & TENDÊNCIAS
// Responsabilidade: Extração de Pantone TCX, Hex e Status de Tendência com Lógica Têxtil Brasileira
// ATUALIZAÇÃO v6.6: Lógica de Segurança (Safe Names) & Agrupamento Inteligente (Smart Clustering)

export const analyzeColorTrend = async (apiKey, imageBase64, mimeType, cleanJson, variation = 'NATURAL') => {
    
    let VARIATION_INSTRUCTION = "";
    if (variation === 'VIVID') VARIATION_INSTRUCTION = "Boost saturation significantly. Make colors pop.";
    else if (variation === 'PASTEL') VARIATION_INSTRUCTION = "Shift colors to a soft, milky, pastel palette.";
    else if (variation === 'DARK') VARIATION_INSTRUCTION = "Shift colors to deep, rich, moody tones.";

    const COLORIST_PROMPT = `
    ACT AS: Safety-Conscious Textile Colorist & Spectrophotometer.
    TASK: Analyze the textile image and extract the Pantone Fashion, Home + Interiors (TCX) palette.
    ${VARIATION_INSTRUCTION}
    
    SAFETY NAMING PROTOCOL (CRITICAL):
    - DO NOT use sensitive names (e.g. 'Nude', 'Flesh', 'Skin', 'Blood', 'Hot Pink').
    - USE TECHNICAL/NATURE names (e.g. 'Sand', 'Beige', 'Crimson', 'Magenta', 'Peach').
    
    SMART CLUSTERING LOGIC:
    1. GROUP BY MOTIF: List colors that appear together in the artwork side-by-side (e.g. If a flower has Yellow petals and Orange center, list Yellow then Orange).
    2. LIMIT REDUNDANCY: If there are 5 shades of Yellow, pick only the 2 most distinct ones.
    3. MAX COLORS: 6 to 8 colors total.
    
    OUTPUT JSON ONLY (Values in PT-BR for display, but names in English/International):
    {
        "harmony": "Technical harmony description (e.g. 'Complementary Contrast')",
        "colors": [
            { 
                "name": "Safe International Name", 
                "hex": "#RRGGBB", 
                "code": "19-XXXX TCX", 
                "role": "Background/Motif/Accent"
            }
        ],
        "suggestion": "Brief advice for print reproduction."
    }
    `;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: COLORIST_PROMPT }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generation_config: { response_mime_type: "application/json" }
    };

    try {
        const response = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) throw new Error("O Departamento de Cor não respondeu.");
        
        return JSON.parse(cleanJson(text));
    } catch (e) {
        console.error("Color Dept Error:", e);
        return {
            harmony: "Análise Indisponível",
            colors: [],
            suggestion: "Tente uma imagem com iluminação melhor."
        };
    }
};
