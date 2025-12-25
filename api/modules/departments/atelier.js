
// api/modules/departments/atelier.js
// DEPARTAMENTO: ANÁLISE DE REFERÊNCIA (Vision to Prompt)
import { GoogleGenAI } from "@google/genai";

// Análise Visual para extrair Prompt da Imagem com foco em Estúdio de Moda Profissional
export const refineDesignPrompt = async (apiKey, imageBase64) => {
    // FIX: Usa a apiKey passada pelo argumento para evitar erro de credenciais (Google Default Credentials)
    const ai = new GoogleGenAI({ apiKey: apiKey });

    const SYSTEM_PROMPT = `
    ACT AS: Senior Textile Art Director & Fashion Forensic Specialist (Estúdio de Moda Autoral).
    
    TASK: Perform a high-fidelity technical "Semantic Decomposition" of the textile design in this image.
    
    CRITICAL INSTRUCTIONS:
    1. IGNORE HUMAN MODELS: If a person is wearing the garment, ignore skin, face, and body. Focus ONLY on the flat artwork of the fabric as if it were a digital file.
    2. BACKGROUND FIDELITY: Identify the EXACT background color (hex-like precision or technical names like "warm ivory", "muted sage", "vintage navy"). This background MUST be preserved.
    3. DESIGNER TECHNIQUE: Detect if the art looks manually painted (watercolor, gouache, acrylic), drawn in Photoshop (professional brush textures, stippling, layering), or clean vector.
    4. MOTIF ANATOMY: Identify the rhythm, hierarchy of elements, and specific botanical/geometric species.
    5. PROFESSIONAL FINISH: Describe how a Photoshop designer would layer this (transparencies, multiply modes, hand-stippled edges).

    OUTPUT: A technical English prompt that enforces: "KEEP THE EXACT [Color] BACKGROUND AND [Color] MOTIFS. Photoshop Designer / Manual Studio Style. Professional high-end feminine fashion print."
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
