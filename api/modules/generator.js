
// api/modules/generator.js
// DEPARTAMENTO: ATELIER DIGITAL (Geração & Restauração de Estampas)

export const generatePattern = async (apiKey, prompt, colors, textileSpecs) => {
    // 1. Definição do Modelo (Nano Banana para Imagem)
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    // 2. Desconstrução das Specs
    const { layout = "Corrida", repeat = "Straight", width = 64, height = 64, styleGuide = "Clean lines", dpi = 300 } = textileSpecs || {};
    
    // --- MELHORIA DE COR: Injeção de HEX e Pantone ---
    const colorList = colors && colors.length > 0 
        ? colors.map(c => `${c.name} (Hex: ${c.hex})`).join(', ') 
        : 'harmonious trend colors';

    // LÓGICA DE ENGENHARIA TÊXTIL (Context-Aware Layout)
    let layoutInstruction = "";
    const isVertical = height > width;
    
    if (layout === 'Barrada') {
        if (width < 80) {
            layoutInstruction = `
            LAYOUT: HALF-WIDTH ENGINEERED BORDER (Meio-Painel).
            - CANVAS: ${width}cm (Weft) x ${height}cm (Warp).
            - COMPOSITION: Heavy border on ONE SIDE only, fading into open space.
            - LOGIC: Designed to be MIRRORED.
            `;
        } else {
            layoutInstruction = `
            LAYOUT: FULL-WIDTH ENGINEERED BORDER (Painel Completo).
            - CANVAS: ${width}cm (Weft) x ${height}cm (Warp).
            - COMPOSITION: Dress panel. Heavy borders at the hem, lighter towards top.
            `;
        }
    } else if (layout === 'Localizada') {
        layoutInstruction = `
        LAYOUT: PLACEMENT PRINT (LOCALIZADA - PANEL).
        - CANVAS: ${width}cm x ${height}cm.
        - COMPOSITION: Centralized artwork. Symmetrical or balanced.
        `;
    } else {
        // Corrida (Seamless)
        let repeatLogic = "";
        if (repeat === 'Half-Drop') {
             repeatLogic = "REPEAT STYLE: VISUAL HALF-DROP (Diamond grid).";
        } else if (repeat === 'Mirror') {
             repeatLogic = "REPEAT STYLE: MIRROR SYMMETRY (Kaleidoscopic).";
        } else {
             repeatLogic = "REPEAT STYLE: STANDARD SEAMLESS GRID.";
        }

        layoutInstruction = `
        LAYOUT: SEAMLESS REPEAT (ALL-OVER).
        - TILE SIZE: ${width}cm x ${height}cm.
        - ${repeatLogic}
        - CONTINUITY: Perfect edge matching.
        `;
    }

    // AJUSTE DE ESTILO: RAW DIGITAL vs TEXTURE
    // O usuário solicitou explicitamente REMOVER a trama do tecido para aplicar depois.
    const RAW_DIGITAL_PROMPT = `
    STYLE: RAW DIGITAL ARTWORK (FLAT VECTOR STYLE).
    - CRITICAL: DO NOT RENDER FABRIC WEAVE, TEXTURE, OR GRAIN.
    - CRITICAL: The output must look like a digital file from Illustrator/Photoshop, NOT a photo of fabric.
    - Surface: Perfectly smooth, flat colors, clean gradients.
    - This allows the user to apply their own fabric texture overlay later.
    - High contrast, sharp edges, "Print Ready" file.
    `;

    const finalPrompt = `
    Create a professional textile pattern design file.
    Subject: ${prompt}.
    
    COLOR PALETTE:
    ${colorList}
    
    TECHNICAL SPECS:
    ${layoutInstruction}
    
    ARTISTIC DIRECTION:
    ${styleGuide}
    ${RAW_DIGITAL_PROMPT}
    
    CRITICAL:
    - Eliminate all noise, blur, and realistic fabric imperfections.
    - Focus on the ARTWORK, not the substrate.
    `;

    try {
        const payload = {
            contents: [{ parts: [{ text: finalPrompt }] }],
            generationConfig: {
                imageConfig: {
                    aspectRatio: "1:1" // Mantém 1:1 por limitação atual do modelo
                }
            }
        };

        const response = await fetch(endpointImg, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Erro Atelier (${response.status}): O servidor rejeitou a solicitação.`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        
        if (candidate?.finishReason === 'SAFETY') throw new Error("Safety Filter: Tente simplificar o prompt.");
        
        const imagePart = candidate?.content?.parts?.find(p => p.inlineData);
        if (imagePart) return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        
        throw new Error("A IA processou o pedido mas não retornou a imagem.");

    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
