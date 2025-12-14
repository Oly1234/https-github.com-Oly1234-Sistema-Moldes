
// api/modules/generator.js
// ESPECIALIDADE: Geração de Imagens (Text-to-Image)

export const generatePattern = async (apiKey, prompt, colors) => {
    // Instrução técnica para forçar o modelo a agir como uma impressora têxtil digital
    const colorInstruction = colors && colors.length > 0 ? `COLOR PALETTE: ${colors.map(c => c.name).join(', ')}.` : '';
    
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

    // Usando Imagen 3 (via Gemini API) ou Gemini Image Model
    // A configuração deve ser limpa para evitar erro 400
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
    
    try {
        const response = await fetch(endpointImg, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({
                contents: [{ parts: [{ text: finalPrompt }] }],
                generation_config: { 
                    // REMOVIDO response_mime_type que causa erro 400 em modelos de imagem
                    candidate_count: 1,
                    // Aspect ratio deve ser passado corretamente se suportado, senão o modelo decide
                    aspect_ratio: "1:1"
                 }
            }) 
        });
        
        if (!response.ok) {
            const errText = await response.text();
            console.error("Generator API Error Detail:", errText);
            throw new Error(`API Error ${response.status}: Verifique se sua chave suporta o modelo de imagem.`);
        }

        const data = await response.json();
        
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
        
        if (imagePart) {
             return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        } else {
             console.error("Generator output format issue:", data);
             throw new Error("A IA processou o pedido mas não retornou imagem. Tente simplificar o prompt.");
        }
    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
