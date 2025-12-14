
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

    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
    
    try {
        const response = await fetch(endpointImg, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({
                contents: [{ parts: [{ text: finalPrompt }] }],
                generation_config: { 
                    response_mime_type: "image/jpeg",
                    aspect_ratio: "1:1",
                    candidate_count: 1
                 }
            }) 
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        
        // Verificação robusta: O modelo pode retornar texto se não conseguir gerar imagem (Safety filters, etc)
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
        
        if (imagePart) {
             return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        } else {
             // Fallback de erro descritivo
             console.error("Generator output format issue:", data);
             throw new Error("A IA não conseguiu gerar uma imagem para este prompt. Tente simplificar a descrição.");
        }
    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
