
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
        // LÓGICA DE LARGURA ÚTIL PARA BARRADOS
        // Se largura < 80cm: Provável meio-painel para espelhamento.
        // Se largura > 130cm: Painel inteiro.
        
        if (width < 80) {
            layoutInstruction = `
            LAYOUT: HALF-WIDTH ENGINEERED BORDER (Meio-Painel).
            - CANVAS: ${width}cm (Weft) x ${height}cm (Warp).
            - COMPOSITION: Design a heavy border on ONE SIDE only. The other side should fade into open space/solid color.
            - LOGIC: This design is intended to be MIRRORED later to create a full gown. Focus detail on the border edge.
            - ORIENTATION: ${isVertical ? 'Vertical flow' : 'Horizontal flow'}.
            `;
        } else {
            layoutInstruction = `
            LAYOUT: FULL-WIDTH ENGINEERED BORDER (Painel Completo).
            - CANVAS: ${width}cm (Weft) x ${height}cm (Warp).
            - COMPOSITION: Complete dress panel. Heavy borders at the hem (bottom), graduating to lighter motifs/solid color towards the top/center.
            - LOGIC: Ready-to-print panel for a full skirt or dress.
            `;
        }
    } else if (layout === 'Localizada') {
        layoutInstruction = `
        LAYOUT: PLACEMENT PRINT (LOCALIZADA - PANEL).
        - CANVAS: ${width}cm x ${height}cm.
        - COMPOSITION: Centralized artwork. Focus on symmetry and balance within the bounding box.
        - USAGE: T-shirt placement, Scarf center, or Cushion.
        `;
    } else {
        // Corrida (Seamless)
        let repeatLogic = "";
        if (repeat === 'Half-Drop') {
             repeatLogic = "REPEAT STYLE: VISUAL HALF-DROP. Arrange motifs in a Diamond grid. Fluid, non-linear distribution to avoid striping.";
        } else if (repeat === 'Mirror') {
             repeatLogic = "REPEAT STYLE: MIRROR SYMMETRY. Kaleidoscopic reflection.";
        } else {
             repeatLogic = "REPEAT STYLE: STANDARD SEAMLESS GRID.";
        }

        layoutInstruction = `
        LAYOUT: SEAMLESS REPEAT (ALL-OVER).
        - TILE SIZE: ${width}cm x ${height}cm.
        - ${repeatLogic}
        - CONTINUITY: Edges must match perfectly for infinite tiling.
        `;
    }

    // AJUSTE DE ESTILO (RICH VS STIFF)
    // O usuário reclamou de "dureza". Adicionamos profundidade e nuance.
    let artisticVibe = "";
    if (dpi >= 300) {
        artisticVibe = `
        STYLE: HIGH-FIDELITY VECTOR AESTHETIC with PAINTERLY DEPTH.
        - Do NOT make it look flat or stiff. Use "Tone-on-Tone" shading.
        - Include subtle gradients, fabric texture simulation, and rich color nuances.
        - Maintain sharp edges for printing, but simulate organic flow within the shapes.
        - If floral/organic: Use watercolor bleeds or etching details.
        `;
    } else {
        artisticVibe = "Style: Digital Textile Print, Rich Texture, Painterly details.";
    }

    const finalPrompt = `
    Create a professional textile pattern design file (Digital Print Ready).
    Subject: ${prompt}.
    
    COLOR PALETTE:
    ${colorList}
    
    TECHNICAL SPECS:
    ${layoutInstruction}
    
    ARTISTIC DIRECTION:
    ${styleGuide}
    ${artisticVibe}
    
    CRITICAL:
    - Ensure the design looks like a high-end fabric scan, not a simple clipart.
    - Incorporate depth, shadows, and highlights based on the original reference style.
    `;

    try {
        const payload = {
            contents: [{ parts: [{ text: finalPrompt }] }],
            generationConfig: {
                imageConfig: {
                    aspectRatio: "1:1" // Mantém 1:1 por limitação atual do modelo, corte feito no layout UI
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
