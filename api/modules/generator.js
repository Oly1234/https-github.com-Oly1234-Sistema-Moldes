
// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo, technique = 'CYLINDER', colorCount = 0, layoutStyle = 'ORIGINAL', subLayoutStyle = '') => {
    const ai = new GoogleGenAI({ apiKey });

    // 1. Contexto de Cor (Se disponível)
    const colorContext = (colors && colors.length > 0) 
        ? `STRICT PALETTE: ${colors.map(c => c.name).join(', ')}. Dominant tones: ${colors.slice(0,2).map(c => c.hex).join(', ')}.` 
        : "Use colors that match the requested theme.";

    // 2. Contexto de Layout (Aprimorado para Nível Profissional com Sub-Layouts)
    let layoutInstruction = "Seamless repeat pattern (All-over/Corrida).";
    
    // Mapeamento de Estilos de Layout com Estrutura Rígida
    if (layoutStyle && layoutStyle !== 'ORIGINAL') {
        switch (layoutStyle) {
            case 'BARRADO':
                layoutInstruction = `
                LAYOUT: HORIZONTAL BORDER PRINT (Barrado). 
                STRUCTURE:
                - BOTTOM 35%: Heavy, intricate, highly detailed border artwork.
                - TOP 65%: Lighter field, sparse motifs, or fading gradient.
                - VISUAL GRAVITY: The visual weight must be at the bottom edge.
                ${subLayoutStyle ? `SUB-STYLE: ${subLayoutStyle}.` : ''}
                ${subLayoutStyle === 'DUPLO' ? 'MIRRORED BORDER: Identical heavy borders on BOTH Top and Bottom edges.' : ''}
                ${subLayoutStyle === 'DEGRADE' ? 'GRADIENT FLOW: Motifs must visually dissolve/fade from heavy bottom to empty top.' : ''}
                `;
                break;
            case 'LENCO':
                layoutInstruction = `
                LAYOUT: LUXURY SILK SCARF (Foulard/Carré Style).
                GEOMETRY: Perfectly SYMMETRICAL Square Composition.
                STRUCTURE:
                1. FRAME: A distinct, ornate outer border (frame) running equally along ALL 4 EDGES.
                2. CORNERS: Elaborate decorative motifs mirrored in all 4 corners.
                3. CENTER: A strong central medallion or focal illustration.
                4. FILLER: Connecting motifs between the center and the border.
                VIBE: High-end fashion (Hermès/Versace style).
                ${subLayoutStyle ? `SUB-STYLE: ${subLayoutStyle}.` : ''}
                ${subLayoutStyle === 'MEDALHAO' ? 'FOCUS: Massive, intricate central medallion. Symmetrical radiation.' : ''}
                ${subLayoutStyle === 'BANDANA' ? 'FOCUS: Paisley/Ornamental concentric frames. Classic Bandana layout.' : ''}
                ${subLayoutStyle === 'GEOMETRICO' ? 'FOCUS: Art Deco/Bauhaus rigid symmetry. No organic flow.' : ''}
                `;
                break;
            case 'LOCALIZADA':
                layoutInstruction = `
                LAYOUT: PLACED PRINT (Localizada/T-shirt Graphic).
                STRUCTURE: Single isolated artwork centered on a solid background. 
                - NOT a repeating pattern.
                - NOT a full coverage print.
                - Clear negative space around the central subject.
                `;
                break;
            case 'PAREO':
                layoutInstruction = `
                LAYOUT: BEACH PAREO/SARONG PANEL.
                STRUCTURE: Large scale rectangular panel design.
                - Highly decorative borders.
                - Tropical/Summer flow.
                - Designed to be worn wrapped around the body.
                `;
                break;
            case 'CORRIDA':
                layoutInstruction = `
                LAYOUT: ALL-OVER SEAMLESS REPEAT.
                ${subLayoutStyle === 'TOSS' ? 'STYLE: Tossed layout. Motifs scattered randomly with varying rotations. No obvious grid.' : ''}
                ${subLayoutStyle === 'GRID' ? 'STYLE: Grid/Geometric alignment. Motifs aligned in rows/columns.' : ''}
                ${subLayoutStyle === 'ORGANIC' ? 'STYLE: Organic Flow. Vines/Waves connecting motifs continuously.' : ''}
                `;
                break;
        }
    } else if (selvedgeInfo && selvedgeInfo !== 'NENHUMA') {
        // Fallback para a lógica antiga de Ourela
        layoutInstruction = `BORDER PRINT (Barrado). The design must have a decorative border aligned to the ${selvedgeInfo === 'Inferior' ? 'BOTTOM' : selvedgeInfo === 'Superior' ? 'TOP' : 'SIDE'} edge.`;
    }

    // 3. SELEÇÃO DE TÉCNICA (CILINDRO VS DIGITAL)
    let TECHNIQUE_RULES = "";
    
    if (technique === 'DIGITAL') {
        // MODO DIGITAL: Profundidade, Detalhe, Sem Trama
        TECHNIQUE_RULES = `
        STYLE: High-Fidelity Digital Print.
        FEATURES: Rich details, depth of field, volumetric lighting, gradients, soft shadows, tone-on-tone overlay, 3D relief effects.
        CRITICAL FORBIDDEN: DO NOT RENDER FABRIC TEXTURE. DO NOT RENDER WEAVE. DO NOT RENDER CANVAS GRAIN. The artwork must be pure graphics on a smooth background.
        VIBE: Luxurious, complex, cinematic lighting, sophisticated shading.
        `;
    } else {
        // MODO CILINDRO (Padrão): Chapado, Vetorial
        // Lógica de Cores Indexadas
        const colorLimitInstruction = (colorCount > 0 && colorCount <= 12) 
            ? `RESTRICTION: Reduce entire artwork to EXACTLY ${colorCount} DISTINCT SPOT COLORS (plus background). No gradients, no blending.` 
            : "Use a limited spot color palette suitable for screen printing.";

        TECHNIQUE_RULES = `
        STYLE: Flat 2D Vector Art, Screen Printing (Rotary Screen) Style.
        FEATURES: Clean lines, solid colors, high contrast, hard edges.
        ${colorLimitInstruction}
        CRITICAL FORBIDDEN: NO Gradients, NO Shadows, NO Blur, NO 3D effects, NO Texture.
        VIBE: Industrial, clean, ready for color separation/engraving.
        `;
    }

    // 4. Prompt Final
    const FULL_PROMPT = `Generate a professional textile pattern design.
    
    THEME/SUBJECT: ${prompt}.
    REQUIRED LAYOUT: ${layoutInstruction}
    ${colorContext}
    
    TECHNICAL SPECIFICATIONS (${technique} MODE):
    ${TECHNIQUE_RULES}
    
    VISUAL RULES:
    - CLOSE-UP ARTWORK (Top-down view).
    - NO human models, NO mannequins, NO 3D garments.
    - NO realistic photos of people.
    - Image must be a flat rectangular/square swatch ready for printing.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: FULL_PROMPT }] },
            config: {
                imageConfig: { aspectRatio: layoutStyle === 'PAREO' ? "9:16" : "1:1" } // Pareô vertical, resto quadrado
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

        if (!imageUrl) {
            const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
            if (textPart) console.warn("Recusa da IA:", textPart.text);
            throw new Error("A IA não gerou a imagem. Tente simplificar o termo (Ex: 'Floral' em vez de 'Vestido Floral').");
        }

        return imageUrl;

    } catch (e) {
        console.error("Erro no Gerador SDK:", e);
        throw e;
    }
};
