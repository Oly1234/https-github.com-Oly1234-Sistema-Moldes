
// DEPARTAMENTO: ATELIER DIGITAL
// Responsabilidade: Geração de Imagens (Estampas) via Prompt Direto

export const createTextileDesign = async (apiKey, prompt, colors) => {
    // ... mantido para compatibilidade, mas o fluxo principal agora usa generator.js ...
    return null; 
};

// NOVO: AUXILIAR DE PROMPT (Prompt Enhancement)
export const refineDesignPrompt = async (apiKey, rawInput) => {
    const MODEL_NAME = 'gemini-2.5-flash'; 
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const SYSTEM_PROMPT = `
    ACT AS: Senior Textile Designer & Prompt Engineer.
    
    TASK: Translate the user's raw idea into a "PROMPT BASE" for high-end textile generation.
    
    GUIDELINES (Based on Vingi System v6.4 Standards):
    1. STYLE: "Contemporary decorative", "Stylized clean illustration", "Organic vector trace".
    2. NEGATIVES: Explicitly mention "No watercolor blur", "No grain", "Solid colors".
    3. STRUCTURE: Define the motifs clearly (e.g., "Medium scale floral elements", "Organic leaves").
    
    USER INPUT: "${rawInput}"
    
    OUTPUT: A concise, technical prompt in English suitable for a generative model. Do not add intro text.
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
        return rawInput; // Fallback
    }
};
