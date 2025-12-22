
// api/modules/departments/atelier.js
// DEPARTAMENTO: ANÁLISE DE REFERÊNCIA (Vision to Prompt)
import { GoogleGenAI } from "@google/genai";

// Análise Visual para extrair Prompt da Imagem com foco em fidelidade técnica
export const refineDesignPrompt = async (apiKey, imageBase64) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const SYSTEM_PROMPT = `
    ACT AS: Senior Textile Art Director & Forensic Pattern Specialist.
    
    TASK: Perform a technical "Semantic Decomposition" of the textile design in this image.
    
    CRITICAL INSTRUCTIONS:
    1. IGNORE MODELS: If a person is wearing the garment, ignore skin, face, and body. Focus ONLY on the flat artwork of the fabric.
    2. BACKGROUND COLOR: Identify the EXACT background color (e.g., "warm off-white", "deep emerald green", "muted sandy beige"). This color is mandatory.
    3. MOTIF ANALYSIS: Identify specific elements (botanical species, geometric types) and their exact colors.
    4. TECHNIQUE DETECTION: Determine if it looks manually painted (watercolor/gouache), drawn with professional Photoshop brushes (stippled, textured), or vector.
    5. DESIGNER STYLE: Describe it as a "technical print file for high-end fashion" (moda feminina).

    OUTPUT: A technical English description. 
    Enforce: "Keep the EXACT [Color] background and [Color] motifs from the reference. Professional Photoshop designer style with manual-looking textures."
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
        return text ? text.trim() : "Technical textile print design, professional studio quality.";

    } catch (e) {
        console.error("Atelier Analysis Error:", e);
        return "Professional high-fidelity textile pattern elevation.";
    }
};

export const createTextileDesign = async () => null;
