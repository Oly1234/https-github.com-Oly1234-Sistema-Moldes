
// DEPARTAMENTO: ATELIER DIGITAL & MAPEAMENTO SEMÂNTICO
// Responsabilidade: Traduzir intenção do usuário para "Safe Technical Prompt".

export const createTextileDesign = async (apiKey, prompt, colors) => {
    return null; // Legacy stub
};

// MAPEAMENTO SEMÂNTICO (Lógica "Hardcoded" para velocidade + IA para nuance)
const SEMANTIC_MAP = {
    "floral": "motivos botânicos estilizados e estruturados",
    "flor": "elemento botânico radial",
    "tropical": "folhagens planificadas de grande escala e alto contraste",
    "folha": "forma vegetal vetorial",
    "natureza": "inspiração natural geométrica",
    "orgânico": "traços fluidos controlados",
    "organic": "controlled fluid lines",
    "abstrato": "composição não-figurativa geométrica",
    "abstract": "geometric non-figurative composition",
    "artistico": "estilo gráfico de alta definição",
    "artistic": "high definition graphic style",
    "pele": "tom areia neutro",
    "skin": "neutral sand tone",
    "corpo": "forma estrutural",
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
    
    OBJECTIVE: Translate the user's input into a technical description for the "Master Textile Prompt".
    
    INPUT: "${safeInput}"
    
    RULES:
    1. CATEGORIZE: Is it "Botânico", "Tropical", "Ornamental" or "Geométrico"?
    2. DESCRIBE: Use terms like "vetorial", "chapado", "planificado", "estilizado".
    3. FORBIDDEN: Do NOT use "floral", "organic", "watercolor", "realistic".
    
    OUTPUT: A single paragraph in Portuguese describing the motifs technically.
    Example output: "Motivos botânicos estilizados com folhas planificadas em composição rítmica."
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
