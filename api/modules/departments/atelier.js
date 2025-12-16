// api/modules/departments/atelier.js
// DEPARTAMENTO: ANÁLISE DE REFERÊNCIA (Vision to Prompt)
import { GoogleGenAI } from "@google/genai";

// Análise Visual para extrair Prompt da Imagem
export const refineDesignPrompt = async (apiKey, imageBase64) => {
    const ai = new GoogleGenAI({ apiKey });

    const SYSTEM_PROMPT = `
    Act as a Senior Textile Art Director. Analyze this image for technical reproduction.
    
    OUTPUT: A single, detailed prompt description to recreate this exact pattern style.
    Include: Elements, background color, art style (watercolor/vector/geometric).
    Keep it direct. No intro.
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

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        return text ? text.trim() : "Estampa geométrica abstrata.";

    } catch (e) {
        console.error("Atelier Analysis Error:", e);
        return "Estampa têxtil padronizada.";
    }
};

export const createTextileDesign = async () => null; // Stub