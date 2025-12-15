
// api/modules/generator.js
// DEPARTAMENTO: ATELIER DIGITAL (Geração & Restauração de Estampas)

export const generatePattern = async (apiKey, prompt, colors, textileSpecs) => {
    // 1. Definição do Modelo (VOLTANDO PARA GEMINI 2.5 FLASH - ESTÁVEL)
    // O modelo 'imagen-3.0' causou erro 404/503 pois requer whitelist Vertex AI.
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    // 2. Desconstrução das Specs
    const { layout = "Corrida", repeat = "Straight", width = 64, height = 64, styleGuide = "Clean lines", dpi = 300 } = textileSpecs || {};
    
    // --- MELHORIA DE COR: Injeção de HEX e Pantone ---
    const colorList = colors && colors.length > 0 
        ? colors.map(c => `${c.name} (Hex: ${c.hex})`).join(', ') 
        : 'harmonious trend colors';

    // LÓGICA DE ENGENHARIA TÊXTIL
    let layoutInstruction = "";
    if (layout === 'Barrada') {
        layoutInstruction = "TYPE: ENGINEERED BORDER PRINT. Asymmetrical composition with heavy details at the bottom edge.";
    } else if (layout === 'Localizada') {
        layoutInstruction = "TYPE: PLACEMENT PRINT. Single central artwork, centered, no repeat. Suitable for t-shirt chest print.";
    } else {
        layoutInstruction = `TYPE: SEAMLESS REPEAT PATTERN. ${repeat === 'Half-Drop' ? 'Half-drop repeat' : 'Grid repeat'}. Edges must match perfectly for continuous printing.`;
    }

    // AJUSTE DE ESTILO
    const RAW_DIGITAL_PROMPT = `
    TASK: Generate a high-quality textile pattern file.
    SUBJECT: ${prompt}.
    PALETTE: ${colorList}.
    
    TECHNICAL SPECS:
    - ${layoutInstruction}
    - STYLE: ${styleGuide}.
    - RESOLUTION TARGET: ${dpi} DPI look & feel.
    - VIEW: Flat, top-down 2D texture swatch. NO perspective, NO shadows, NO fabric grain/weave.
    - QUALITY: Vector-like crispness, high contrast, professional print file ready.
    - NEGATIVE PROMPT: Do not render a dress, t-shirt, mannequin, furniture, or room. Render ONLY the artwork/pattern square.
    `;

    try {
        const payload = {
            contents: [{ parts: [{ text: RAW_DIGITAL_PROMPT }] }],
            // 'gemini-2.5-flash-image' usa generationConfig padrão, sem 'imageSize' que quebrava o request anterior
            generationConfig: {
                // Removemos configurações incompatíveis com o modelo Flash
            }
        };

        const response = await fetch(endpointImg, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Erro Atelier (${response.status}): ${errText}`);
        }

        const data = await response.json();
        
        // Estrutura de resposta do Gemini (generateContent)
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
        
        if (imagePart) {
            return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        }
        
        throw new Error("A IA processou o pedido mas não retornou a imagem (Bloqueio de segurança ou falha interna).");

    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
