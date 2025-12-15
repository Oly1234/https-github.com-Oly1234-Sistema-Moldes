
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

    // Engenharia de Prompt
    let layoutInstruction = "";
    if (layout === 'Barrada') {
        layoutInstruction = "TYPE: ENGINEERED BORDER PRINT. Asymmetrical composition with heavy details at the bottom edge.";
    } else if (layout === 'Localizada') {
        layoutInstruction = "TYPE: PLACEMENT PRINT. Single central artwork, centered, no repeat.";
    } else {
        layoutInstruction = `TYPE: SEAMLESS REPEAT PATTERN. ${repeat === 'Half-Drop' ? 'Half-drop repeat' : 'Grid repeat'}. Edges must match perfectly.`;
    }

    const RAW_DIGITAL_PROMPT = `
    TASK: Generate a professional textile pattern design.
    SUBJECT: ${prompt}.
    PALETTE: ${colorList}.
    
    TECHNICAL SPECS:
    - ${layoutInstruction}
    - STYLE: ${styleGuide}.
    - VIEW: Flat 2D texture swatch. NO perspective, NO shadows, NO fabric grain.
    - QUALITY: Vector-like crispness, high contrast.
    `;

    try {
        const payload = {
            contents: [{ parts: [{ text: RAW_DIGITAL_PROMPT }] }],
            // NÃO USAR 'responseMimeType' ou 'imageSize' com este modelo.
            generationConfig: {
                // imageConfig opcional: aspectRatio padrão é 1:1
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
            throw new Error(`A IA recusou gerar a imagem. Motivo: "${textPart.text}". Tente simplificar o prompt.`);
        }
        
        throw new Error("Falha desconhecida: A IA não gerou imagem nem erro explícito.");

    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
