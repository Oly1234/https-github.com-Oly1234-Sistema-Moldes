
// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
// BRAIN UPDATE: Enhanced Textile Studio Logic v2.0
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo, technique = 'CYLINDER', colorCount = 0, layoutStyle = 'ORIGINAL', subLayoutStyle = '', artStyle = 'ORIGINAL', targetSize = 'PADRAO', customStyle = '') => {
    // FIX: Usa a apiKey passada pelo argumento para evitar erro de credenciais
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // 1. ANÁLISE CROMÁTICA & FIDELIDADE (The Colorist Brain)
    const colorContext = (colors && colors.length > 0) 
        ? `STRICT PALETTE ENFORCEMENT: You must use ONLY these specific colors: [${colors.map(c => c.name + ' (' + c.hex + ')').join(', ')}]. 
           - Background Color: Determine the best background from the palette to make the motif pop.
           - Color Harmony: Maintain professional textile contrast. 
           - If technique is CYLINDER, use solid blocks of these exact colors.
           - If technique is DIGITAL, you may use gradients of these colors.` 
        : "COLOR MASTER DIRECTIVE: Create a sophisticated, trending high-fashion palette (WGSN Style).";

    // 2. TÉCNICA DE ESTAMPARIA (The Engineer Brain)
    let TECHNIQUE_PROMPT = "";
    let NEGATIVE_PROMPT = "";

    if (technique === 'DIGITAL') {
        // --- MODO DIGITAL (Estilo Farm / Liberty / Digital Art) ---
        TECHNIQUE_PROMPT = `
        MODE: HIGH-END DIGITAL TEXTILE PRINT.
        
        VISUAL QUALITY:
        - Texture: Rich, organic, photorealistic fabric simulation (Silk/Viscose).
        - Detail: Extremely high definition (4K style). Visible brush strokes if painting style.
        - Depth: Use layered transparencies, multiply effects, and subtle drop shadows common in Photoshop textile design.
        - Finish: "Imperfect" organic look preferred over cold computer vectors.
        `;
        
        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT: low resolution, jpeg artifacts, blurry, distorted, plastic look, 3d render style, neon glow, amateur digital art, watermark, text, signature, bad composition, cut off objects.
        `;
    } else {
        // --- MODO CILINDRO (Rotativa / Vetor Chapado) ---
        TECHNIQUE_PROMPT = `
        MODE: ROTARY SCREEN PRINTING (Technical Vector).
        
        VISUAL QUALITY:
        - Style: FLAT VECTOR ART. Solid colors only. No gradients. No transparency.
        - Separation: Distinct color blocks ready for screen separation.
        - Lines: Clean, sharp edges. Perfect for Cylinder engraving.
        - Limit: Visual look of ${colorCount > 0 ? colorCount : '8-10'} distinct screens.
        `;

        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT: gradients, shadows, 3d, photorealism, blur, noise, texture overlay, watercolor bleeding, complex shading, photograph.
        `;
    }

    // 3. ESTILO ARTÍSTICO (The Art Director Brain)
    let artStyleInstruction = "";
    
    if (artStyle === 'CUSTOM' && customStyle) {
        artStyleInstruction = `ART STYLE: ${customStyle.toUpperCase()}. Interpret with manual designer precision.`;
    } else {
        switch (artStyle) {
            case 'WATERCOLOR': 
                artStyleInstruction = "ART STYLE: Botanical Watercolor. Wet-on-wet technique, pigment pooling, translucent petals, organic edges. Hand-painted atelier look."; break;
            case 'GIZ': 
                artStyleInstruction = "ART STYLE: Pastel Chalk / Crayon. Dry texture, rough grain, soft blended edges, sketching feel."; break;
            case 'ACRILICA': 
                artStyleInstruction = "ART STYLE: Heavy Body Acrylic. Visible brush strokes, impasto texture, vibrant opaque colors, painterly freedom."; break;
            case 'VETOR': 
                artStyleInstruction = "ART STYLE: Modern Vector Flat. Minimalist, geometric simplification, bauhaus influence, clean lines."; break;
            case 'BORDADO':
                artStyleInstruction = "ART STYLE: Embroidery Simulation. Stitch texture, thread volume, satin stitch direction."; break;
            case 'LINHA':
                artStyleInstruction = "ART STYLE: Fine Line Art / Toile de Jouy. Monochromatic or duotone, engraving style, detailed hatching."; break;
            case 'ORNAMENTAL':
                artStyleInstruction = "ART STYLE: Baroque / Paisley / Ornamental. Complex symmetrical details, filigree, luxury scarf style."; break;
            default: 
                artStyleInstruction = "ART STYLE: High-end commercial fashion print (Zara/Farm aesthetic). Balanced and sellable."; break;
        }
    }

    // 4. ESTRUTURA DE LAYOUT (The Composer Brain)
    let layoutInstruction = "LAYOUT: SEAMLESS REPEAT PATTERN (Standard Rapport). Ensure invisible tiling.";
    
    if (layoutStyle === 'LENCO') {
        const subParams = subLayoutStyle ? `Sub-style: ${subLayoutStyle}.` : "";
        layoutInstruction = `LAYOUT: SILK SCARF (Carré) COMPOSITION.
        - Structure: Engineered placement print.
        - Borders: Distinct decorative frame/border.
        - Center: Centralized medallion or focal artwork.
        - Symmetry: Rotational symmetry (Hermès Style).
        ${subParams}`;
    } else if (layoutStyle === 'BARRADO') {
        layoutInstruction = `LAYOUT: BORDER PRINT (Barrado).
        - Structure: Heaviest elements at the BOTTOM edge, fading or scattering upwards into negative space/background.
        - Horizontal: Seamless repeat horizontally.
        - Vertical: Non-repeating (Placement).`;
    } else if (layoutStyle === 'PAREO') {
        layoutInstruction = `LAYOUT: PAREO / BEACH PANEL.
        - Structure: Large scale rectangular composition.
        - Style: Tropical/Resort wear placement print.`;
    } else if (layoutStyle === 'LOCALIZADA') {
        layoutInstruction = `LAYOUT: PLACEMENT PRINT (T-Shirt/Chest).
        - Structure: Centralized isolated artwork on solid background.
        - Usage: Chest print or back print. Not a pattern.`;
    }

    // PROMPT FINAL OTIMIZADO
    const FULL_PROMPT = `
    ROLE: You are the Head Textile Designer of a luxury fashion house.
    TASK: Create a production-ready textile design based on the following DNA.
    
    INPUT DNA: "${prompt}"
    
    TECHNICAL DIRECTIVES:
    1. ${layoutInstruction}
    2. ${TECHNIQUE_PROMPT}
    3. ${artStyleInstruction}
    4. ${colorContext}
    
    QUALITY CONTROL:
    - Eliminate hallucinations (extra limbs, weird text).
    - Ensure colors are distinct and muddy tones are removed.
    - If "Seamless", edges must match perfectly.
    
    ${NEGATIVE_PROMPT}
    `;

    // Define Aspect Ratio based on Layout
    let aspectRatio = "1:1";
    if (layoutStyle === 'PAREO') aspectRatio = "9:16";
    if (layoutStyle === 'BARRADO') aspectRatio = "16:9";
    if (layoutStyle === 'LOCALIZADA') aspectRatio = "3:4";

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: FULL_PROMPT }] },
            config: {
                imageConfig: { aspectRatio: aspectRatio }
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
    } catch (e) { 
        console.error("Generator Error:", e);
        throw e; 
    }
};

export const generateTextureLayer = async (apiKey, textureType, prompt) => {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const TEXTURE_PROMPT = `GENERATE A SEAMLESS TEXTURE MASK: ${textureType} (${prompt}). Grayscale heightmap, high fidelity, flat lighting.`;
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
