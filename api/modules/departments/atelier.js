
// DEPARTAMENTO: ATELIER DIGITAL & MAPEAMENTO SEMÂNTICO
// Responsabilidade: Traduzir intenção do usuário para "Safe Technical Prompt" em INGLÊS.

export const createTextileDesign = async (apiKey, prompt, colors) => {
    return null; // Legacy stub
};

// MAPEAMENTO SEMÂNTICO (Lógica "Hardcoded" para velocidade + IA para nuance)
// Traduzindo gatilhos PT -> EN Técnico
const SEMANTIC_MAP = {
    "floral": "stylized botanical structures",
    "flor": "radial botanical element",
    "tropical": "large scale planar foliage",
    "folha": "vector vegetal shape",
    "natureza": "geometric natural inspiration",
    "orgânico": "controlled fluid lines",
    "organic": "controlled fluid lines",
    "abstrato": "geometric non-figurative composition",
    "abstract": "geometric non-figurative composition",
    "artistico": "high definition graphic style",
    "artistic": "high definition graphic style",
    "pele": "neutral sand tone",
    "skin": "neutral sand tone",
    "corpo": "structural form",
    "body": "structural form"
};

export const refineDesignPrompt = async (apiKey, rawInput) => {
    // 1. SUBSTITUIÇÃO IMEDIATA (Hardcoded Safety)
    let safeInput = rawInput.toLowerCase();
    Object.keys(SEMANTIC_MAP).forEach(key => {
        if (safeInput.includes(key)) {
            safeInput = safeInput.replace(new RegExp(key, 'g'), SEMANTIC_MAP[key]);
        }
    });

    const MODEL_NAME = 'gemini-2.5-flash'; 
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const SYSTEM_PROMPT = `
    ACT AS: Textile Prompt Engineer.
    
    OBJECTIVE: Translate the user's input into a technical description for the "Master Textile Prompt" in ENGLISH.
    
    INPUT: "${safeInput}"
    
    RULES:
    1. CATEGORIZE: Is it "Botanical", "Tropical", "Ornamental" or "Geometric"?
    2. DESCRIBE: Use terms like "vector", "flat", "planar", "stylized".
    3. LANGUAGE: Output MUST be in ENGLISH.
    4. FORBIDDEN: Do NOT use "body", "skin", "nude", "realistic", "photo". Use "floral" only if modified by "botanical" or "stylized".
    
    OUTPUT: A single paragraph in ENGLISH describing the motifs technically.
    Example output: "Stylized botanical motifs with planar leaves in a rhythmic composition."
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
        return text ? text.trim() : safeInput;

    } catch (e) {
        console.error("Prompt Refiner Error:", e);
        return safeInput; // Retorna o input sanitizado manualmente se a IA falhar
    }
};
