
// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo, technique = 'CYLINDER', colorCount = 0, layoutStyle = 'ORIGINAL', subLayoutStyle = '', artStyle = 'ORIGINAL', targetSize = 'PADRAO', customStyle = '') => {
    const ai = new GoogleGenAI({ apiKey });

    // 1. Contexto de Cor - Enriquecimento para o modo Digital
    const colorContext = (colors && colors.length > 0) 
        ? `PALETTE GUIDANCE: Use these tones as base: ${colors.map(c => c.name).join(', ')}. Create sophisticated variations including tints, shades, and professional tone-on-tone transitions.` 
        : "Use an infinite, professionally balanced color spectrum with high luminous contrast.";

    // 2. LÓGICA BIFURCADA: DIGITAL vs CILINDRO
    let TECHNIQUE_PROMPT = "";
    let NEGATIVE_PROMPT = "";

    if (technique === 'DIGITAL') {
        // --- MODO DIGITAL (SENIOR COLORIST & LUXURY FINISH) ---
        TECHNIQUE_PROMPT = `
        MODE: HIGH-END DIGITAL TEXTILE MASTERPIECE.
        ACT AS: Senior Textile Colorist & Digital Illustrator for Luxury Fashion.
        
        VISUAL STRATEGY:
        - ULTRA-RICH FIDELITY: Even if the theme is simple, render it with extraordinary complexity and artistic depth.
        - VOLUME & DEPTH: Use advanced chiaroscuro. Motifs must have 3D-like volume, realistic soft shadows, and overlapping layers that create a sense of physical space.
        - COLOR SOPHISTICATION: Implement intricate tone-on-tone layering, silky gradients, and atmospheric translucency (transparency effects).
        - PERSPECTIVE: Use atmospheric perspective to create depth between background and foreground elements.
        - MICRO-DETAILS: Every motif should have internal textures, fine veins, or subtle light reflections.
        - FINISH: The final file must look like a high-definition painting from a premier Italian design studio.
        `;
        
        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT (DO NOT INCLUDE):
        - Flat vector look, simple blocks of color, jagged edges, low resolution.
        - Hard outlines (unless requested), cartoonish styles, lack of shading.
        - Muddy colors, poor contrast, 2D appearance.
        `;

    } else {
        // --- MODO CILINDRO (VETORIAL, CHAPADO, SEPARAÇÃO) ---
        TECHNIQUE_PROMPT = `
        MODE: ROTARY SCREEN PRINTING (Cylinder/Separated Colors).
        
        VISUAL STYLE:
        - FLAT VECTOR ARTWORK (Adobe Illustrator style).
        - SOLID COLORS ONLY: No gradients, no opacity, no blurs, no soft shadows.
        - HARD EDGES: Distinct separation between colors.
        - COMPOSITION: 2D Flat view. No perspective.
        `;

        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT (DO NOT INCLUDE):
        - Gradients, Shadows, Lighting effects, 3D depth.
        - Fabric texture, noise, grain.
        - Blur, glow, transparency.
        - Realistic photo elements.
        `;
    }

    // 3. Contexto de Estilo (Adaptado à técnica)
    let artStyleInstruction = "";
    if (artStyle === 'CUSTOM' && customStyle) {
        artStyleInstruction = `ART STYLE: ${customStyle.toUpperCase()}. Apply this style with professional artistic rigor.`;
    } else {
        switch (artStyle) {
            case 'WATERCOLOR': 
                artStyleInstruction = technique === 'DIGITAL' 
                    ? "ART STYLE: Hyper-realistic Digital Watercolor. Wet-on-wet bleeds, realistic pigment drying edges, and translucent layering."
                    : "ART STYLE: Vector Watercolor. Imitation of watercolor using solid flat shapes (posterization).";
                break;
            case 'GIZ': 
                artStyleInstruction = "ART STYLE: Artistic Pastel/Chalk with visible grain and blended transitions."; 
                break;
            case 'ACRILICA': 
                artStyleInstruction = technique === 'DIGITAL'
                    ? "ART STYLE: Impasto Oil/Acrylic Painting. Visible 3D brush strokes, thick paint texture, and dramatic lighting."
                    : "ART STYLE: Vector Painting. Clean shapes mimicking brush strokes.";
                break;
            case 'VETOR': 
                artStyleInstruction = "ART STYLE: High-end Vector Illustration. Sharp, geometric, yet sophisticated in composition."; 
                break;
            case 'BORDADO': 
                artStyleInstruction = technique === 'DIGITAL'
                    ? "ART STYLE: Photorealistic Embroidery. Visible thread shine (satin stitch), physical thread depth, and realistic fabric puckering."
                    : "ART STYLE: Flat Embroidery Vector. Simplified stitch simulation.";
                break;
            default: artStyleInstruction = "ART STYLE: Professional high-quality textile design with premium aesthetic standards."; break;
        }
    }

    // 4. Layout
    let layoutInstruction = "Seamless repeat pattern (All-over).";
    if (layoutStyle === 'BARRADO') layoutInstruction = "LAYOUT: ENGINEERED BORDER PRINT. Richly detailed motifs at the selvedge, creating a luxurious fading or transition towards the top.";
    if (layoutStyle === 'LENCO') layoutInstruction = "LAYOUT: LUXURY ENGINEERED SCARF (Square). Intricate border framing and central masterpiece motif.";
    if (layoutStyle === 'PAREO') layoutInstruction = "LAYOUT: VERTICAL PAREO PANEL. Composition designed for fluid drape and high visual impact.";

    // 5. Prompt Final
    const FULL_PROMPT = `
    GENERATE A PROFESSIONAL TEXTILE PRINT DESIGN.
    
    THEME: ${prompt}.
    
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

        if (!imageUrl) throw new Error("A IA não gerou a imagem.");
        return imageUrl;

    } catch (e) {
        console.error("Generator Error:", e);
        throw e;
    }
};

// GERADOR DE TEXTURA DEDICADO
export const generateTextureLayer = async (apiKey, textureType, prompt) => {
    const ai = new GoogleGenAI({ apiKey });
    
    const TEXTURE_PROMPT = `
    GENERATE A SEAMLESS TEXTURE MASK (Grayscale Heightmap).
    
    TYPE: ${textureType} (${prompt}).
    
    VISUAL RULES:
    1. GRAYSCALE ONLY: White = High, Black = Low.
    2. SEAMLESS: Must tile perfectly.
    3. VIEW: Macro close-up top down.
    4. NO OBJECTS: Only the surface grain/structure.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: TEXTURE_PROMPT }] },
            config: { imageConfig: { aspectRatio: "1:1" } }
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
        return imageUrl;
    } catch (e) {
        console.error("Texture Gen Error:", e);
        return null;
    }
};
