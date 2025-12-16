
// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo, technique = 'CYLINDER', colorCount = 0, layoutStyle = 'ORIGINAL') => {
    const ai = new GoogleGenAI({ apiKey });

    // 1. Contexto de Cor (Se disponível)
    const colorContext = (colors && colors.length > 0) 
        ? `STRICT PALETTE: ${colors.map(c => c.name).join(', ')}. Dominant tones: ${colors.slice(0,2).map(c => c.hex).join(', ')}.` 
        : "Use colors that match the requested theme.";

    // 2. Contexto de Layout (Substitui Ourela antiga se layoutStyle for definido)
    let layoutInstruction = "Seamless repeat pattern (All-over/Corrida).";
    
    // Mapeamento de Estilos de Layout
    if (layoutStyle && layoutStyle !== 'ORIGINAL') {
        switch (layoutStyle) {
            case 'BARRADO':
                layoutInstruction = "BORDER PRINT (Barrado). The design must have a heavy, decorative border along one edge (bottom/side) transitioning into a lighter filler.";
                break;
            case 'LENCO':
                layoutInstruction = "ENGINEERED SCARF PRINT (Lenço). Symmetrical or placed layout composed inside a square, with framing borders and a central medallion/motif.";
                break;
            case 'LOCALIZADA':
                layoutInstruction = "PLACED PRINT (Localizada/T-shirt). Single isolated artwork centered on white background. Not a repeating pattern.";
                break;
            case 'PAREO':
                layoutInstruction = "BEACH COVER-UP (Pareô/Canga). Large scale panel design, highly decorative, filling the entire rectangular space.";
                break;
            case 'CENTRALIZADA':
                layoutInstruction = "CENTRALIZED MOTIF. The main element is in the center, radiating outwards.";
                break;
        }
    } else if (selvedgeInfo && selvedgeInfo !== 'NENHUMA') {
        // Fallback para a lógica antiga de Ourela se layoutStyle não for usado
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
    - CLOSE-UP ARTWORK.
    - NO human models, NO mannequins, NO 3D garments.
    - NO realistic photos of people.
    - Image must be a flat rectangular swatch.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: FULL_PROMPT }] },
            config: {
                imageConfig: { aspectRatio: "1:1" }
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
