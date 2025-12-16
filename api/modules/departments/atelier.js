
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

// NOVO: AUXILIAR DE PROMPT (Prompt Enhancement)
export const refineDesignPrompt = async (apiKey, rawInput) => {
    const MODEL_NAME = 'gemini-2.5-flash'; // Text model is enough for this
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const SYSTEM_PROMPT = `
    ACT AS: Senior Textile Designer & Prompt Engineer.
    TASK: Rewrite the user's raw idea into a professional, highly detailed prompt for an Image Generative AI (like Midjourney or Gemini).
    
    GOAL: Use industry terminology to ensure the result matches the user's intent but looks professional.
    
    USER INPUT: "${rawInput}"
    
    INSTRUCTIONS:
    1. Translate to English (the AI understands it better).
    2. Add keywords for: Technique (e.g., Watercolor, Screen Print), Layout (e.g., Tossed, Ogee), Style (e.g., Chinoiserie, Bauhaus).
    3. Ensure it specifies "Seamless Pattern" and "Flat View".
    4. Keep it concise but descriptive.
    
    OUTPUT: Just the refined prompt text. No "Here is the prompt" intro.
    `;

    const payload = {
        contents: [{ parts: [{ text: SYSTEM_PROMPT }] }]
    };

    try {
        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return text ? text.trim() : rawInput;

    } catch (e) {
        console.error("Prompt Refiner Error:", e);
        return rawInput; // Fallback to original
    }
};
