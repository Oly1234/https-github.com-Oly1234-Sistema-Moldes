
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
    
    if (layout === 'Barrada') {
        if (width < 80) {
            layoutInstruction = `
            TYPE: ENGINEERED BORDER PRINT (BARRADO).
            - COMPOSITION: Asymmetrical. Heavy artistic details on the BOTTOM edge, fading upwards into negative space or smaller motifs.
            - USAGE: Hemline of a dress.
            `;
        } else {
            layoutInstruction = `
            TYPE: DOUBLE BORDER PANEL.
            - COMPOSITION: Rich details at bottom and top edges. Center is lighter.
            `;
        }
    } else if (layout === 'Localizada') {
        layoutInstruction = `
        TYPE: PLACEMENT PRINT (ENGINEERED PANEL).
        - COMPOSITION: One single, magnificent central artwork. Perfectly centered.
        - NO REPEAT. This is a chest print or scarf panel.
        `;
    } else {
        // Corrida (Seamless) - REFORÇO DE CONTINUIDADE
        let repeatLogic = "";
        if (repeat === 'Half-Drop') {
             repeatLogic = "REPEAT: HALF-DROP (Diamond Layout). Fluid diagonal flow.";
        } else if (repeat === 'Mirror') {
             repeatLogic = "REPEAT: KALEIDOSCOPIC MIRROR. Symmetrical reflection from center.";
        } else {
             repeatLogic = "REPEAT: SQUARE GRID (Straight).";
        }

        layoutInstruction = `
        TYPE: SEAMLESS REPEAT PATTERN (ALL-OVER).
        - ${repeatLogic}
        - EDGES: Must match perfectly left-to-right and top-to-bottom.
        `;
    }

    // AJUSTE DE ESTILO: RAW ARTWORK vs GARMENT SILHOUETTE
    // Correção Crítica: O usuário não quer ver um vestido, quer ver a ARTE.
    const RAW_DIGITAL_PROMPT = `
    FORMAT: RECTANGULAR TEXTURE SWATCH (FULL BLEED).
    
    NEGATIVE CONSTRAINTS (DO NOT DRAW):
    - DO NOT DRAW A DRESS, T-SHIRT, MANNEQUIN, OR MODEL.
    - DO NOT DRAW NECKLINES, SLEEVES, OR SEAMS.
    - DO NOT LEAVE WHITE BORDERS. FILL THE ENTIRE CANVAS.
    
    ARTISTIC DIRECTION:
    - STYLE: ${styleGuide}
    - FLUIDITY: Create ORGANIC FLOW and NATURAL MOVEMENT. Avoid stiff, rigid, or overly geometric layouts unless requested.
    - DETAILS: High-Fidelity, Painterly, Intricate. Use rich gradients, tone-on-tone depth, and volumetric shading to give life to elements.
    - SURFACE: Flat Digital Artwork (for printing). 
    - TEXTURE NOTE: Do NOT render fabric grain (weave/threads). Keep the base flat for printing, but make the ARTWORK itself look rich and dimensional.
    `;

    const finalPrompt = `
    Create a professional high-end textile design file.
    Subject: ${prompt}.
    
    COLOR PALETTE:
    ${colorList}
    
    TECHNICAL SPECS:
    ${layoutInstruction}
    
    ${RAW_DIGITAL_PROMPT}
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
