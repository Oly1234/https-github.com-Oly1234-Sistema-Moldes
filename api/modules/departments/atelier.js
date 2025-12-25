
// api/modules/departments/atelier.js
// DEPARTAMENTO: ANÁLISE DE REFERÊNCIA (Vision to Prompt)
import { GoogleGenAI } from "@google/genai";

// Análise Visual para extrair Prompt da Imagem com foco em Estúdio de Moda Profissional
export const refineDesignPrompt = async (apiKey, imageBase64) => {
    if (!apiKey) throw new Error("API Key required for Atelier Analysis.");
    const ai = new GoogleGenAI({ apiKey: apiKey });

    const SYSTEM_PROMPT = `
    ACT AS: Senior Art Director for Textile Design.
    
    TASK: Analyze this image and write a vivid, descriptive TEXT-TO-IMAGE PROMPT to recreate this exact textile design style and content.
    
    INSTRUCTIONS:
    1. IGNORE the garment shape or model. Focus 100% on the PRINT/PATTERN.
    2. Describe the ARTISTIC STYLE (e.g., "Vintage Botanical Illustration", "Abstract Expressionist Brushstrokes", "Geometric Bauhaus").
    3. Describe the MOTIFS (e.g., "Large sprawling hibiscus flowers", "Tiny geometric polka dots", "Baroque swirls").
    4. Describe the COLORS and MOOD (e.g., "Vibrant tropical summer palette", "Muted earth tones, melancholic").
    5. OUTPUT FORMAT: A single paragraph, highly descriptive, ready for an AI image generator. Start with "A seamless textile pattern...".
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: {
                parts: [
                    { text: SYSTEM_PROMPT },
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
                ]
            }
        });

        const text = response.text;
        return text ? text.trim() : "A seamless high-fashion textile pattern with intricate details.";

    } catch (e) {
        console.error("Atelier Analysis Error:", e);
        return "Professional textile pattern design.";
    }
};

export const createTextileDesign = async () => null;
