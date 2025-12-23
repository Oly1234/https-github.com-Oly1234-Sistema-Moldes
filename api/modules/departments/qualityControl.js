
// api/modules/departments/qualityControl.js
// DEPARTAMENTO: CONTROLE DE QUALIDADE & REFINAMENTO
// Responsabilidade: Upscaling e Finalização de Arquivo (Sem Alucinação).
import { GoogleGenAI } from "@google/genai";

export const generateHighResProductionFile = async (apiKey, imageBase64, targetSize, technique, layoutStyle) => {
    // REQUISITO: USAR SDK OFICIAL PARA CONFIGURAÇÕES AVANÇADAS (4K)
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // MODELO DE VISÃO AVANÇADO (PRO) PARA UPSCALING
    // Apenas o modelo PRO suporta imageSize: '4K' e alta fidelidade
    const MODEL_NAME = 'gemini-3-pro-image-preview'; 

    const TECH_SPEC = technique === 'CYLINDER' 
        ? "Style: Vector Graphic. Flat solid colors. Sharp edges. No anti-aliasing artifacts." 
        : "Style: High-End Digital Print. Photorealistic textile texture. 4K Resolution.";

    const PRODUCTION_PROMPT = `
    ACT AS: Professional Image Upscaler & Restoration AI.
    
    TASK: Upscale the provided textile pattern image to 4K resolution (High Definition).
    
    STRICT RULES (ZERO HALLUCINATION):
    1. FIDELITY: The output MUST be visually identical to the input in terms of design, motifs, and color placement. Do NOT add new elements.
    2. ENHANCEMENT: Remove JPEG artifacts, blur, and noise. Sharpen edges.
    3. RESOLUTION: Output must be high density (300 DPI equivalent) for industrial printing.
    4. SIZE: Maintain the aspect ratio of the original input.
    
    ${TECH_SPEC}
    `;

    // Configuração de Aspect Ratio baseada no Layout
    let aspectRatio = "1:1";
    if (layoutStyle === 'PAREO') aspectRatio = "9:16";
    if (layoutStyle === 'BARRADO') aspectRatio = "16:9"; // Assumindo paisagem para barrados largos

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [
                    { text: PRODUCTION_PROMPT },
                    { inlineData: { mimeType: "image/png", data: imageBase64 } }
                ]
            },
            config: {
                imageConfig: {
                    imageSize: "4K", // FORÇA O MOTOR 4K
                    aspectRatio: aspectRatio 
                }
            }
        });

        // Extração segura da imagem
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        
        throw new Error("O motor de produção falhou em gerar o arquivo 4K.");

    } catch (e) {
        console.error("Production Engine Error:", e);
        throw e;
    }
};

export const enhancePatternQuality = async (apiKey, imageBase64, contextPrompt) => {
    return generateHighResProductionFile(apiKey, imageBase64, "Preview", "DIGITAL", "ORIGINAL");
};
