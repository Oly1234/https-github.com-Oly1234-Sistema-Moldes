
// api/modules/generator.js
// DEPARTAMENTO: ATELIER DIGITAL (Geração de Estampas)

export const generatePattern = async (apiKey, prompt, colors) => {
    // 1. Modelo Nano Banana (Imagem)
    const MODEL_NAME = 'gemini-2.5-flash-image';
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    // 2. Construção do Prompt Visual (Simplificado e Direto)
    const colorList = colors && colors.length > 0 ? colors.map(c => c.name).join(', ') : 'harmonious colors';
    
    // Prompt focado puramente na textura visual
    const finalPrompt = `
    Create a seamless texture pattern.
    Subject: ${prompt}.
    Colors: ${colorList}.
    Style: Professional textile design swatch.
    View: Top-down, flat, crop.
    `;

    try {
        // CORREÇÃO ERRO 400:
        // 1. Removemos response_mime_type (não suportado para este modelo)
        // 2. Usamos a estrutura correta de generationConfig para imagem
        const payload = {
            contents: [{ 
                parts: [
                    { text: finalPrompt }
                ] 
            }],
            generationConfig: {
                // Configuração específica para modelos de imagem do Gemini
                imageConfig: {
                    aspectRatio: "1:1",
                    imageSize: "1K" // Opcional, mas garante qualidade
                }
            }
        };

        const response = await fetch(endpointImg, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!response.ok) {
            const errText = await response.text();
            console.error("Generator API Error Details:", errText);
            throw new Error(`Erro na API (${response.status}): Verifique se sua chave suporta o modelo Nano Banana.`);
        }

        const data = await response.json();
        
        // 3. Extração da Imagem
        const parts = data.candidates?.[0]?.content?.parts;
        
        // Procura por inline_data (Imagem)
        const imagePart = parts?.find(p => p.inline_data);
        if (imagePart) {
             return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        } 
        
        // Verifica recusa
        const finishReason = data.candidates?.[0]?.finish_reason;
        if (finishReason === 'SAFETY') {
            throw new Error("Bloqueio de Segurança. Tente um prompt mais simples (ex: 'floral abstrato').");
        }

        // Se retornou texto, é erro de interpretação
        const textPart = parts?.find(p => p.text)?.text;
        if (textPart) {
            throw new Error("A IA gerou texto. Tente novamente.");
        }

        throw new Error("O servidor não retornou imagem.");

    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
