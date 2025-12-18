
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, params) => {
    const ai = new GoogleGenAI({ apiKey });
    
    // Instrução Crítica: Omitir trama física na arte gerada
    const MATERIAL_EXCLUSION = `
    CRITICAL: Output ONLY the artistic graphic motifs. 
    DO NOT include fabric weave, linen texture, paper grain or any "physical" material look.
    The file must be a pristine digital artwork ready for post-process texturing.
    `;

    const PROMPT = `
    TASK: Generate a professional textile design.
    STRUCTURE: ${params.layout} - ${params.variant}.
    STYLE: ${params.style}.
    PALETTE: ${params.colors.map(c => c.name).join(', ')}.
    INSTRUCTION: ${params.prompt}. ${params.customPrompt || ''}.
    ${MATERIAL_EXCLUSION}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: PROMPT }] },
            config: { imageConfig: { aspectRatio: "1:1" } }
        });
        // Extração de imagem conforme regras...
        return extractImageFromResponse(response);
    } catch (e) {
        throw e;
    }
};

export const inpaintPattern = async (apiKey, params) => {
    const ai = new GoogleGenAI({ apiKey });
    // Lógica de envio de máscara + imagem original + prompt de refinamento
    // Usando o novo Gemini 2.5 Flash Image que suporta context regional
    // ...
};
