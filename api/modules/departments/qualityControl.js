
// api/modules/departments/qualityControl.js
// DEPARTAMENTO: CONTROLE DE QUALIDADE & REFINAMENTO
// Responsabilidade: Upscaling e Finalização de Arquivo.
import { GoogleGenAI } from "@google/genai";

// NOVO: MOTOR DE PRODUÇÃO DEDICADO (CORRIGIDO)
export const generateHighResProductionFile = async (apiKey, imageBase64, targetSize, technique, layoutStyle = 'ORIGINAL') => {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    // Upgrade para Gemini 3 Pro (Suporte a 4K e melhor fidelidade)
    const MODEL_NAME = 'gemini-3-pro-image-preview'; 

    // FIX CRÍTICO: Limpa o cabeçalho "data:image..." se existir, pois a API espera apenas o hash base64
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

    const TECH_SPEC = technique === 'CYLINDER' 
        ? "MODE: VECTOR TRACING LOOK. Flat solid colors, extremely sharp edges, no anti-aliasing blurring. Ready for screen engraving." 
        : "MODE: 4K UPSCALING. Photorealistic texture enhancement, maintain organic details, remove noise.";

    // PROMPT DE FIDELIDADE ESTRITA (UPSCALING PURO)
    const PRODUCTION_PROMPT = `
    ACT AS: Industrial AI Upscaler (Super-Resolution Engine).
    
    TASK: Upscale this specific textile pattern to 4K resolution for industrial printing.
    
    CRITICAL FIDELITY RULES (ZERO TOLERANCE FOR CHANGE):
    1. DO NOT CHANGE THE DESIGN: The motifs, positioning, composition, and palette must remain EXACTLY identical to the reference image.
    2. NO CREATIVE HALLUCINATIONS: Do not add new flowers, objects, or details that do not exist in the source.
    3. TARGET: Remove JPEG artifacts, blur, and noise. Sharpen lines and define textures.
    4. OUTPUT: A pristine 4K High-Res asset.
    
    ${TECH_SPEC}
    
    Target Output: 2D Flat Pattern File (4096x4096px).
    `;

    // Define Aspect Ratio baseado no layout original para evitar distorção
    const isPareo = layoutStyle === 'PAREO';
    const aspectRatio = isPareo ? "9:16" : "1:1";

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: { 
                parts: [
                    { text: PRODUCTION_PROMPT },
                    { inlineData: { mimeType: "image/png", data: cleanBase64 } }
                ] 
            },
            config: {
                imageConfig: {
                    imageSize: "4K", // Força resolução máxima permitida pelo modelo
                    aspectRatio: aspectRatio // Respeita se é Pareô ou Quadrado
                }
            }
        });

        // Loop de busca seguro pela parte de imagem
        let imagePart = null;
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    imagePart = part;
                    break;
                }
            }
        }
        
        if (imagePart) {
            return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        }
        
        throw new Error("O motor de produção 4K não retornou uma imagem válida.");

    } catch (e) {
        console.error("Production Engine Error:", e);
        throw new Error("Erro no processamento de alta definição: " + e.message);
    }
};

export const enhancePatternQuality = async (apiKey, imageBase64, contextPrompt) => {
    // Mantido para compatibilidade, mas redireciona para o motor Pro
    return generateHighResProductionFile(apiKey, imageBase64, "Preview", "DIGITAL", "ORIGINAL");
};
