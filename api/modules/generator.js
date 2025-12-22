
// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo, technique = 'CYLINDER', colorCount = 0, layoutStyle = 'ORIGINAL', subLayoutStyle = '', artStyle = 'ORIGINAL', targetSize = 'PADRAO', customStyle = '') => {
    const ai = new GoogleGenAI({ apiKey });

    // 1. Contexto de Cor - Curadoria do Colorista Sênior
    const colorContext = (colors && colors.length > 0) 
        ? `COLOR MASTER DIRECTIVE: Use the provided palette [${colors.map(c => c.name).join(', ')}] as the structural base. Implement sophisticated tone-on-tone transitions. CRITICAL: Add "Jewel-tone accents" and high-luminous contrast highlights to create a premium visual "pop" that harmonizes perfectly with the base tones.` 
        : "COLOR MASTER DIRECTIVE: Create a high-end luxury palette. Use harmonious analogous schemes with unexpected complementary accent colors. Ensure vibrant, deep saturation balanced by elegant neutral mid-tones.";

    // 2. LÓGICA BIFURCADA: DIGITAL (SENIOR DUO) vs CILINDRO (TECHNICAL)
    let TECHNIQUE_PROMPT = "";
    let NEGATIVE_PROMPT = "";

    if (technique === 'DIGITAL') {
        // --- MODO DIGITAL: O DUO SÊNIOR (DESIGNER + COLORISTA) ---
        TECHNIQUE_PROMPT = `
        MODE: SUPREME DIGITAL TEXTILE MASTERPIECE (4K RESOLUTION).
        
        PERSONA 1 (SENIOR TEXTILE DESIGNER):
        - FIDELITY: Follow the forensic analysis details exactly. If a specific species or stroke type is mentioned, render it with hyper-precision.
        - ARTISTIC DEPTH: Create 3D volume using chiaroscuro. Motifs must feel tangible with soft realistic shadows and sharp highlights.
        - ATMOSPHERIC PERSPECTIVE: Layer elements to create foreground, midground, and background depth. Use subtle blurs and translucency.
        - MICRO-TEXTURES: Inlay motifs with realistic fabric grains, organic veins, or fine brush-stroke textures.
        - LIGHTING: Apply a "Studio Lighting" effect. Dramatic directional light that enhances shape and texture.
        
        PERSONA 2 (MASTER COLORIST):
        - CHROMATIC RICHNESS: Enrich the design with infinite color gradations and subtle transitions.
        - ACCENT STRATEGY: Use vibrant accent colors in tiny, strategic details to catch the eye and elevate the design.
        - LUXURY FINISH: The overall look must be "High-Fashion Editorial" – expensive, intricate, and visually superior to the input reference.
        `;
        
        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT: Flat 2D look, simple fill colors, cartoon style, muddy/dirty colors, low contrast, basic vector shapes, jagged edges, pixelated noise, boring layout, blurry textures.
        `;

    } else {
        // --- MODO CILINDRO: O TÉCNICO DE GRAVAÇÃO ---
        TECHNIQUE_PROMPT = `
        MODE: ROTARY SCREEN PRINTING (Cylinder/Separated Colors).
        STYLE: Pure Vector, Solid Shapes, Flat Color Blocking.
        RULES: No gradients, no shadows, no transparency. Sharp edges only. 
        LIMIT: Optimized for ${colorCount > 0 ? colorCount : '6-8'} flat screens.
        `;

        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT: Gradients, Shadows, Lighting effects, 3D depth, blurs, glow, textures, photo elements.
        `;
    }

    // 3. Estilo Artístico (Adaptado pelo Designer Sênior)
    let artStyleInstruction = "";
    if (artStyle === 'CUSTOM' && customStyle) {
        artStyleInstruction = `ART STYLE: ${customStyle.toUpperCase()}. Interpret this style with high-end gallery quality.`;
    } else {
        switch (artStyle) {
            case 'WATERCOLOR': 
                artStyleInstruction = technique === 'DIGITAL' 
                    ? "STYLE: Hyper-realistic Atelier Watercolor. Wet-on-wet bleeds, salt-texture effects, and layered translucent washes with fine hand-painted details."
                    : "STYLE: Stylized Flat Watercolor (Posterized for print separation).";
                break;
            case 'ACRILICA': 
                artStyleInstruction = technique === 'DIGITAL'
                    ? "STYLE: Heavy Impasto Oil/Acrylic. Visible thick paint texture, 3D palette knife strokes, and rich canvas-weave integration."
                    : "STYLE: Clean Graphic Painting shapes.";
                break;
            case 'BORDADO': 
                artStyleInstruction = technique === 'DIGITAL'
                    ? "STYLE: Luxury Haute Couture Embroidery. 3D thread sheen, metallic gold/silver accents, and visible stitch directionality that responds to lighting."
                    : "STYLE: Flat Vector Stitch simulation.";
                break;
            default: artStyleInstruction = "STYLE: Contemporary high-end textile design with luxury fashion finish."; break;
        }
    }

    // 4. Layout
    let layoutInstruction = "Seamless infinite repeat pattern.";
    if (layoutStyle === 'BARRADO') layoutInstruction = "LAYOUT: ENGINEERED BORDER (BARRADO). Masterful composition where detail density increases towards the selvedge with a dramatic artistic gradient towards the top.";
    if (layoutStyle === 'LENCO') layoutInstruction = "LAYOUT: SCARF PLACEMENT (SQUARE). Intricate frame-within-frame border design with a stunning central masterpiece motif.";

    // 5. Prompt Final
    const FULL_PROMPT = `
    MASTER DIRECTIVE: RE-IMAGINE THIS PRINT WITH SUPREME LUXURY QUALITY.
    
    TECHNICAL ANALYSIS TO FOLLOW: ${prompt}.
    
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

        if (!imageUrl) throw new Error("O motor criativo não conseguiu processar a imagem.");
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
    GENERATE A SEAMLESS HIGH-DEFINITION TEXTURE MAP.
    TYPE: ${textureType} (${prompt}).
    RULES: Grayscale heightmap style, top-down view, sharp micro-detail, perfect tiling.
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
