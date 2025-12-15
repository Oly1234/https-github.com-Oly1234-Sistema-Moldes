
// DEPARTAMENTO: COLORIMETRIA & TENDÊNCIAS
// Responsabilidade: Extração de Pantone TCX, Hex e Status de Tendência com Lógica Têxtil Brasileira

export const analyzeColorTrend = async (apiKey, imageBase64, mimeType, cleanJson) => {
    const COLORIST_PROMPT = `
    ACT AS: Advanced Textile Spectrophotometer & Senior Colorist.
    TASK: Perform a deep colorimetric analysis of the provided textile image.
    
    CRITICAL ANALYSIS:
    1. SCANNING: Identify the pixel distribution to find the TRUE dominant colors, ignoring lighting artifacts.
    2. HIERARCHY: Separate the Background (Base) from the Motifs.
    3. TONE-ON-TONE (TOM SOBRE TOM): Identify gradients. If a red flower has dark red shadows and pink highlights, identify these as related tones.
    4. PANTONE MATCHING: Map strictly to Pantone FASHION, HOME + INTERIORS (TCX) Cotton Passport.
    
    OUTPUT JSON ONLY (Keys in English, Values in Portuguese PT-BR):
    {
        "harmony": "Describe the color harmony (e.g., 'Monocromática com profundidade', 'Complementar Vibrante', 'Tom sobre Tom Suave')",
        "colors": [
            { 
                "name": "Professional Color Name (Ex: Midnight Blue, Dusty Rose)", 
                "hex": "#RRGGBB", 
                "code": "19-4052 TCX", 
                "role": "See Definitions Below",
                "trendStatus": "Brief note on trend (e.g. 'Base Clássica', 'Acento Verão 25')"
            }
        ]
    }

    ROLE DEFINITIONS (Strictly use these options in PT-BR):
    - "Fundo Predominante" (The canvas/base)
    - "Motivo Principal" (The dominant element color)
    - "Tom s/ Tom (Sombra)" (Darker variation of the main motif)
    - "Tom s/ Tom (Luz)" (Lighter variation/highlight)
    - "Acento de Contraste" (Pop of color that breaks the harmony)
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
