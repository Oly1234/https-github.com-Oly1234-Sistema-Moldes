
// DEPARTAMENTO: COLORIMETRIA & TENDÊNCIAS
// Responsabilidade: Extração de Pantone TCX, Hex e Status de Tendência com Lógica Têxtil Brasileira
// ATUALIZAÇÃO v6.5: Lógica de Espectrofotômetro para Tom sobre Tom e Degradês

export const analyzeColorTrend = async (apiKey, imageBase64, mimeType, cleanJson) => {
    const COLORIST_PROMPT = `
    ACT AS: Advanced Textile Spectrophotometer & Senior Colorist (Pantone Certified).
    TASK: Perform a deep colorimetric analysis of the provided textile image.
    
    CRITICAL ANALYSIS INSTRUCTIONS:
    1. GRADIENTS & TONE-ON-TONE: Do not just pick separate colors. Look for the relationships. If there is a light blue fading into dark blue, identify BOTH as a "Tone-on-Tone" set.
    2. NUANCE: Identify subtle variations. A "Flat Red" is different from a "Crimson with Shadow".
    3. PALETTE SIZE: Extract up to 8 distinct tones if present.
    4. PANTONE MATCHING: Map strictly to Pantone FASHION, HOME + INTERIORS (TCX) Cotton Passport.
    
    OUTPUT JSON ONLY (Keys in English, Values in Portuguese PT-BR):
    {
        "harmony": "Describe the harmony technically (Ex: 'Monocromia em Azul Profundo', 'Contraste Complementar Vibrante', 'Degradê Suave de Terrosos')",
        "colors": [
            { 
                "name": "Professional Color Name (Ex: Midnight Blue, Dusty Rose)", 
                "hex": "#RRGGBB", 
                "code": "19-4052 TCX", 
                "role": "See Definitions Below",
                "trendStatus": "Analysis (e.g. 'Base', 'Sombra', 'Luz', 'Acento')"
            }
        ],
        "suggestion": "Brief advice for reproduction (e.g., 'Use halftoning for the gradient' or 'Use 4 screens for flat colors')."
    }

    ROLE DEFINITIONS (Select closest):
    - "Fundo" (Base canvas)
    - "Motivo (Tom Médio)" (Main element color)
    - "Sombra (Tom Escuro)" (Darker variant of motif or shadow)
    - "Luz (Tom Claro)" (Highlight or lighter gradient end)
    - "Acento" (Pop color)
    - "Contorno" (Stroke/Outline)
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
        // Fallback robusto
        return {
            harmony: "Análise Indisponível",
            colors: [],
            suggestion: "Tente uma imagem com iluminação melhor."
        };
    }
};
