
// api/modules/departments/atelier.js
// DEPARTAMENTO: ANÁLISE DE REFERÊNCIA (Vision to Prompt)
import { GoogleGenAI } from "@google/genai";

// Análise Visual para extrair Prompt da Imagem com foco em Estúdio de Moda Profissional
export const refineDesignPrompt = async (apiKey, imageBase64) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const SYSTEM_PROMPT = `
    ACT AS: Senior Textile Art Director & Fashion Forensic Specialist (Estúdio de Moda Autoral).
    
    TASK: Perform a high-fidelity "Semantic Decomposition" of the print in this image.
    
    CRITICAL INSTRUCTIONS:
    1. IGNORE HUMAN MODELS: If a model is wearing a dress/garment, ignore skin, face, and body shape. Focus ONLY on the flat artwork of the fabric.
    2. BACKGROUND FIDELITY: Identify the EXACT background color (hex or precise tone like "Muted Terracotta", "Deep Sage", "Warm Off-white"). This background MUST be preserved.
    3. DESIGNER TECHNIQUE: Detect if the art looks manually painted (watercolor, gouache), drawn with Photoshop designer brushes (stippled, textured, layered), or vector-based. 
    4. MOTIF ANATOMY: Detail the species, scale, and hierarchy of elements (Primary vs Secondary motifs).
    5. PRODUCTION DEPTH: Describe the layering as a Photoshop designer would (e.g., "overlapping motifs with soft transparency", "manual dry-brush textures").

    OUTPUT: A technical English prompt that enforces: "SAME EXACT BACKGROUND as reference. SAME COLORS. Photoshop Designer/Manual style. High-end feminine fashion print."
    Avoid generic AI terms. Use "Textile Design Studio Workflow".
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { text: SYSTEM_PROMPT },
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
                ]
            }
        });

        const text = response.text;
        return text ? text.trim() : "Technical high-end fashion textile design, designer studio quality.";

    } catch (e) {
        console.error("Atelier Analysis Error:", e);
        return "Professional technical print design faithful to reference.";
    }
};

export const createTextileDesign = async () => null;
