
// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo, technique = 'CYLINDER', colorCount = 0, layoutStyle = 'ORIGINAL', subLayoutStyle = '', artStyle = 'ORIGINAL', targetSize = 'PADRAO', customStyle = '') => {
    const ai = new GoogleGenAI({ apiKey });

    // 1. Colorista Sênior: Acordes e Acentos
    const colorContext = (colors && colors.length > 0) 
        ? `MASTER COLORIST DIRECTIVE: Take this base palette [${colors.map(c => c.name).join(', ')}]. 
           ELEVATION: Create sophisticated tone-on-tone transitions. 
           CRITICAL: Inlay "Vibrant Accent Sparks" in 5% of the motifs (jewel tones, iridescent highlights) to give that "designer pop" while maintaining absolute harmony.` 
        : "MASTER COLORIST DIRECTIVE: Generate a high-fashion harmonious palette with deep saturations, elegant mid-tones, and luminous highlights.";

    // 2. Lógica de Execução: Digital (Elite Duo) vs Cilindro (Técnico)
    let TECHNIQUE_PROMPT = "";
    let NEGATIVE_PROMPT = "";

    if (technique === 'DIGITAL') {
        TECHNIQUE_PROMPT = `
        MODE: MASTERPIECE DIGITAL ELEVATION (4K LUXURY FINISH).
        
        GOAL: "Make it significantly more beautiful than the reference, but recognizable as the same style."
        
        DESIGNER SENIOR (Structure & Depth):
        - FOLLOW THE STYLE BLUEPRINT: ${prompt}.
        - VOLUMETRIC RENDERING: Motifs must not be flat. Use professional chiaroscuro for 3D presence.
        - LAYERED PERSPECTIVE: Create a sophisticated "Atmospheric Depth". Foreground elements should be crisp, midground detailed, and background subtly diffused with translucency.
        - HIGH-DEFINITION FINISH: Every stroke must be intentional, clean, and represent premium textile quality.
        
        COLORISTA SENIOR (Light & Emotion):
        - Apply the Master Colorist Directive with emphasis on "Accent Details".
        - Use light reflections and soft shadows to create a "Glow from Within" effect on important motifs.
        `;
        
        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT: Poorly drawn, low resolution, muddy colors, flat 2D vector look, amateur illustration, basic clipart style, jagged edges, boring repetition, lack of depth.
        `;

    } else {
        TECHNIQUE_PROMPT = `
        MODE: TECHNICAL ROTARY SCREEN PRINTING.
        STYLE: Solid Vector, Flat Colors, Hard Separation.
        RULES: No gradients, no shadows, no transparency. Sharp edges only. 
        LIMIT: Optimized for ${colorCount > 0 ? colorCount : '8'} technical screens.
        `;

        NEGATIVE_PROMPT = `
        NEGATIVE PROMPT: Gradients, Shadows, Light effects, 3D volume, textures, blur, transparency.
        `;
    }

    // 3. Estilo Artístico (Aplicação Sênior)
    let artStyleInstruction = "";
    if (artStyle === 'CUSTOM' && customStyle) {
        artStyleInstruction = `ART STYLE OVERRIDE: ${customStyle.toUpperCase()}. Execute with museum-quality rigor.`;
    } else {
        switch (artStyle) {
            case 'WATERCOLOR': 
                artStyleInstruction = technique === 'DIGITAL' 
                    ? "STYLE: Hyper-Realistic Fine Art Watercolor. Visible hand-painted bleeds, paper texture integration, and crystalline translucent layers."
                    : "STYLE: Clean Vector Watercolor simulation.";
                break;
            case 'BORDADO': 
                artStyleInstruction = technique === 'DIGITAL'
                    ? "STYLE: Haute Couture Embroidery. Photorealistic thread texture, silk thread sheen, and visible 3D relief shadows."
                    : "STYLE: Flat Vector Stitch Pattern.";
                break;
            default: artStyleInstruction = "STYLE: Contemporary Luxury Textile Design."; break;
        }
    }

    // 4. Layout
    let layoutInstruction = "Seamless infinite repeat pattern.";
    if (layoutStyle === 'BARRADO') layoutInstruction = "LAYOUT: LUXURY ENGINEERED BORDER. Motifs must transition from high-density complexity at the border to an elegant artistic diffusion towards the top.";

    // 5. Prompt Final
    const FULL_PROMPT = `
    PRODUCTION DIRECTIVE: CREATE A LUXURY EVOLUTION OF THIS PRINT.
    
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

        if (!imageUrl) throw new Error("O motor de luxo não conseguiu processar a imagem.");
        return imageUrl;

    } catch (e) {
        console.error("Generator Elevation Error:", e);
        throw e;
    }
};

export const generateTextureLayer = async (apiKey, textureType, prompt) => {
    const ai = new GoogleGenAI({ apiKey });
    const TEXTURE_PROMPT = `GENERATE A SEAMLESS HD TEXTURE. TYPE: ${textureType} (${prompt}). Grayscale heightmap, 4K detail.`;
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
