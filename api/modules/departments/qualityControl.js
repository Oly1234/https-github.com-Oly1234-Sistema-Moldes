
// api/modules/departments/qualityControl.js
// DEPARTAMENTO: CONTROLE DE QUALIDADE & REFINAMENTO
// Responsabilidade: Upscaling e Finalização de Arquivo.

// NOVO: MOTOR DE PRODUÇÃO DEDICADO (CORRIGIDO)
export const generateHighResProductionFile = async (apiKey, imageBase64, targetSize, technique) => {
    // Usamos um modelo de visão capaz de Image-to-Image com alta fidelidade
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const TECH_SPEC = technique === 'CYLINDER' 
        ? "Style: Vector Graphic. Flat solid colors. Sharp edges." 
        : "Style: High-End Digital Print. Rich details, perfect gradients, sharp focus.";

    // PROMPT REVISADO: "RE-IMAGINE" em vez de "RESTAURE"
    // Isso evita que o modelo recuse a imagem por achar que não pode editar o original.
    // Pedimos para ele criar uma "Variante em Alta Definição" baseada na entrada.
    const PRODUCTION_PROMPT = `
    TASK: Generate a High-Definition version of this textile pattern.
    
    INSTRUCTIONS:
    1. Use the provided image as the REFERENCE for composition, colors, and motifs.
    2. OUTPUT: A pristine, high-resolution digital asset (4K quality).
    3. FIX: Remove any blur, compression artifacts, or noise from the reference.
    4. ACCURACY: Keep the design identical, just upgrade the quality.
    
    ${TECH_SPEC}
    Target Output: Flat 2D Print File.
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
        
        // Verifica se houve recusa (safety ratings ou finishReason)
        if (data.candidates?.[0]?.finishReason === 'SAFETY') {
            throw new Error("A IA recusou a imagem por motivos de segurança. Tente uma estampa diferente.");
        }

        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
        
        if (imagePart) {
            return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        }
        
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
