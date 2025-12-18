
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
    PALETTE: ${params.colors?.map(c => c.name).join(', ') || 'Vibrant Colors'}.
    INSTRUCTION: ${params.prompt}. ${params.customStyle || ''}. ${params.customLayout || ''}.
    ${MATERIAL_EXCLUSION}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: PROMPT }] },
            config: { imageConfig: { aspectRatio: "1:1" } }
        });
        
        // Find the image part in the response
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64EncodeString = part.inlineData.data;
                    return `data:image/png;base64,${base64EncodeString}`;
                }
            }
        }
        return null;
    } catch (e) {
        throw e;
    }
};

export const generateTextureLayer = async (apiKey, textureType, texturePrompt) => {
    const ai = new GoogleGenAI({ apiKey });
    
    const PROMPT = `Generate a high-quality ${textureType} textile texture swatch. 
    Texture detail: ${texturePrompt}. 
    Isolated flat view, seamless look, professional quality, high contrast details.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: PROMPT }] },
            config: { imageConfig: { aspectRatio: "1:1" } }
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64EncodeString = part.inlineData.data;
                    return `data:image/png;base64,${base64EncodeString}`;
                }
            }
        }
        return null;
    } catch (e) {
        throw e;
    }
};

export const inpaintPattern = async (apiKey, params) => {
    const ai = new GoogleGenAI({ apiKey });
    // Lógica de envio de máscara + imagem original + prompt de refinamento
    // Usando o novo Gemini 2.5 Flash Image que suporta context regional
    // ...
    return null;
};
