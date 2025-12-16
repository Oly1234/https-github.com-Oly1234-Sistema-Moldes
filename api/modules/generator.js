// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo) => {
    const ai = new GoogleGenAI({ apiKey });

    // 1. Contexto de Cor (Se disponível)
    const colorContext = (colors && colors.length > 0) 
        ? `STRICT PALETTE: ${colors.map(c => c.name).join(', ')}. Dominant tones: ${colors.slice(0,2).map(c => c.hex).join(', ')}.` 
        : "Use current fashion trend colors.";

    // 2. Contexto de Layout (Ourela/Barrado)
    let layoutInstruction = "Seamless repeat pattern (All-over).";
    if (selvedgeInfo && selvedgeInfo !== 'NENHUMA') {
        layoutInstruction = `BORDER PRINT (Barrado). The design must have a decorative border aligned to the ${selvedgeInfo === 'Inferior' ? 'BOTTOM' : selvedgeInfo === 'Superior' ? 'TOP' : 'SIDE'} edge. The rest is a filler pattern.`;
    }

    // 3. Prompt Blindado com Contexto Técnico
    const FULL_PROMPT = `Generate a professional high-definition textile pattern file.
    
    THEME/SUBJECT: ${prompt}.
    STYLE: Flat 2D Vector Art, Clean Lines, Wallpaper style.
    LAYOUT: ${layoutInstruction}
    ${colorContext}
    
    VISUAL RULES:
    - CLOSE-UP TEXTURE ONLY.
    - NO human models, NO mannequins, NO 3D garments.
    - NO realistic photos of people.
    - High contrast, ready for digital printing.
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
