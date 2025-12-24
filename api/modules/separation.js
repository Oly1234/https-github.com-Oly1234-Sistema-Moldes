
// api/modules/separation.js
// DEPARTAMENTO: SEPARAÇÃO DE CORES (Pré-Impressão)
// Responsabilidade: Identificar a paleta exata para indexação de cores (Cilindros).

export const analyzeForSeparation = async (apiKey, imageBase64, mimeType, cleanJson) => {
    
    const SEPARATOR_PROMPT = `
    ACT AS: Senior Pre-Press Technician for Rotary Screen Printing (Textile Industry).
    
    TASK: Analyze the uploaded textile design and determine the OPTIMAL color separation palette.
    
    GOAL: Reduce the image to a limited number of "Spot Colors" (Cylinders) for printing.
    
    INSTRUCTIONS:
    1. Identify the high-contrast dominant colors used in the artwork.
    2. Ignore anti-aliasing pixels or compression noise. Look for the "intended" solid colors.
    3. Group similar shades into a single channel (e.g., light blue and mid-blue might be the same cylinder with halftime/reticula, OR separate cylinders if distinct).
    4. Limit to maximum 12 colors (standard rotary machine limit), but prefer 6-8 if possible for cost efficiency.
    
    OUTPUT JSON ONLY:
    {
        "recommendedCylinders": integer,
        "complexity": "Low/Medium/High",
        "colors": [
            { 
                "name": "Base Navy", 
                "hex": "#000080", 
                "code": "19-3923 TCX",
                "role": "Background"
            },
            { 
                "name": "Motif Red", 
                "hex": "#FF0000", 
                "code": "18-1662 TCX",
                "role": "Primary Element"
            }
            ...
        ]
    }
    `;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: SEPARATOR_PROMPT }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generation_config: { response_mime_type: "application/json" }
    };

    try {
        const response = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) throw new Error("Sem resposta de separação.");
        
        return JSON.parse(cleanJson(text));
    } catch (e) {
        console.error("Separation Dept Error:", e);
        return { recommendedCylinders: 4, colors: [] };
    }
};
