
// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo, technique = 'CYLINDER', colorCount = 0, layoutStyle = 'ORIGINAL', subLayoutStyle = '', artStyle = 'ORIGINAL', targetSize = 'PADRAO', customStyle = '') => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // 1. Colorista Sênior: Fidelidade Absoluta ao Fundo e Elementos
    const colorContext = (colors && colors.length > 0) 
        ? `STRICT COLOR FIDELITY: Use the EXACT background color and motifs colors from the reference analysis. 
           Palette: [${colors.map(c => c.name).join(', ')}]. 
           The BACKGROUND tone must be identical to the reference. 
           Avoid oversaturated RGB; use professional textile ink tones.` 
        : "COLOR MASTER DIRECTIVE: Sophisticated high-end fashion palette, faithful to original reference background.";

    // 2. Lógica de Técnica: "Mentalidade de Estúdio de Moda" (Modo Digital vs Cilindro)
    let TECHNIQUE_PROMPT = "";
    let NEGATIVE_PROMPT = "";

    if (technique === 'DIGITAL') {
        // --- MODO DIGITAL (Estúdio de Moda Autoral / Photoshop Style) ---
        TECHNIQUE_PROMPT = `
        MODE: SUPREME DIGITAL TEXTILE MASTERPIECE (Estúdio de Estamparia Autoral).
        STYLE: This MUST look like it was manually created by a designer in Photoshop or a traditional atelier (Farm Rio style).
        
        VISUAL RULES:
        - DESIGNER WORKFLOW: Apply high chromatic richness, tone-on-tone variations, organic gradients, and layered depth.
        - NO GENERIC AI ART: Avoid glowing edges, plastic looks, or cinematic 3D lighting. 
        - TEXTURE: Visible manual brush strokes, hand-painted gouache effects, and professional stippling.
        - BACKGROUND: Treat the background as an active part of the composition with subtle depth and textile texture.
        - FINISH: 2D technical layout for high-end feminine fashion production.
        - COMPOSITION: Elements must have visual volume, clear reading, and organic integration.
        `;
        
        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT: generic AI look, 3D render, cinematic lighting, neon glow, photorealistic humans, blurry backgrounds, stock photo style, amateur illustration, plastic texture, flat dead colors.
        `;
    } else {
        // --- MODO CILINDRO (Vetorial/Chapado) ---
        TECHNIQUE_PROMPT = `
        MODE: ROTARY SCREEN PRINTING (Cylinder Engineering).
        STYLE: Solid Flat Shapes, Sharp Edges, Hard Color Blocking.
        RULES: No gradients, no shadows, no transparency. Sharp technical edges.
        LIMIT: Optimized for ${colorCount > 0 ? colorCount : '8'} technical screens.
        `;

        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT: Gradients, Shadows, Light effects, 3D volume, textures, blur, transparency, realistic photo.
        `;
    }

    // 3. Estilo Artístico (Adaptado à técnica)
    let artStyleInstruction = "STYLE: Technical high-end fashion print.";
    if (artStyle === 'CUSTOM' && customStyle) {
        artStyleInstruction = `ART STYLE: ${customStyle.toUpperCase()}. Interpret with manual designer precision.`;
    } else {
        switch (artStyle) {
            case 'WATERCOLOR': 
                artStyleInstruction = technique === 'DIGITAL' 
                    ? "ART STYLE: Manual Atelier Watercolor. Wet-on-wet edges and realistic pigment drying rings on fabric."
                    : "ART STYLE: Vector Watercolor simulation using flat solid shapes.";
                break;
            case 'ACRILICA': 
                artStyleInstruction = technique === 'DIGITAL'
                    ? "ART STYLE: Hand-painted Acrylic. Visible brush strokes, impasto depth, and manual paint layering."
                    : "ART STYLE: Flat Acrylic vector look.";
                break;
            case 'VETOR': 
                artStyleInstruction = "ART STYLE: Clean technical vector illustration (Illustrator Style)."; 
                break;
            default: artStyleInstruction = "ART STYLE: High quality textile print studio finish."; break;
        }
    }

    // 4. Layout
    let layoutInstruction = "Seamless repeat pattern.";
    if (layoutStyle === 'BARRADO') layoutInstruction = "LAYOUT: ENGINEERED BORDER (BARRADO). Heavy motifs at selvedge, fading elegantly.";
    if (layoutStyle === 'LENCO') layoutInstruction = "LAYOUT: PLACEMENT SCARF / LENÇO with technical frame borders.";

    // 5. Prompt Final Consolidado
    const FULL_PROMPT = `
    PRODUCTION DIRECTIVE: CREATE A TECHNICAL TEXTILE MASTERPIECE.
    
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
    const TEXTURE_PROMPT = `GENERATE A SEAMLESS TEXTURE MASK: ${textureType} (${prompt}). Grayscale, 4K, technical tile.`;
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
