
// DEPARTAMENTO: COLORIMETRIA & TENDÊNCIAS
// Responsabilidade: Extração de Pantone TCX focado exclusivamente em estampa

export const analyzeColorTrend = async (apiKey, imageBase64, mimeType, cleanJson, variation = 'NATURAL') => {
    
    let VARIATION_INSTRUCTION = "Extract a Comprehensive Palette (8-12 Colors).";
    
    if (variation === 'VIVID') VARIATION_INSTRUCTION = "Ignore dull colors. Extract only the most VIBRANT and NEON accents.";
    else if (variation === 'PASTEL') VARIATION_INSTRUCTION = "Shift the palette to SOFT, MILKY pastel tones.";
    else if (variation === 'DARK') VARIATION_INSTRUCTION = "Extract the DEEP and RICH shadow tones.";

    const COLORIST_PROMPT = `
    ACT AS: Senior Textile Colorist.
    
    TASK: ${VARIATION_INSTRUCTION}
    
    CRITICAL RULES (ANTI-MODEL FILTER):
    1. IGNORE HUMAN SKIN: Do NOT extract any skin tones, flesh colors, or lip/eye colors.
    2. IGNORE HAIR/BODY: Completely ignore hair colors and body parts.
    3. IGNORE ACCESSORIES: Ignore jewelry, metal, bags, or shoes.
    4. PRINT FOCUS: Focus 100% on the textile PRINT or PATTERN of the garment.
    5. ACCENT CAPTURE: Find the small detail colors within the motifs.
    
    OUTPUT JSON:
    {
        "colors": [
            { 
                "name": "Commercial Name", 
                "hex": "#RRGGBB", 
                "code": "19-XXXX TCX",
                "role": "Base/Accent/Motif"
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
        return { colors: [] };
    }
};
