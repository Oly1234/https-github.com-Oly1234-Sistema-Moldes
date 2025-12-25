
// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
// BRAIN UPDATE: Enhanced Textile Studio Logic v2.1 (Creative & Robust)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo, technique = 'CYLINDER', colorCount = 0, layoutStyle = 'ORIGINAL', subLayoutStyle = '', artStyle = 'ORIGINAL', targetSize = 'PADRAO', customStyle = '') => {
    
    // SAFETY CHECK: Ensure API Key is present and valid string
    if (!apiKey || typeof apiKey !== 'string') {
        console.error("Generator: Missing API Key");
        throw new Error("Chave de API inválida ou ausente no Gerador.");
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });

    // 1. CEREBRO CROMÁTICO (Harmonia & Paleta)
    let colorInstruction = "";
    if (colors && colors.length > 0) {
        const colorList = colors.map(c => c.name + (c.hex ? ` (${c.hex})` : '')).join(', ');
        colorInstruction = `
        COLOR PALETTE (STRICT):
        Use mainly these colors: ${colorList}.
        Create a sophisticated harmony. Ensure high contrast and vibrant output if the palette allows.
        `;
    } else {
        colorInstruction = "COLOR DIRECTIVE: Use a trending, high-end fashion color palette (WGSN 2025). Vibrant and harmonious.";
    }

    // 2. TÉCNICA E ESTILO (O "Vibe" da Estampa)
    let visualStyle = "";
    
    if (technique === 'DIGITAL') {
        visualStyle = `
        TECHNIQUE: HIGH-END DIGITAL PRINT (4K).
        - Texture: Photorealistic fabric effect (Silk, Linen, or Viscose grain).
        - Detail: Intricate, painterly details. Watercolor bleeds, brush strokes, and soft gradients are welcome.
        - Finish: Look like a luxury scarf or premium dress fabric.
        `;
    } else {
        // CILINDRO / VETOR
        visualStyle = `
        TECHNIQUE: ROTARY SCREEN PRINT (Vetor/Flat).
        - Style: Clean, flat vector art. Pop Art or Poster style.
        - Colors: Solid blocks of color. No blurs, no gradients, no shading.
        - Definition: Sharp edges defined for screen separation.
        `;
    }

    // 3. ESTRUTURA (Layout)
    let layoutInstruction = "LAYOUT: SEAMLESS REPEAT PATTERN (All-over). The design must tile perfectly.";
    
    if (layoutStyle === 'LENCO') {
        layoutInstruction = `
        LAYOUT: ENGINEERED SILK SCARF (Carré).
        - Composition: Symmetrical or Centralized.
        - Borders: Distinct decorative borders framing the design.
        - Center: Focal medallion or main artwork.
        - Format: Square composition.
        `;
    } else if (layoutStyle === 'BARRADO') {
        layoutInstruction = `
        LAYOUT: BORDER PRINT (Barrado).
        - Composition: Heavy detail at the BOTTOM, fading/scattering upwards into negative space.
        - Orientation: Horizontal flow.
        `;
    } else if (layoutStyle === 'LOCALIZADA') {
        layoutInstruction = `
        LAYOUT: PLACEMENT PRINT (Localizada).
        - Composition: Centralized artwork for T-shirt chest or Dress center.
        - Background: Solid or subtle, emphasizing the central motif.
        `;
    }

    // 4. DIREÇÃO DE ARTE (Refinamento)
    let artisticDir = "";
    switch (artStyle) {
        case 'WATERCOLOR': artisticDir = "Style: Hand-painted Watercolor. Soft edges, translucent washes, wet-on-wet look."; break;
        case 'VETOR': artisticDir = "Style: Minimalist Vector. Bold shapes, clean lines, Bauhaus influence."; break;
        case 'BORDADO': artisticDir = "Style: Realistic Embroidery. Visible thread texture, satin stitch direction."; break;
        case 'TROPICAL': artisticDir = "Style: Brazilian Tropicalism. Farm Rio style. Lush leaves, vibrant fruits, exotic birds."; break;
        case 'CUSTOM': artisticDir = `Style: ${customStyle || "Creative High Fashion"}.`; break;
        default: artisticDir = "Style: Sophisticated Fashion Print. Balanced and commercial."; break;
    }

    // PROMPT FINAL "MIDJOURNEY STYLE"
    const FULL_PROMPT = `
    Design a textile pattern. ${prompt}
    
    ${layoutInstruction}
    ${visualStyle}
    ${artisticDir}
    ${colorInstruction}
    
    CRITICAL QUALITY GUIDELINES:
    - Masterpiece quality, highly detailed, sharp focus.
    - Professional textile design standard.
    - No text, no watermarks, no distorted objects.
    `;

    // Define Aspect Ratio based on Layout
    // Default is 1:1. 
    // Options: "1:1", "3:4", "4:3", "9:16", "16:9"
    let aspectRatio = "1:1";
    if (layoutStyle === 'PAREO') aspectRatio = "9:16"; 
    if (layoutStyle === 'BARRADO') aspectRatio = "16:9"; 
    if (layoutStyle === 'LOCALIZADA') aspectRatio = "3:4";

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Modelo Rápido e Eficiente para Estampas
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
        
        if (!imageUrl) throw new Error("A IA gerou uma resposta, mas sem imagem válida.");
        
        return imageUrl;

    } catch (e) { 
        console.error("Generator API Error:", e);
        // Better error message for the UI
        if (e.message.includes("default credentials")) {
            throw new Error("Erro de Configuração de API (Credenciais). Contate o suporte.");
        }
        throw new Error(`Falha na Geração: ${e.message}`);
    }
};

export const generateTextureLayer = async (apiKey, textureType, prompt) => {
    if (!apiKey) return null;
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: `Texture: ${textureType}, ${prompt}. Grayscale heightmap style. Seamless.` }] }
        });
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        return part ? `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` : null;
    } catch (e) { return null; }
};
