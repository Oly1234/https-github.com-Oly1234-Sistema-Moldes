
// api/modules/departments/atelier.js
// DEPARTAMENTO: ANÁLISE DE REFERÊNCIA (Vision to Prompt)
import { GoogleGenAI } from "@google/genai";

// Análise Visual Ultra-Precisa para extrair o DNA da Estampa
export const refineDesignPrompt = async (apiKey, imageBase64) => {
    const ai = new GoogleGenAI({ apiKey });

    const SYSTEM_PROMPT = `
    ACT AS: Senior Textile Art Director & Botanical Illustrator (Forensic Specialist).
    
    TASK: Perform a technical "Semantic Decomposition" of this image to guide a PRECISE LUXURY DIGITAL REPRODUCTION.
    
    ANALYSIS PROTOCOL:
    1. MOTIF IDENTIFICATION (Species & Form): Do not just say "flower" or "leaf". Identify the exact species if possible (e.g., "Hibiscus rosa-sinensis", "Monstera deliciosa") or describe the specific anatomy (e.g., "serrated edges", "tubular petals", "veined foliage").
    2. STROKE & LINEAGE: Analyze how the art was drawn. Is it a "0.1mm technical pen", a "textured dry-brush stroke", "bleeding watercolor edges", or "clean vector bezier curves"?
    3. BACKGROUND ARCHITECTURE: Identify if the background is a "flat solid color", a "multi-tonal watercolor wash", "recycled paper grain", or "atmospheric gradient with soft bokeh".
    4. SHADING & LIGHTING: Map the light source. Are there "directional highlights", "soft drop shadows creating 3D lift", or "inner glows"?
    5. ARTISTIC TECHNIQUE: Define the style precisely: "Art Nouveau illustration", "Impasto Oil Painting", "Photorealistic Digital Collage", "Minimalist Japanese Line Art".
    6. COLOR ATMOSPHERE: Describe transitions like "velvety tone-on-tone gradients" or "high-contrast vibrant accents".

    OUTPUT: A technical, extremely rich narrative prompt (in English) that describes every layer of this artwork as if explaining it to a master painter.
    Start directly with the technical breakdown.
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
        return text ? text.trim() : "Clean high-end digital textile pattern with sophisticated motifs.";

    } catch (e) {
        console.error("Atelier Analysis Error:", e);
        return "Professional high-fidelity textile print design.";
    }
};

export const createTextileDesign = async () => null; // Stub
