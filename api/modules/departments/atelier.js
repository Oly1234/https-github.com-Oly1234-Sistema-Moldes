
// api/modules/departments/atelier.js
// DEPARTAMENTO: ANÁLISE DE REFERÊNCIA (Vision to Prompt)
import { GoogleGenAI } from "@google/genai";

// Análise Visual para extrair Prompt da Imagem
export const refineDesignPrompt = async (apiKey, imageBase64) => {
    const ai = new GoogleGenAI({ apiKey });

    const SYSTEM_PROMPT = `
    Act as a Senior Textile Art Director specializing in VECTOR RESTORATION.
    
    TASK: Analyze this image to create a prompt for a DIGITAL REPRODUCTION.
    
    CRITICAL INSTRUCTION - IGNORE MATERIALITY:
    1. IGNORE the fabric weave (linen threads, twill lines, canvas grain). These are physical defects, not art.
    2. IGNORE lighting, folds, wrinkles, and shadows.
    3. IGNORE print distress, vintage fading, or screen print noise.
    
    FOCUS ONLY ON:
    - The graphic motifs (shapes, flowers, geometrics).
    - The intended solid colors (color blocking).
    - The artistic style (Bauhaus, Art Deco, Watercolor).
    
    OUTPUT: A single, detailed prompt description to recreate the GRAPHIC ARTWORK as a pristine digital file.
    Start with: "Flat digital pattern design..."
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
        return text ? text.trim() : "Estampa vetorial limpa.";

    } catch (e) {
        console.error("Atelier Analysis Error:", e);
        return "Estampa têxtil padronizada.";
    }
};

export const createTextileDesign = async () => null; // Stub
