
// api/modules/generator.js
// DEPARTAMENTO: ATELIER DIGITAL (Geração de Estampas)

export const generatePattern = async (apiKey, prompt, colors) => {
    // 1. Definição do Modelo
    const MODEL_NAME = 'gemini-2.5-flash-image';
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    // 2. Construção do Prompt Visual
    const colorList = colors && colors.length > 0 ? colors.map(c => c.name).join(', ') : 'harmonious colors';
    
    // Prompt otimizado para texturas seamless
    const finalPrompt = `
    Create a high-quality seamless pattern texture.
    Subject: ${prompt}.
    Color Palette: ${colorList}.
    Style: Professional textile design, flat lay, straight view, detailed, vector-style.
    Requirements: Seamless tiling, no shadows, no watermarks.
    `;

    try {
        // PAYLOAD ESTRITO (Sem parâmetros de texto como response_mime_type)
        const payload = {
            contents: [{ 
                parts: [
                    { text: finalPrompt }
                ] 
            }],
            generationConfig: {
                imageConfig: {
                    aspectRatio: "1:1",
                    imageSize: "1K"
                },
                // Importante: Não enviar responseMimeType nem responseSchema para geração de imagem
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
            throw new Error(`Erro Atelier (${response.status}): A chave de API pode não ter acesso ao modelo de imagem ou o payload foi rejeitado.`);
        }

        const data = await response.json();
        
        // 3. Extração da Imagem
        // A API retorna a imagem em inline_data dentro de parts
        const parts = data.candidates?.[0]?.content?.parts;
        const imagePart = parts?.find(p => p.inline_data);
        
        if (imagePart) {
             return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        } 
        
        // Verifica recusa por segurança
        const finishReason = data.candidates?.[0]?.finish_reason;
        if (finishReason === 'SAFETY') {
            throw new Error("A IA recusou gerar a imagem por motivos de segurança (Safety Filter). Tente um prompt mais neutro.");
        }

        throw new Error("O servidor respondeu, mas não retornou dados de imagem válidos.");

    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
