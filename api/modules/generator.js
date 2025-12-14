
// api/modules/generator.js
// DEPARTAMENTO: ATELIER DIGITAL (Geração de Estampas)

export const generatePattern = async (apiKey, prompt, colors) => {
    // Instrução técnica para forçar o modelo a agir como uma impressora têxtil digital
    const colorList = colors && colors.length > 0 ? colors.map(c => c.name).join(', ') : 'harmonious colors';
    
    // PROMPT DE SEGURANÇA REFORÇADO
    // O Gemini bloqueia imagens que parecem pessoas reais em contextos ambíguos.
    // Forçamos o estilo "Digital Art" e "Abstract" para evitar isso.
    const finalPrompt = `
    Create a professional SEAMLESS TEXTILE PATTERN image (Digital Texture File).
    
    ARTISTIC BRIEF:
    - Subject: ${prompt}
    - Palette: ${colorList}
    
    SAFETY & STYLE GUIDELINES (STRICT):
    - STYLE: Vector Art / Watercolor Illustration / Digital Surface Design.
    - CONTENT: Abstract shapes, florals, geometrics, or objects. 
    - FORBIDDEN: DO NOT GENERATE PEOPLE. DO NOT GENERATE REALISTIC SKIN. DO NOT GENERATE NUDITY.
    - REASON: This is a fabric swatch for printing, not a photo of a person.
    
    TECHNICAL SPECS:
    - View: Top-down flat lay (2D).
    - Lighting: Even, studio lighting, no shadows.
    - Coverage: Edge-to-edge seamless repeat.
    `;

    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    try {
        const payload = {
            contents: [{ parts: [{ text: finalPrompt }] }],
            // generation_config otimizado
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
            throw new Error("A IA bloqueou a imagem por segurança. Tente descrever 'Textura Abstrata' ou 'Estampa Floral' sem mencionar corpos.");
        }

        const textPart = parts?.[0]?.text;
        if (textPart) {
             console.warn("AI returned text:", textPart);
             throw new Error("A IA gerou texto em vez de imagem. Tente simplificar o pedido.");
        }

        throw new Error("O servidor não retornou dados visuais.");

    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
