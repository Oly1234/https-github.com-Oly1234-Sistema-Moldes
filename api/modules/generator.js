// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors) => {
    const ai = new GoogleGenAI({ apiKey });

    // 1. Contexto de Cor
    const colorContext = (colors && colors.length > 0) 
        ? `Paleta de cores: ${colors.map(c => c.hex).join(', ')}.` 
        : "Use cores de tendência atuais.";

    // 2. Prompt "Blindado" para Textura
    // Força o modelo a focar em textura 2D e não em 'criar um design de roupa' (que gera alucinações de pessoas)
    // O comando "Texture Swatch" é mais seguro que "Fashion Print".
    const FULL_PROMPT = `Generate a seamless professional textile pattern (texture swatch).
    THEME: ${prompt}.
    STYLE: Flat 2D Vector Art, High Definition, Wallpaper style.
    ${colorContext}
    
    VISUAL RULES:
    - CLOSE-UP TEXTURE ONLY.
    - NO human models, NO mannequins, NO 3D garments.
    - NO realistic photos of people.
    - Seamless repeat.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: FULL_PROMPT }]
            },
            config: {
                // Configuração CRÍTICA para garantir que a IA gere imagem e não texto.
                imageConfig: {
                    aspectRatio: "1:1"
                }
            }
        });

        // Extração de Imagem (Compatível com SDK)
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
            // Se falhar, tenta capturar o texto de recusa para logar (mas lança erro amigável)
            const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
            if (textPart) console.warn("Recusa da IA:", textPart.text);
            throw new Error("A IA não conseguiu gerar esta imagem. Tente termos mais simples como 'Floral' ou 'Listras'.");
        }

        return imageUrl;

    } catch (e) {
        console.error("Erro no Gerador SDK:", e);
        throw e;
    }
};