
// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo, technique = 'CYLINDER', colorCount = 0, layoutStyle = 'ORIGINAL', subLayoutStyle = '', artStyle = 'ORIGINAL', targetSize = 'PADRAO', customStyle = '') => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // 1. Fidelidade Cromática de Estúdio
    const colorContext = (colors && colors.length > 0) 
        ? `STRICT COLOR FIDELITY: Use the EXACT colors from reference: [${colors.map(c => c.name).join(', ')}]. 
           The BACKGROUND tone must match the reference analysis perfectly. 
           Ensure micro-variations and tone-on-tone nuances used by professional textile designers.` 
        : "COLOR MASTER DIRECTIVE: Create a sophisticated authorial palette for high-end fashion.";

    // 2. Inteligência Têxtil (Mentalidade de Estúdio Digital vs Cilindro)
    let TECHNIQUE_PROMPT = "";
    let NEGATIVE_PROMPT = "";

    if (technique === 'DIGITAL') {
        // --- MODO DIGITAL (Estúdio de Moda Profissional / Estilo Farm Rio) ---
        TECHNIQUE_PROMPT = `
        MODE: SUPREME DIGITAL TEXTILE MASTERPIECE.
        ACT AS: Professional Textile Designer in a High-End Fashion Studio.
        
        VISUAL RULES:
        - STYLE: This MUST look like a technical print file created in Photoshop or an Atelier. No generic AI art.
        - FINISH: Use rich chromatic depth, organic gradients, tone-on-tone variations, and layered transparency.
        - BACKGROUND: Treat background as an active textile surface with subtle manual texture and breathability.
        - TECHNIQUE: Visible manual brush strokes, hand-painted gouache effects, and professional stippling.
        - COMPOSITION: Elements must have volume, material depth, and clear hierarchy.
        - CONTRAST: Balanced textile contrast for high-quality digital printing on silk/viscose.
        `;
        
        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT: generic AI look, 3D render, cinematic lighting, neon glow, photorealistic humans, skin, blurry backgrounds, stock photo style, amateur illustration, plastic texture, flat dead colors, glowing edges.
        `;
    } else {
        // --- MODO CILINDRO (Engenharia de Gravação) ---
        TECHNIQUE_PROMPT = `
        MODE: ROTARY SCREEN PRINTING (Cylinder Engineering).
        STYLE: Solid Flat Shapes, Sharp Technical Edges, Hard Color Blocking.
        RULES: No gradients, no transparency, no shadows. Ready for screen separation.
        LIMIT: Optimized for ${colorCount > 0 ? colorCount : '8'} screens.
        `;

        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT: Gradients, Shadows, 3D volume, textures, blur, transparency, realistic photo.
        `;
    }

    // 3. Estilo e Linguagem de Moda
    let artStyleInstruction = "ART STYLE: Technical fashion print.";
    if (artStyle === 'CUSTOM' && customStyle) {
        artStyleInstruction = `ART STYLE: ${customStyle.toUpperCase()}. Interpret with manual designer precision.`;
    } else {
        switch (artStyle) {
            case 'WATERCOLOR': 
                artStyleInstruction = "ART STYLE: Manual Atelier Watercolor. Realistic wet-on-wet edges and pigment rings."; break;
            case 'ACRILICA': 
                artStyleInstruction = "ART STYLE: Hand-painted Acrylic. Visible heavy brush textures and manual layering."; break;
            case 'VETOR': 
                artStyleInstruction = "ART STYLE: Clean professional vector illustration for textile design."; break;
            default: artStyleInstruction = "ART STYLE: High-end textile print studio finish."; break;
        }
    }

    const FULL_PROMPT = `
    MASTER PRODUCTION DIRECTIVE: REPRODUCE THIS PRINT AS A TECHNICAL FASHION MASTERPIECE.
    REFERENCE DNA: ${prompt}.
    
    ${TECHNIQUE_PROMPT}
    ${artStyleInstruction}
    ${colorContext}
    
    LAYOUT: ${layoutStyle === 'PAREO' ? 'Rectangular Placement' : 'Seamless Repeat Pattern'}.
    
    ${NEGATIVE_PROMPT}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: FULL_PROMPT }] },
            config: {
                imageConfig: { aspectRatio: layoutStyle === 'PAREO' ? "9:16" : "1:1" }
            }
        });

        let imageUrl = null;
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                }
            }
        }
        if (!imageUrl) throw new Error("A IA falhou na renderização têxtil.");
        return imageUrl;
    } catch (e) { throw e; }
};

export const generateTextureLayer = async (apiKey, textureType, prompt) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const TEXTURE_PROMPT = `GENERATE A SEAMLESS TEXTURE MASK: ${textureType} (${prompt}). Grayscale heightmap, high fidelity.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: TEXTURE_PROMPT }] }
        });
        let imageUrl = null;
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) { imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`; break; }
            }
        }
        return imageUrl;
    } catch (e) { return null; }
};
