
// api/modules/departments/qualityControl.js
// DEPARTAMENTO: CONTROLE DE QUALIDADE & REFINAMENTO (The Polisher)
// Responsabilidade: Transformar rascunhos em arquivos prontos para estamparia (Upscaling & Denoising via img2img).

export const enhancePatternQuality = async (apiKey, imageBase64, contextPrompt) => {
    // Modelo Vision para refinamento
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    // SYSTEM PROMPT: TÉCNICO DE ARTE-FINAL / PRE-PRESS
    // O objetivo não é mudar a arte, mas "limpá-la" e deixá-la nítida.
    const TECH_PROMPT = `
    ACT AS: Senior Textile Pre-Press Technician.
    TASK: Refine this textile pattern image for digital printing.
    
    INSTRUCTIONS:
    1. VECTORIZE VISUALLY: Sharpen all edges. Remove blurred pixels. Make it look like a vector file.
    2. CLEAN UP: Remove JPEG artifacts and noise.
    3. COLOR SEPARATION STYLE: Ensure colors are solid and flat (gouache/screen print style).
    4. FIDELITY: Keep the exact same motifs and composition. Do not add new objects. Just enhance quality.
    
    CONTEXT: ${contextPrompt || "Seamless pattern"}
    
    OUTPUT: High-resolution, sharp, production-ready textile file.
    `;

    const payload = {
        contents: [{ 
            parts: [
                { text: TECH_PROMPT },
                { inline_data: { mime_type: "image/png", data: imageBase64 } }
            ] 
        }],
        generationConfig: {
            // Flash Image não usa configurações avançadas, o prompt faz o trabalho.
        }
    };

    try {
        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });

        if (!response.ok) {
            const errText = await response.text();
            console.warn("Quality Control Glitch:", errText);
            throw new Error("O motor de refinamento está sobrecarregado. Tente novamente.");
        }

        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts;
        const imagePart = candidate?.find(p => p.inline_data);

        if (imagePart) {
            return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        }
        
        throw new Error("O refinamento não gerou uma imagem válida.");

    } catch (e) {
        console.error("QC Department Error:", e);
        throw e;
    }
};
