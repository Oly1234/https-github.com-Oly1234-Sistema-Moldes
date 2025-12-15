
// DEPARTAMENTO: COLORIMETRIA & TENDÊNCIAS
// Responsabilidade: Extração de Pantone TCX, Hex e Status de Tendência com Lógica Têxtil Brasileira
// ATUALIZAÇÃO v6.5: Lógica de Espectrofotômetro para Tom sobre Tom e Degradês

export const analyzeColorTrend = async (apiKey, imageBase64, mimeType, cleanJson, variation = 'NATURAL') => {
    // VARIATIONS: 'NATURAL' (As is), 'VIVID' (Boost Saturation), 'PASTEL', 'DARK'
    
    let VARIATION_INSTRUCTION = "";
    if (variation === 'VIVID') {
        VARIATION_INSTRUCTION = "CRITICAL: The input photo is DULL/FADED. You must SIMULATE the original, VIBRANT colors as if they were new. Boost saturation and brightness in your analysis.";
    } else if (variation === 'PASTEL') {
        VARIATION_INSTRUCTION = "CRITICAL: Interpret the colors as a Soft/Pastel palette.";
    } else if (variation === 'DARK') {
        VARIATION_INSTRUCTION = "CRITICAL: Interpret the colors as a Deep/Moody palette.";
    }

    const COLORIST_PROMPT = `
    ACT AS: Advanced Textile Spectrophotometer & Senior Colorist (Pantone Certified).
    TASK: Perform a deep colorimetric analysis of the provided textile image.
    ${VARIATION_INSTRUCTION}
    
    CRITICAL ANALYSIS INSTRUCTIONS:
    1. GRADIENTS & TONE-ON-TONE: Look for relationships. Identify "Tone-on-Tone" sets.
    2. NUANCE: Identify subtle variations.
    3. PALETTE SIZE: Extract up to 8 distinct tones.
    4. PANTONE MATCHING: Map strictly to Pantone FASHION, HOME + INTERIORS (TCX) Cotton Passport.
    
    OUTPUT JSON ONLY (Keys in English, Values in Portuguese PT-BR):
    {
        "harmony": "Describe the harmony technically (Ex: 'Monocromia em Azul Profundo')",
        "colors": [
            { 
                "name": "Professional Color Name", 
                "hex": "#RRGGBB", 
                "code": "19-4052 TCX", 
                "role": "Fundo, Motivo, Sombra, Luz, Acento, Contorno",
                "trendStatus": "Analysis"
            }
        ],
        "suggestion": "Brief advice for reproduction."
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
