
// api/modules/departments/atelier.js
// DEPARTAMENTO: ANÁLISE DE REFERÊNCIA (Vision to Prompt)
import { GoogleGenAI } from "@google/genai";

// Análise Visual para extrair Prompt da Imagem com foco em Estúdio de Moda Profissional
export const refineDesignPrompt = async (apiKey, imageBase64) => {
    // FIX: Usa a apiKey passada pelo argumento para evitar erro de credenciais (Google Default Credentials)
    if (!apiKey) throw new Error("API Key required for Atelier Analysis.");
    const ai = new GoogleGenAI({ apiKey: apiKey });

    const SYSTEM_PROMPT = `
    ACT AS: Senior Textile Art Director & Fashion Forensic Specialist.
    
    TASK: Analyze this image and write a detailed TEXT TO IMAGE PROMPT to recreate a similar textile design.
    
    CRITICAL INSTRUCTIONS:
    1. IGNORE MODELS/PEOPLE: If there is a person, ignore them. Focus ONLY on the fabric print/pattern.
    2. DECONSTRUCT THE STYLE: Identify the specific artistic technique (e.g., "Vintage Botanical Illustration", "Watercolor", "Vector Pop Art", "Toile de Jouy").
    3. MOTIF HIERARCHY: Describe the primary elements (e.g., "Large Hibiscus flowers"), secondary elements (e.g., "Palm leaves"), and background (e.g., "Solid Navy Blue").
    4. VIBE: Capture the mood (e.g., "Tropical Resort", "Dark Academia", "Cottagecore").
    
    OUTPUT: A single, dense, high-quality English prompt starting with "A seamless textile pattern design...". Include specific color names and artistic directives.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Vision model fast
            contents: {
                parts: [
                    { text: SYSTEM_PROMPT },
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
                ]
            }
        });

        const text = response.text;
        return text ? text.trim() : "Seamless high-end fashion textile pattern, botanical luxury style.";

    } catch (e) {
        console.error("Atelier Analysis Error:", e);
        return "Professional technical print design faithful to reference.";
    }
};

export const createTextileDesign = async () => null;
