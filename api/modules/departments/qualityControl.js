
// api/modules/departments/qualityControl.js
// DEPARTAMENTO: CONTROLE DE QUALIDADE & REFINAMENTO (The Polisher)
// Responsabilidade: Refinar o desenho gerado, aplicando limpeza vetorial e proporção.

export const enhancePatternQuality = async (apiKey, imageBase64, contextPrompt) => {
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const POLISHER_PROMPT = `
    ATUE COMO: Técnico de Pré-Impressão Têxtil.
    TAREFA: Vetorizar e Refinar esta amostra de estampa (Image-to-Image).
    
    DIRETRIZES DE MELHORIA VISUAL:
    1. LIMPEZA: Refinar contornos para obter traços limpos e contínuos (Clean Vector Lines).
    2. REDUÇÃO DE RUÍDO: Eliminar imperfeições, granulação e borrões não intencionais.
    3. COR: Achatar as cores para "Solid Flat Colors" (simulando separação de quadricromia).
    4. PROPORÇÃO: Harmonizar as proporções entre os elementos gráficos mantendo a composição original.
    
    CONTEXTO DO DESENHO: ${contextPrompt || "Estampa técnica vetorial"}
    
    OBJETIVO: Entregar um arquivo final de alta definição pronto para gravação de cilindro.
    IMPORTANTE: Mantenha a imagem como SWATCH 2D PLANO. Não adicione dobras ou efeitos 3D.
    `;

    const payload = {
        contents: [{ 
            parts: [
                { text: POLISHER_PROMPT },
                { inline_data: { mime_type: "image/png", data: imageBase64 } }
            ] 
        }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
        ]
    };

    try {
        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });

        if (!response.ok) throw new Error("Falha no refinamento.");

        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts;
        
        if (data.promptFeedback?.blockReason) throw new Error("SAFETY_BLOCK_QC");

        const imagePart = candidate?.find(p => p.inline_data);

        if (imagePart) {
            return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        }
        
        throw new Error("Refinamento falhou.");

    } catch (e) {
        console.error("QC Department Error:", e);
        throw e;
    }
};
