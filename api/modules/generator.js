
// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo, technique = 'CYLINDER', colorCount = 0, layoutStyle = 'ORIGINAL', subLayoutStyle = '', artStyle = 'ORIGINAL', targetSize = 'PADRAO', customStyle = '') => {
    const ai = new GoogleGenAI({ apiKey });

    // 1. Contexto de Cor
    const colorContext = (colors && colors.length > 0) 
        ? `STRICT PALETTE: ${colors.map(c => c.name).join(', ')}. Dominant tones: ${colors.slice(0,2).map(c => c.hex).join(', ')}.` 
        : "Use colors that match the requested theme.";

    // 2. Contexto de Estilo - REFORÇO ANTI-TRAMA
    let artStyleInstruction = "";
    const CLEANUP_TOKEN = "RENDER STYLE: VECTOR FLAT. NO NOISE. NO TEXTURE. NO GRAIN. SOLID COLORS.";
    
    if (artStyle === 'CUSTOM' && customStyle) {
        artStyleInstruction = `ART STYLE: ${customStyle.toUpperCase()}. ${CLEANUP_TOKEN}`;
    } else {
        switch (artStyle) {
            case 'WATERCOLOR': artStyleInstruction = "ART STYLE: DIGITAL WATERCOLOR. Wet effects on PURE WHITE digital canvas. NO PAPER TEXTURE."; break;
            case 'GIZ': artStyleInstruction = "ART STYLE: DIGITAL PASTEL. Chalk texture only on strokes, solid background."; break;
            case 'ACRILICA': artStyleInstruction = "ART STYLE: DIGITAL PAINTING. Smooth gradients, no canvas bumps."; break;
            case 'VETOR': artStyleInstruction = "ART STYLE: ADOBE ILLUSTRATOR VECTOR. Sharp geometric lines. Unlimited resolution feel."; break;
            case 'BORDADO': artStyleInstruction = "ART STYLE: FLAT EMBROIDERY VECTOR. Stitch look but purely graphical. No fabric shadows."; break;
            default: artStyleInstruction = `ART STYLE: ${CLEANUP_TOKEN}`; break;
        }
    }

    // 3. Layout & Specs
    let layoutInstruction = "Seamless repeat pattern (All-over).";
    if (layoutStyle === 'BARRADO') layoutInstruction = "LAYOUT: BORDER PRINT (Barrado). Heavy motifs at bottom, white space top.";
    if (layoutStyle === 'LENCO') layoutInstruction = "LAYOUT: ENGINEERED SCARF (Carré). Symmetrical borders.";
    if (layoutStyle === 'PAREO') layoutInstruction = "LAYOUT: PAREO PANEL (Rectangular).";

    // 4. Prompt Final - TRAVA AGRESSIVA DE TEXTURA
    const FULL_PROMPT = `
    GENERATE A TEXTILE PRINT FILE (SOURCE ASSET).
    
    THEME: ${prompt}.
    
    CRITICAL EXCLUSION LIST (NEGATIVE PROMPT):
    - NO FABRIC WEAVE (Linen, Twill, Canvas).
    - NO SURFACE NOISE (Dust, Scratches, Heather, Slub).
    - NO LIGHTING EFFECTS (Shadows, Folds, Drapes).
    - NO REALISM (Do not make it look like a photo of cloth).
    
    VISUAL TARGET:
    - Pure Digital Art File.
    - Perfect for Sublimation or Rotary Printing.
    - Clean lines, distinct colors.
    
    ${layoutInstruction}
    ${artStyleInstruction}
    ${colorContext}
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

// NOVO: GERADOR DE TEXTURA DEDICADO
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
    
    Examples:
    - "Linen": Crosshatch thread pattern.
    - "Canvas": Heavy woven fabric.
    - "Paper": Fibrous pulp noise.
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
