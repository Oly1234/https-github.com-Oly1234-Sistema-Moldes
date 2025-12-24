
// api/modules/separation.js
// DEPARTAMENTO: SEPARAÇÃO DE CORES (Pré-Impressão Avançada)
// Responsabilidade: Identificar a paleta exata, agrupar semanticamente e definir estratégias de retícula.

export const analyzeForSeparation = async (apiKey, imageBase64, mimeType, cleanJson) => {
    
    const SEPARATOR_PROMPT = `
    ACT AS: Senior Textile Engraver & Color Separation Expert (Rotary Screen Printing).
    
    TASK: Deconstruct this textile design into a logical set of printing cylinders (channels).
    
    OBJECTIVE: Create a sophisticated separation that allows for "Tone-on-Tone" effects, gradients, and fine details, avoiding a "hard plastic" look.
    
    INSTRUCTIONS:
    1. **SEMANTIC GROUPING:** Group colors by what they represent (e.g., "Background", "Floral Elements", "Leaves/Foliage", "Outlines/Filetes", "Shadows").
    2. **GRADIENT DETECTION:** Identify where a color interacts with another to create volume. 
       - If you see a dark red shadow on a pink flower, separate the Pink as a SOLID BASE and the Red as a GRADIENT/RETICULA layer on top.
       - If you see fine lines, classify them as "DETAIL" or "FILETE".
    3. **QUANTITY:** Prefer MORE cylinders (up to 12) to allow flexible recombination later, rather than merging too early.
    
    OUTPUT JSON ONLY:
    {
        "recommendedCylinders": integer,
        "complexity": "Low/Medium/High",
        "colors": [
            { 
                "group": "Fundo / Base",
                "name": "Off-White Base", 
                "hex": "#f5f5f0", 
                "code": "11-0602 TCX",
                "type": "SOLID" 
            },
            { 
                "group": "Floral - Hibiscus",
                "name": "Coral Midtone", 
                "hex": "#ff7f50", 
                "code": "16-1546 TCX",
                "type": "SOLID"
            },
            { 
                "group": "Floral - Hibiscus",
                "name": "Deep Red Shadow", 
                "hex": "#8b0000", 
                "code": "19-1664 TCX",
                "type": "GRADIENT" 
            },
            { 
                "group": "Acabamento",
                "name": "Filete Preto", 
                "hex": "#000000", 
                "code": "19-4005 TCX",
                "type": "DETAIL"
            }
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
