
// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo, technique = 'CYLINDER', colorCount = 0, layoutStyle = 'ORIGINAL', subLayoutStyle = '', artStyle = 'ORIGINAL', targetSize = 'PADRAO', customStyle = '') => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // 1. Colorista Sênior: Fidelidade Absoluta
    const colorContext = (colors && colors.length > 0) 
        ? `STRICT COLOR DIRECTIVE: Use the EXACT colors: [${colors.map(c => c.name).join(', ')}]. 
           The BACKGROUND must match the reference's base tone perfectly. 
           Ensure colors feel like professional textile inks, not oversaturated digital RGB.` 
        : "COLOR MASTER DIRECTIVE: Create a high-end luxury palette based on feminine fashion trends.";

    // 2. Lógica de Técnica (Mantendo Cilindro e Elevando Digital para Photoshop Style)
    let TECHNIQUE_PROMPT = "";
    let NEGATIVE_PROMPT = "";

    if (technique === 'DIGITAL') {
        TECHNIQUE_PROMPT = `
        MODE: SUPREME DIGITAL TEXTILE MASTERPIECE.
        ACT AS: Senior Textile Designer using Photoshop and traditional media.
        
        VISUAL STRATEGY:
        - STYLE: It MUST look like a technical print file created by a human designer in Photoshop.
        - TEXTURE: Visible manual brush strokes, hand-painted gouache effects, and professional stippling.
        - FIDELITY: Maintain the EXACT SOLID BACKGROUND from the prompt analysis.
        - DEPTH: Use professional layering (source-over/multiply look). Motifs should have a "painted" volume, not a generic AI glow.
        - FINISH: 2D technical layout for high-end feminine fashion (Estamparia de Luxo).
        `;
        
        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT: generic AI art style, 3D render, cinematic lighting, neon glow, photorealistic humans, blurry backgrounds, stock photo style, amateur illustration, cartoon.
        `;
    } else {
        // MODO CILINDRO: VETORIAL / CHAPADO
        TECHNIQUE_PROMPT = `
        MODE: ROTARY SCREEN PRINTING (Cylinder Engineering).
        STYLE: Solid Flat Shapes, Sharp Edges, Hard Color Blocking.
        RULES: No gradients, no shadows, no transparency. Sharp edges only.
        LIMIT: Optimized for ${colorCount > 0 ? colorCount : '8'} technical screens.
        `;

        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT: Gradients, Shadows, Light effects, 3D volume, textures, blur, transparency, realistic photo.
        `;
    }

    // 3. Estilo Artístico (Adaptado para Designer Manual)
    let artStyleInstruction = "STYLE: Contemporary high-end fashion print.";
    if (artStyle === 'CUSTOM' && customStyle) {
        artStyleInstruction = `ART STYLE: ${customStyle.toUpperCase()}. Interpret with designer precision.`;
    } else {
        switch (artStyle) {
            case 'WATERCOLOR': 
                artStyleInstruction = "STYLE: Manual Atelier Watercolor. Wet-on-wet edges and realistic pigment drying rings on fabric."; 
                break;
            case 'ACRILICA': 
                artStyleInstruction = "STYLE: Hand-painted Acrylic. Visible heavy brush textures and manual paint layering."; 
                break;
            case 'VETOR': 
                artStyleInstruction = "STYLE: Clean technical vector illustration for silk screen."; 
                break;
        }
    }

    // 4. Layout
    let layoutInstruction = "Seamless infinite repeat pattern.";
    if (layoutStyle === 'BARRADO') layoutInstruction = "LAYOUT: ENGINEERED BORDER (BARRADO). High density at the selvedge, elegantly fading upwards.";
    if (layoutStyle === 'LENCO') layoutInstruction = "LAYOUT: PLACEMENT SCARF / LENÇO with intricate frame borders.";

    const FULL_PROMPT = `
    PRODUCTION DIRECTIVE: CREATE A TECHNICAL MASTERPIECE FOR TEXTILE PRODUCTION.
    REFERENCE DNA: ${prompt}.
    
    ${TECHNIQUE_PROMPT}
    ${layoutInstruction}
    ${artStyleInstruction}
    ${colorContext}
    ${NEGATIVE_PROMPT}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: FULL_PROMPT }] },
            config: { imageConfig: { aspectRatio: layoutStyle === 'PAREO' ? "9:16" : "1:1" } }
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
        if (!imageUrl) throw new Error("Creative engine failed.");
        return imageUrl;
    } catch (e) { throw e; }
};

export const generateTextureLayer = async (apiKey, textureType, texturePrompt) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const TEXTURE_PROMPT = `GENERATE A SEAMLESS HD TEXTURE. TYPE: ${textureType} (${texturePrompt}). Grayscale heightmap style.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: TEXTURE_PROMPT }] },
            config: { imageConfig: { aspectRatio: "1:1" } }
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
