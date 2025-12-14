
// api/modules/generator.js
// DEPARTAMENTO: ATELIER DIGITAL (Geração de Estampas)

export const generatePattern = async (apiKey, prompt, colors) => {
    // 1. Configuração do Modelo de Imagem (Nano Banana / Gemini Flash Image)
    // Este modelo é específico para gerar pixels, diferente do Flash de texto.
    const MODEL_NAME = 'gemini-2.5-flash-image';
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    // 2. Construção do Prompt Visual
    const colorList = colors && colors.length > 0 ? colors.map(c => c.name).join(', ') : 'vibrant harmonious colors';
    
    // O prompt deve ser descritivo e direto para o modelo de imagem
    const finalPrompt = `
    Seamless textile pattern design, top-down flat view.
    Motif: ${prompt}.
    Palette: ${colorList}.
    Style: High-quality professional surface design, repeat pattern.
    Texture: Fabric texture visible.
    NO text, NO watermarks, NO realistic human faces.
    `;

    try {
        const payload = {
            contents: [{ 
                parts: [
                    { text: finalPrompt }
                ] 
            }],
            generation_config: { 
                response_mime_type: "image/jpeg", // Solicita explicitamente imagem
                aspect_ratio: "1:1"
            }
        };

        const response = await fetch(endpointImg, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!response.ok) {
            const errText = await response.text();
            console.error("Generator API Error:", errText);
            throw new Error(`Erro na API de Imagem (${response.status})`);
        }

        const data = await response.json();
        
        // 3. Extração da Imagem (Inline Data)
        // O modelo Nano Banana retorna a imagem dentro de inline_data
        const parts = data.candidates?.[0]?.content?.parts;
        const imagePart = parts?.find(p => p.inline_data);
        
        if (imagePart) {
             return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        } 
        
        // Verificação de Bloqueio de Segurança
        const finishReason = data.candidates?.[0]?.finish_reason;
        if (finishReason === 'SAFETY') {
            throw new Error("A IA bloqueou a imagem por segurança. Tente termos mais neutros (ex: 'floral', 'geométrico').");
        }

        // Fallback: Se o modelo responder com texto (às vezes acontece se ele não entender o pedido de imagem)
        const textPart = parts?.find(p => p.text)?.text;
        if (textPart) {
            console.warn("AI returned text:", textPart);
            throw new Error("A IA não gerou imagem. Tente simplificar o pedido.");
        }

        throw new Error("O servidor processou mas não retornou dados visuais.");

    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
