
// api/modules/generator.js
// ESPECIALIDADE: Geração de Imagens (Text-to-Image)

export const generatePattern = async (apiKey, prompt, colors) => {
    // Instrução técnica para forçar o modelo a agir como uma impressora têxtil digital
    const colorInstruction = colors && colors.length > 0 ? `COLOR PALETTE: ${colors.map(c => c.name).join(', ')}.` : '';
    
    // Prompt altamente técnico para garantir textura seamless
    const finalPrompt = `
    Generate a SEAMLESS TEXTILE PATTERN.
    SUBJECT: ${prompt}.
    ${colorInstruction}
    
    STRICT VISUAL RULES:
    1. VIEW: Top-down, flat lay, 2D texture swatch.
    2. COMPOSITION: Edge-to-edge repeating pattern. No borders, no frames.
    3. STYLE: Professional fabric print design (vector or watercolor style).
    4. NO: No perspective, no furniture, no models, no mockups. Just the raw pattern file.
    `;

    // Usando endpoint padrão para imagens via Gemini
    // Nota: O endpoint gemini-2.5-flash-image requer payload específico ou uso via SDK
    // Aqui usamos uma abordagem segura de text-to-image
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    try {
        // Tentativa 1: Configuração Padrão
        // Se a chave não tiver acesso ao modelo de imagem, isso pode falhar.
        // O ideal é que o usuário tenha uma chave com acesso ao Imagen 3 ou Gemini Vision Generation
        
        // Payload simplificado para evitar erro 400
        const payload = {
            contents: [{ parts: [{ text: finalPrompt }] }],
            // generation_config NÃO deve ter response_mime_type para imagens
            generation_config: { 
                candidate_count: 1
            }
        };

        const response = await fetch(endpointImg, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!response.ok) {
            const errText = await response.text();
            console.error("Generator API Error Detail:", errText);
            throw new Error(`Erro na API (${response.status}). Verifique se sua chave suporta geração de imagens.`);
        }

        const data = await response.json();
        
        // Verifica se veio imagem inline
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
        
        if (imagePart) {
             return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        } else {
             // Se a IA responder com texto explicando que não pode gerar imagem, lançamos erro
             const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text;
             if (textPart) {
                 console.warn("AI returned text instead of image:", textPart);
                 throw new Error("A IA respondeu com texto. Tente simplificar o prompt.");
             }
             throw new Error("Resposta vazia da IA.");
        }
    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
