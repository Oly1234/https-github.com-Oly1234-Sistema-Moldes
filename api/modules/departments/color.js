
// DEPARTAMENTO: COLORIMETRIA & TENDÊNCIAS
// Responsabilidade: Extração de Pantone TCX com Variações Contextuais e Análise Sênior

export const analyzeColorTrend = async (apiKey, imageBase64, mimeType, cleanJson, variation = 'NATURAL') => {
    
    let VARIATION_INSTRUCTION = "Extract the exact dominant colors from the image.";
    
    // Lógica de Variação Contextual
    if (variation === 'VIVID') VARIATION_INSTRUCTION = "Ignore dull colors. Extract only the most VIBRANT, SATURATED, and NEON accents.";
    else if (variation === 'PASTEL') VARIATION_INSTRUCTION = "Shift the palette to SOFT, MILKY, DESATURATED pastel tones based on the image.";
    else if (variation === 'DARK') VARIATION_INSTRUCTION = "Extract the DEEP, RICH, SHADOW tones. Ignore highlights.";
    else if (variation === 'SUMMER') VARIATION_INSTRUCTION = "Extract a SUMMER PALETTE (Warm, Sunny, Tropical) inspired by the image.";
    else if (variation === 'WINTER') VARIATION_INSTRUCTION = "Extract a WINTER PALETTE (Cool, Icy, Jewel Tones) inspired by the image.";

    const COLORIST_PROMPT = `
    ACT AS: Senior Textile Colorist & Trend Forecaster (WGSN Style).
    TASK: ${VARIATION_INSTRUCTION}
    
    1. Identify the 5-6 key colors that define the "Mood" of this print.
    2. Assign a commercial/poetic name (e.g., "Midnight Navy", "Sunset Coral").
    3. Provide the closest Pantone TCX code.
    4. Suggest the role of the color (Base, Accent, Shadow).

    OUTPUT JSON ONLY:
    {
        "colors": [
            { 
                "name": "Commercial Name", 
                "hex": "#RRGGBB", 
                "code": "19-XXXX TCX",
                "role": "Base/Accent/Highlight",
                "usage": "Best for background or details"
            }
        ]
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
        
        if (!text) throw new Error("Sem resposta de cor.");
        
        return JSON.parse(cleanJson(text));
    } catch (e) {
        console.error("Color Dept Error:", e);
        // Fallback silencioso
        return { colors: [] };
    }
};
