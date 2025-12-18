
// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo, technique = 'CYLINDER', colorCount = 0, layoutStyle = 'ORIGINAL', subLayoutStyle = '', artStyle = 'ORIGINAL', targetSize = 'PADRAO', customStyle = '') => {
    const ai = new GoogleGenAI({ apiKey });

    // 1. Contexto de Cor
    const colorContext = (colors && colors.length > 0) 
        ? `PALETTE GUIDANCE: Use these tones: ${colors.map(c => c.name).join(', ')}.` 
        : "Use colors that match the requested theme.";

    // 2. LÓGICA BIFURCADA: DIGITAL vs CILINDRO
    let TECHNIQUE_PROMPT = "";
    let NEGATIVE_PROMPT = "";

    if (technique === 'DIGITAL') {
        // --- MODO DIGITAL (RICHEZA, PROFUNDIDADE, DEGRADÊ) ---
        TECHNIQUE_PROMPT = `
        MODE: DIGITAL PRINTING (Sublimation/Direct-to-Fabric).
        
        VISUAL STYLE:
        - HIGH FIDELITY ARTWORK.
        - RICH DETAILS: Allow complex gradients, soft shadows, depth, lighting effects, and tone-on-tone nuances.
        - COLOR: Unlimited color palette. Blends, watercolors, and photographic details are allowed.
        - FINISH: The file should look like a high-end digital artwork (Photoshop/Procreate finish).
        `;
        
        // No modo digital, proibimos apenas a TRAMA DO TECIDO (o fio), mas permitimos textura ARTÍSTICA (papel, pincelada)
        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT (DO NOT INCLUDE):
        - Fabric weave threads (linen texture, canvas grain) -> Unless it's part of the art.
        - Low resolution, jagged lines.
        - Flat vector look (unless requested).
        - Color banding.
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
        artStyleInstruction = `ART STYLE: ${customStyle.toUpperCase()}.`;
    } else {
        switch (artStyle) {
            case 'WATERCOLOR': 
                artStyleInstruction = technique === 'DIGITAL' 
                    ? "ART STYLE: Realistic Watercolor. Wet-on-wet bleeds, translucency, paper grain effect allowed in art."
                    : "ART STYLE: Vector Watercolor. Imitation of watercolor using solid flat shapes (posterization).";
                break;
            case 'GIZ': 
                artStyleInstruction = "ART STYLE: Pastel/Chalk texture."; 
                break;
            case 'ACRILICA': 
                artStyleInstruction = technique === 'DIGITAL'
                    ? "ART STYLE: Oil/Acrylic Painting. Visible brush strokes, impasto depth."
                    : "ART STYLE: Vector Painting. Clean shapes mimicking brush strokes.";
                break;
            case 'VETOR': 
                artStyleInstruction = "ART STYLE: Clean Vector Illustration. Geometric, sharp."; 
                break;
            case 'BORDADO': 
                artStyleInstruction = technique === 'DIGITAL'
                    ? "ART STYLE: Realistic Embroidery. Satin stitch shine, thread depth."
                    : "ART STYLE: Flat Embroidery Vector. Simplified stitch simulation.";
                break;
            default: artStyleInstruction = "ART STYLE: High quality textile design."; break;
        }
    }

    // 4. Layout
    let layoutInstruction = "Seamless repeat pattern (All-over).";
    if (layoutStyle === 'BARRADO') layoutInstruction = "LAYOUT: BORDER PRINT. Heavy motifs at bottom, fading/empty at top.";
    if (layoutStyle === 'LENCO') layoutInstruction = "LAYOUT: ENGINEERED SCARF (Square). Symmetrical/Framed composition.";
    if (layoutStyle === 'PAREO') layoutInstruction = "LAYOUT: PAREO PANEL (Rectangular Vertical).";

    // 5. Prompt Final
    const FULL_PROMPT = `
    GENERATE A TEXTILE PRINT DESIGN FILE.
    
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
