
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
        }]
    };

    try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
        if (imagePart) return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        throw new Error("Refinamento falhou.");
    } catch (e) {
        console.error("QC Department Error:", e);
        throw e;
    }
};

// NOVO: MOTOR DE PRODUÇÃO DEDICADO
export const generateHighResProductionFile = async (apiKey, imageBase64, targetSize, technique) => {
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    // Instruções específicas baseadas na técnica (Cilindro vs Digital)
    const TECH_SPEC = technique === 'CYLINDER' 
        ? "STRICTLY SEPARATED COLORS. No gradients. No anti-aliasing. Clean solid edges for rotary screen engraving." 
        : "HIGH FIDELITY DIGITAL PRINT. Micro-details, smooth gradients, photo-realistic texture.";

    const PRODUCTION_PROMPT = `
    ACT AS: Industrial Print Production Engine.
    INPUT: A generated pattern draft.
    TASK: UPSCALING & FINALIZATION for Large Format Printing.
    
    TARGET OUTPUT SIZE: ${targetSize || "Standard 140cm width"}.
    
    EXECUTION RULES:
    1. SUPER RESOLUTION: Hallucinate missing details to make the image sharp at large scale.
    2. DE-NOISE & SHARPEN: Remove any JPG artifacts or blur from the draft.
    3. SEAMLESS CHECK: Ensure the edges look ready for repeating (even if generating a single tile).
    4. COLOR CORRECTION: Boost saturation slightly for fabric absorption compensation.
    
    TECHNICAL REQUIREMENT: ${TECH_SPEC}
    
    OUTPUT: The highest resolution possible image file, visually perfect.
    `;

    const payload = {
        contents: [{ 
            parts: [
                { text: PRODUCTION_PROMPT },
                { inline_data: { mime_type: "image/png", data: imageBase64 } }
            ] 
        }]
    };

    try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
        if (imagePart) return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        throw new Error("Motor de Produção falhou.");
    } catch (e) {
        console.error("Production Engine Error:", e);
        throw e;
    }
};
