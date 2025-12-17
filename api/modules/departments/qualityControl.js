
// api/modules/departments/qualityControl.js
// DEPARTAMENTO: CONTROLE DE QUALIDADE & REFINAMENTO
// Responsabilidade: Upscaling e Finalização de Arquivo.

// NOVO: MOTOR DE PRODUÇÃO DEDICADO (CORRIGIDO)
export const generateHighResProductionFile = async (apiKey, imageBase64, targetSize, technique) => {
    // Usamos um modelo de visão capaz de Image-to-Image com alta fidelidade
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const TECH_SPEC = technique === 'CYLINDER' 
        ? "Ensure colors are FLAT and SOLID (Vector style). Remove JPG artifacts." 
        : "Enhance details and sharpness. Remove noise.";

    // Prompt ajustado para RESTAURAÇÃO e não CRIAÇÃO
    const PRODUCTION_PROMPT = `
    ACT AS: Image Restoration & Upscaling AI.
    
    INPUT: A draft textile pattern image.
    TASK: UPSCALING and REFINEMENT (High Fidelity Restoration).
    
    STRICT RULES:
    1. DO NOT CHANGE THE DESIGN. Keep the exact same motifs, composition, and colors.
    2. INCREASE RESOLUTION: Make lines sharper and details crisper.
    3. REMOVE NOISE: Clean up compression artifacts or blurriness.
    4. OUTPUT FORMAT: Flat 2D digital file ready for print.
    
    Target Use: Large format printing (${targetSize || "Standard Width"}).
    Specifics: ${TECH_SPEC}
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
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
        
        if (imagePart) {
            return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        }
        
        // Se a IA se recusar a gerar imagem (safety ou outro motivo), retornamos erro para a UI tratar
        throw new Error("O motor de produção não retornou uma imagem válida.");

    } catch (e) {
        console.error("Production Engine Error:", e);
        throw e;
    }
};

export const enhancePatternQuality = async (apiKey, imageBase64, contextPrompt) => {
    // Mantido para compatibilidade, mas pode usar lógica similar
    return generateHighResProductionFile(apiKey, imageBase64, "Preview", "DIGITAL");
};
