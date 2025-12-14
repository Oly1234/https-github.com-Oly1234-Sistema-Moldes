
// api/modules/generator.js
// DEPARTAMENTO: ATELIER DIGITAL (Geração de Estampas)

export const generatePattern = async (apiKey, prompt, colors) => {
    // Instrução técnica para forçar o modelo a agir como uma impressora têxtil digital
    const colorList = colors && colors.length > 0 ? colors.map(c => c.name).join(', ') : 'harmonious colors';
    
    // PROMPT SIMPLIFICADO E DIRETO
    // O erro "AI gerou texto" ocorre quando damos instruções comportamentais ("Do not do this").
    // A solução é dar APENAS a descrição visual da imagem desejada.
    const finalPrompt = `
    A high-quality, professional seamless textile pattern design.
    Subject: ${prompt}.
    Colors: ${colorList}.
    Style: Digital vector art or watercolor illustration.
    View: Top-down flat lay texture file.
    No people, no models, no text, no realistic skin. Abstract or floral surface design only.
    `;

    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    try {
        const payload = {
            contents: [{ parts: [{ text: finalPrompt }] }],
            generation_config: { 
                candidate_count: 1,
                temperature: 0.7 
            }
        };

        const response = await fetch(endpointImg, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!response.ok) {
            throw new Error(`Erro na API (${response.status})`);
        }

        const data = await response.json();
        
        // Verifica imagem inline
        const parts = data.candidates?.[0]?.content?.parts;
        const imagePart = parts?.find(p => p.inline_data);
        
        if (imagePart) {
             return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        } 
        
        // Verifica recusa de segurança
        const finishReason = data.candidates?.[0]?.finish_reason;
        if (finishReason === 'SAFETY') {
            console.warn("Safety Block Triggered. Prompt was:", finalPrompt);
            throw new Error("Bloqueio de Segurança. Tente termos como 'abstrato', 'floral' ou 'geométrico'.");
        }

        // Se retornou texto, é uma falha de "Chat Mode". 
        // Lançamos erro para o frontend pedir simplificação.
        const textPart = parts?.[0]?.text;
        if (textPart) {
             console.warn("AI returned text instead of image:", textPart);
             throw new Error("A IA interpretou como conversa. Tente simplificar o prompt (ex: 'flores azuis').");
        }

        throw new Error("O servidor não retornou dados visuais.");

    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
