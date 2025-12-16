// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (Baseado no Core funcional)

const callGeminiImage = async (apiKey, prompt) => {
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            candidateCount: 1,
            // Configuração conforme referência: AspectRatio 1:1 é padrão implícito se não enviado,
            // mas o modelo flash-image aceita prompts diretos.
        }
    };

    try {
        const response = await fetch(endpointImg, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!response.ok) {
            console.error("Gemini API Error Status:", response.status);
            throw new Error(`Erro na API Google: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.promptFeedback?.blockReason) {
             throw new Error("Conteúdo bloqueado por segurança. Tente termos mais simples.");
        }

        const candidate = data.candidates?.[0]?.content?.parts;
        if (!candidate) throw new Error("A IA não gerou conteúdo visual.");

        const imagePart = candidate.find(p => p.inline_data);
        if (imagePart) {
            return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        }
        
        throw new Error("A IA respondeu apenas com texto, sem imagem.");
    } catch (e) {
        throw e;
    }
};

export const generatePattern = async (apiKey, prompt, colors) => {
    // LÓGICA FIEL AO 'generatePatternDraft'
    
    // Constrói contexto de cores se houver
    const colorContext = (colors && colors.length > 0) 
        ? `Paleta de cores: ${colors.map(c => c.hex).join(', ')}.` 
        : "Use cores de tendência atuais.";

    // PROMPT EM PORTUGUÊS (Conforme referência que funcionava)
    const FULL_PROMPT = `Crie uma estampa têxtil profissional seamless (sem emendas) com o tema: "${prompt}".
    
    Especificações Técnicas: Estilo Digital, Alta Definição, Rapport de Repetição.
    ${colorContext}
    Evite marca d'água.
    
    IMPORTANTE: Gere apenas a textura plana 2D.`;

    return await callGeminiImage(apiKey, FULL_PROMPT);
};