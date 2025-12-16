
// api/modules/departments/qualityControl.js
// DEPARTAMENTO: CONTROLE DE QUALIDADE & REFINAMENTO (The Polisher)
// Responsabilidade: Refinar o desenho gerado, aplicando limpeza vetorial e proporção.

export const enhancePatternQuality = async (apiKey, imageBase64, contextPrompt) => {
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const POLISHER_PROMPT = `
    ACT AS: Textile Pre-Press Technician.
    TASK: Vectorize and Refine this pattern swatch (Image-to-Image).
    
    VISUAL IMPROVEMENT GUIDELINES:
    1. CLEANUP: Refine contours to obtain clean, continuous lines (Clean Vector Lines).
    2. DENOISE: Eliminate imperfections, grain, and unintended blur.
    3. COLOR: Flatten colors to "Solid Flat Colors" (simulating screen print separation).
    4. PROPORTION: Harmonize proportions between graphic elements while maintaining original composition.
    
    DESIGN CONTEXT: ${contextPrompt || "Technical vector pattern"}
    
    OBJECTIVE: Deliver a high-definition final file ready for cylinder engraving.
    IMPORTANT: Keep image as FLAT 2D SWATCH. Do not add folds or 3D effects.
    `;

    const payload = {
        contents: [{ 
            parts: [
                { text: POLISHER_PROMPT },
                { inline_data: { mime_type: "image/png", data: imageBase64 } }
            ] 
        }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
        ]
    };

    try {
        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });

        if (!response.ok) throw new Error("Falha no refinamento.");

        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts;
        
        if (data.promptFeedback?.blockReason) throw new Error("SAFETY_BLOCK_QC");

        const imagePart = candidate?.find(p => p.inline_data);

        if (imagePart) {
            return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        }
        
        throw new Error("Refinamento falhou.");

    } catch (e) {
        console.error("QC Department Error:", e);
        throw e;
    }
};
