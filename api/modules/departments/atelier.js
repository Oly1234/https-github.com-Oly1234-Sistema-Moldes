
// DEPARTAMENTO: ATELIER DIGITAL
// Responsabilidade: Geração de Imagens (Estampas) via Prompt Direto

export const createTextileDesign = async (apiKey, prompt, colors) => {
    const MODEL_NAME = 'gemini-2.5-flash-image';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const colorString = colors && colors.length > 0 
        ? colors.map(c => c.name).join(', ') 
        : 'harmonious trend colors';

    // Fallback de segurança para prompt
    const safeSubject = prompt && prompt.trim().length > 0 ? prompt : "Artistic seamless textile pattern";

    const ENGINEERING_PROMPT = `
    Design a professional seamless textile pattern.
    Subject: ${safeSubject}.
    Palette: ${colorString}.
    Style: High-end fabric print, flat view, no shadows, seamless repeat.
    Quality: 4k, detailed, vector-like precision.
    `;

    const payload = {
        contents: [{ parts: [{ text: ENGINEERING_PROMPT }] }]
    };

    try {
        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Atelier Error (${response.status}): ${err}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts;
        const imagePart = candidate?.find(p => p.inline_data);
        
        if (imagePart) {
            return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        }
        
        const textPart = candidate?.find(p => p.text);
        throw new Error(textPart ? `Recusa da IA: ${textPart.text}` : "O Atelier não conseguiu renderizar a imagem visual.");

    } catch (e) {
        console.error("Atelier Dept Exception:", e);
        throw e;
    }
};
