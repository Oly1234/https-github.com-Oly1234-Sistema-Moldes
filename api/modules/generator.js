
// api/modules/generator.js
// DEPARTAMENTO: ATELIER DIGITAL (Geração & Restauração de Estampas)

export const generatePattern = async (apiKey, prompt, colors, textileSpecs) => {
    // 1. Definição do Modelo: USAR APENAS FLASH-IMAGE (NANO BANANA)
    // Documentação: https://ai.google.dev/gemini-api/docs/models/gemini#gemini-2.5-flash-image
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    // 2. Desconstrução das Specs
    const { layout = "Corrida", repeat = "Straight", styleGuide = "Clean lines", dpi = 300 } = textileSpecs || {};
    
    // Injeção de Cores
    const colorList = colors && colors.length > 0 
        ? colors.map(c => `${c.name} (Hex: ${c.hex})`).join(', ') 
        : 'harmonious trend colors';

    // Engenharia de Prompt (Optimized for Flash Image)
    let layoutInstruction = "Seamless Repeat Pattern";
    if (layout === 'Barrada') {
        layoutInstruction = "Engineered Border Print (Heavy bottom, open top)";
    } else if (layout === 'Localizada') {
        layoutInstruction = "Placement Print (Centralized motif, isolated)";
    }

    // Fallback para prompt vazio
    const safeSubject = prompt && prompt.trim().length > 2 
        ? prompt 
        : "Abstract textile pattern with elegant motifs";

    // PROMPT OTIMIZADO (Tag-based vs Conversational)
    const RAW_DIGITAL_PROMPT = `
    Generate a professional textile pattern.
    Subject: ${safeSubject}.
    Colors: ${colorList}.
    Style: ${styleGuide}, Flat 2D vector graphic, No shadows, No photorealism.
    Layout: ${layoutInstruction}, ${repeatTypeToText(repeat)}.
    Quality: High resolution, sharp edges, professional fabric print.
    `;

    try {
        const payload = {
            contents: [{ parts: [{ text: RAW_DIGITAL_PROMPT }] }],
            // Flash Image não suporta responseMimeType nem imageSize config
            generationConfig: {
                // imageConfig opcional se necessário, mas flash-image prefere defaults
            }
        };

        const response = await fetch(endpointImg, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Google API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        
        // Verificação Robusta da Resposta
        const candidate = data.candidates?.[0]?.content?.parts;
        if (!candidate) throw new Error("A IA retornou uma resposta vazia.");

        // Procura pela parte de imagem
        const imagePart = candidate.find(p => p.inline_data);
        
        if (imagePart) {
            return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        }
        
        // Se não tem imagem, verifica se tem texto de recusa (Safety/Refusal)
        const textPart = candidate.find(p => p.text);
        if (textPart) {
            // Tratamento específico para recusas
            console.warn("AI Refusal:", textPart.text);
            throw new Error(`A IA não pôde gerar esta estampa (Política de Segurança). Tente simplificar o prompt ou remover termos sensíveis.`);
        }
        
        throw new Error("Falha na geração: A IA não retornou imagem.");

    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};

const repeatTypeToText = (type) => {
    switch(type) {
        case 'Half-Drop': return 'Half-drop repeat alignment';
        case 'Mirror': return 'Mirrored repeat alignment';
        default: return 'Straight grid repeat';
    }
};
