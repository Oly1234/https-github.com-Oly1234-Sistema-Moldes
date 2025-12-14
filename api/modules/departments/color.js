
// DEPARTAMENTO: COLORIMETRIA & TENDÊNCIAS
// Responsabilidade: Extração de Pantone TCX, Hex e Status de Tendência

export const analyzeColorTrend = async (apiKey, imageBase64, mimeType, cleanJson) => {
    const COLORIST_PROMPT = `
    ACT AS: Senior Colorist at Pantone Color Institute.
    TASK: Analyze the image colors strictly for textile application.
    
    REQUIREMENTS:
    1. Identify the 4-5 dominant colors.
    2. Map EACH color to the nearest PANTONE TCX (Cotton) standard.
    3. CHECK TREND STATUS: Is this color related to a recent "Color of the Year" or major trend (e.g. Peach Fuzz, Viva Magenta)?
    
    OUTPUT JSON ONLY:
    {
        "colors": [
            { 
                "name": "Color Name", 
                "hex": "#RRGGBB", 
                "code": "19-4052 TCX", 
                "trendStatus": "Color of the Year 2024" (or null if not trending),
                "role": "Base/Accent"
            }
        ]
    }
    `;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: COLORIST_PROMPT }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generation_config: { response_mime_type: "application/json" }
    };

    const response = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("O Departamento de Cor não respondeu.");
    
    return JSON.parse(cleanJson(text));
};
