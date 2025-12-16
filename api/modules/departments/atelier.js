// api/modules/departments/atelier.js
// DEPARTAMENTO: TRADUTOR SIMPLES
// Responsabilidade: Traduzir PT -> EN (Keywords apenas)

export const createTextileDesign = async (apiKey, prompt, colors) => {
    return null; 
};

export const refineDesignPrompt = async (apiKey, rawInput) => {
    // Se o input for curto e simples, nem chama a IA para economizar tempo/erros
    if (rawInput.split(' ').length < 3 && /^[a-zA-Z\s]*$/.test(rawInput)) {
        return rawInput;
    }

    const MODEL_NAME = 'gemini-2.5-flash'; 
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const SYSTEM_PROMPT = `
    TASK: Translate this pattern description to ENGLISH keywords.
    INPUT: "${rawInput}"
    
    RULES:
    1. Remove words like "dress", "skirt", "blouse", "woman", "body".
    2. Keep only visual motifs (e.g. "flower", "stripe", "dot", "tropical").
    3. Output a simple comma-separated list.
    
    EXAMPLE:
    Input: "Um vestido floral vermelho longo"
    Output: "red floral motifs, botanical pattern"
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
        return rawInput; // Fallback: usa o texto original
    }
};