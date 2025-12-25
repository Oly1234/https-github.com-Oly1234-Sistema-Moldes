
// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
// BRAIN UPDATE: Enhanced Textile Studio Logic v2.0 (Restored & Polished)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo, technique = 'CYLINDER', colorCount = 0, layoutStyle = 'ORIGINAL', subLayoutStyle = '', artStyle = 'ORIGINAL', targetSize = 'PADRAO', customStyle = '') => {
    // FIX CRÍTICO: Injeção explícita da chave para evitar erro de "Default Credentials"
    if (!apiKey) throw new Error("API Key is missing in Generator Module.");
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // 1. CEREBRO CROMÁTICO (The Colorist Brain)
    // Se houver cores definidas, forçamos a IA a usá-las.
    let colorContext = "";
    if (colors && colors.length > 0) {
        const colorList = colors.map(c => `${c.name} (${c.hex})`).join(', ');
        colorContext = `
        STRICT COLOR PALETTE DIRECTIVE:
        You represent a Dyeing House. You must stick to this exact palette as closely as possible: [${colorList}].
        - Use these colors for the main motifs and background.
        - Create harmony and contrast using ONLY these tones if possible.
        `;
    } else {
        colorContext = "COLOR DIRECTIVE: Create a harmonious, trending fashion palette (WGSN 2025 style). High sophistication.";
    }

    // 2. CEREBRO TÉCNICO (The Engineer Brain)
    let TECHNIQUE_PROMPT = "";
    let NEGATIVE_PROMPT = "";

    if (technique === 'DIGITAL') {
        // --- MODO DIGITAL (Estilo Farm / Liberty / Digital Art) ---
        TECHNIQUE_PROMPT = `
        MODE: HIGH-END DIGITAL TEXTILE PRINT.
        
        VISUAL QUALITY:
        - Texture: Rich, organic, photorealistic fabric simulation (Silk/Viscose/Linen).
        - Detail: Extremely high definition (4K style). Visible brush strokes if painting style.
        - Depth: Use layered transparencies, watercolor bleeding, and subtle drop shadows.
        - Finish: "Imperfect" organic look preferred over cold computer vectors.
        `;
        
        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT: low resolution, jpeg artifacts, blurry, distorted, plastic look, 3d render style, neon glow, amateur digital art, watermark, text, signature, bad composition, cut off objects, ugly.
        `;
    } else {
        // --- MODO CILINDRO (Rotativa / Vetor Chapado) ---
        TECHNIQUE_PROMPT = `
        MODE: ROTARY SCREEN PRINTING (Technical Vector / Cylinder).
        
        VISUAL QUALITY:
        - Style: FLAT VECTOR ART / POSTER STYLE. Solid colors only. 
        - Separation: Distinct color blocks ready for screen separation. No gradients. No blur.
        - Lines: Clean, sharp edges. Perfect for Cylinder engraving.
        - Complexity: Create a design feasible for ${colorCount > 0 ? colorCount : '8-12'} screens/colors.
        `;

        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT: gradients, shadows, 3d, photorealism, blur, noise, texture overlay, watercolor bleeding, complex shading, photograph, realistic photo.
        `;
    }

    // 3. ESTILO ARTÍSTICO (The Art Director Brain)
    let artStyleInstruction = "";
    
    if (artStyle === 'CUSTOM' && customStyle) {
        artStyleInstruction = `ART STYLE: ${customStyle.toUpperCase()}. Interpret with professional designer precision.`;
    } else {
        switch (artStyle) {
            case 'WATERCOLOR': 
                artStyleInstruction = "ART STYLE: Botanical Watercolor. Wet-on-wet technique, pigment pooling, translucent petals, organic edges. Hand-painted atelier look."; break;
            case 'GIZ': 
                artStyleInstruction = "ART STYLE: Pastel Chalk / Crayon. Dry texture, rough grain, soft blended edges, sketching feel."; break;
            case 'ACRILICA': 
                artStyleInstruction = "ART STYLE: Heavy Body Acrylic / Gouache. Visible brush strokes, impasto texture, vibrant opaque colors, painterly freedom."; break;
            case 'VETOR': 
                artStyleInstruction = "ART STYLE: Modern Vector Flat. Minimalist, geometric simplification, bauhaus influence, clean lines, solid fills."; break;
            case 'BORDADO':
                artStyleInstruction = "ART STYLE: Embroidery Simulation. Stitch texture, thread volume, satin stitch direction, raised effect."; break;
            case 'LINHA':
                artStyleInstruction = "ART STYLE: Fine Line Art / Toile de Jouy. Monochromatic or duotone, engraving style, detailed hatching, ink pen."; break;
            case 'ORNAMENTAL':
                artStyleInstruction = "ART STYLE: Baroque / Paisley / Ornamental. Complex symmetrical details, filigree, luxury scarf style, golden elements."; break;
            default: 
                artStyleInstruction = "ART STYLE: High-end commercial fashion print. Balanced, sellable, sophisticated."; break;
        }
    }

    // 4. ESTRUTURA DE LAYOUT (The Composer Brain)
    let layoutInstruction = "LAYOUT: SEAMLESS REPEAT PATTERN (All-over). Ensure edges match perfectly for continuous printing.";
    
    if (layoutStyle === 'LENCO') {
        const subParams = subLayoutStyle ? `Sub-style: ${subLayoutStyle}.` : "";
        layoutInstruction = `LAYOUT: SILK SCARF (Carré) COMPOSITION.
        - Structure: Engineered placement print within a square.
        - Borders: Distinct decorative frame/border (Baroque or Geometric).
        - Center: Centralized medallion or focal artwork.
        - Symmetry: Rotational or Mirror symmetry (Hermès Style).
        ${subParams}`;
    } else if (layoutStyle === 'BARRADO') {
        layoutInstruction = `LAYOUT: BORDER PRINT (Barrado).
        - Structure: Heaviest, most complex elements at the BOTTOM edge.
        - Transition: Fading or scattering upwards into negative space/background color.
        - Horizontal: Seamless repeat horizontally (along the width).`;
    } else if (layoutStyle === 'PAREO') {
        layoutInstruction = `LAYOUT: PAREO / BEACH PANEL.
        - Structure: Large scale rectangular composition (Portrait).
        - Style: Tropical/Resort wear placement print. Big bold elements.`;
    } else if (layoutStyle === 'LOCALIZADA') {
        layoutInstruction = `LAYOUT: PLACEMENT PRINT (T-Shirt/Chest).
        - Structure: Centralized isolated artwork on solid background.
        - Usage: Chest print or back print. Not a repeating pattern.`;
    }

    // PROMPT FINAL OTIMIZADO
    const FULL_PROMPT = `
    ROLE: You are the Head Textile Designer of a luxury fashion house (e.g., Gucci, Farm Rio, Zimmerman).
    TASK: Create a production-ready textile design based on the following DNA.
    
    INPUT DNA / THEME: "${prompt}"
    
    TECHNICAL DIRECTIVES:
    1. ${layoutInstruction}
    2. ${TECHNIQUE_PROMPT}
    3. ${artStyleInstruction}
    4. ${colorContext}
    
    QUALITY CONTROL:
    - Eliminate hallucinations (extra limbs, weird text).
    - Ensure colors are distinct.
    - Make it look like a finished fabric swatch.
    
    ${NEGATIVE_PROMPT}
    `;

    // Define Aspect Ratio based on Layout
    // gemini-2.5-flash-image supports: "1:1", "3:4", "4:3", "9:16", "16:9"
    let aspectRatio = "1:1";
    if (layoutStyle === 'PAREO') aspectRatio = "9:16"; // Vertical Canga
    if (layoutStyle === 'BARRADO') aspectRatio = "16:9"; // Horizontal Border
    if (layoutStyle === 'LOCALIZADA') aspectRatio = "3:4"; // Portrait T-shirt

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
        
        if (!imageUrl) throw new Error("A IA falhou na renderização têxtil. Tente simplificar o prompt.");
        
        return imageUrl;
    } catch (e) { 
        console.error("Generator Error:", e);
        throw e; 
    }
};

export const generateTextureLayer = async (apiKey, textureType, prompt) => {
    if (!apiKey) return null;
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    const TEXTURE_PROMPT = `
    Generate a SEAMLESS TEXTURE MASK: ${textureType} (${prompt}). 
    Style: Grayscale heightmap / bump map.
    Lighting: Flat, even lighting. 
    Detail: High fidelity fabric grain.
    No colors, only grey tones for overlay blending.
    `;
    
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
