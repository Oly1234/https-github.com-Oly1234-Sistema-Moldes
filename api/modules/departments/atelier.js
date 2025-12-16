// api/modules/departments/atelier.js
// DEPARTAMENTO: ANÁLISE DE REFERÊNCIA (Vision to Prompt)

// Substitui a tradução simples pela análise visual completa conforme referência
export const refineDesignPrompt = async (apiKey, imageBase64) => {
    const MODEL_NAME = 'gemini-2.5-flash'; 
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    // PROMPT CONFORME REFERÊNCIA 'analyzePatternFromImage'
    const SYSTEM_PROMPT = `
    Atue como um Diretor de Arte Têxtil Sênior. Analise esta imagem para reprodução técnica.
    
    Retorne APENAS um texto descritivo (PROMPT) detalhado para gerar uma estampa idêntica a esta.
    Descreva elementos, fundo, estilo artístico e cores.
    Seja direto, sem introduções.
    Exemplo: "Estampa floral aquarela com hibiscos vermelhos e folhas de palmeira verde escura sobre fundo creme, estilo tropical vintage."
    `;

    const payload = {
        contents: [{ 
            parts: [
                { text: SYSTEM_PROMPT },
                { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
            ] 
        }]
    };

    try {
        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return text ? text.trim() : "Estampa geométrica abstrata.";

    } catch (e) {
        console.error("Atelier Analysis Error:", e);
        return "Estampa têxtil padronizada.";
    }
};

export const createTextileDesign = async () => null; // Stub