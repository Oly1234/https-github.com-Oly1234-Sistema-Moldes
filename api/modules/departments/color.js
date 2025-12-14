
// DEPARTAMENTO: COLORIMETRIA & TENDÊNCIAS
// Responsabilidade: Extração de Pantone TCX, Hex e Status de Tendência com Lógica Têxtil Brasileira

export const analyzeColorTrend = async (apiKey, imageBase64, mimeType, cleanJson) => {
    const COLORIST_PROMPT = `
    ACT AS: Senior Colorist & Textile Engineer (Specialized in Brazilian Market).
    TASK: Deconstruct the image color palette focusing on "Tone-on-Tone" (Tom sur Ton) and Hierarchy.
    
    ANALYSIS STEPS:
    1. HIERARCHY: Identify the BACKGROUND color vs. the MOTIF colors.
    2. HARMONY: Look for gradient details (Shadows/Highlights) within the same hue (Tom sur Ton).
    3. PANTONE: Map strictly to Pantone TCX (Cotton).
    
    OUTPUT JSON ONLY (Keys in English, Values in Portuguese PT-BR):
    {
        "colors": [
            { 
                "name": "Nome da Cor (Ex: Azul Serenity)", 
                "hex": "#RRGGBB", 
                "code": "19-4052 TCX", 
                "trendStatus": "Tendência 2024/25" (or null),
                "role": "ROLE IN PT-BR" 
            }
        ]
    }

    ROLE DEFINITIONS (Use these exact PT-BR terms):
    - "Fundo Base" (The background canvas)
    - "Motivo Principal" (The main flower/geo element)
    - "Sombra/Degradê" (Darker tone of the motif - Tom sur ton)
    - "Acento Luz" (Lighter tone or highlight)
    - "Detalhe Contraste" (Pop of color)
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
