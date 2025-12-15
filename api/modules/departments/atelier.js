
// DEPARTAMENTO: ATELIER DIGITAL
// Responsabilidade: Geração de Imagens (Estampas) usando Gemini Nano Banana

export const createTextileDesign = async (apiKey, prompt, colors) => {
    const MODEL_NAME = 'gemini-2.5-flash-image';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const colorString = colors && colors.length > 0 
        ? colors.map(c => c.name).join(', ') 
        : 'harmonious trend colors';

    // Prompt de Engenharia Têxtil
    const ENGINEERING_PROMPT = `
    Design a professional seamless textile pattern.
    Subject: ${prompt}.
    Palette: ${colorString}.
    Style: High-end fabric print, flat view, no shadows, seamless repeat.
    Quality: 4k, detailed, vector-like precision.
    `;

    const payload = {
        contents: [{ parts: [{ text: ENGINEERING_PROMPT }] }],
        generationConfig: {
            imageConfig: {
                aspectRatio: "1:1",
                imageSize: "1K"
            }
        }
    };

    try {
        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Atelier Error (${response.status}): Verifique permissões do modelo de imagem.`);
        }

        const data = await response.json();
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
        
        if (imagePart) {
            return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        }
        
        throw new Error("O Atelier não conseguiu renderizar a imagem visual.");

    } catch (e) {
        console.error("Atelier Dept Exception:", e);
        throw e;
    }
};
