
// api/modules/generator.js
// DEPARTAMENTO: ATELIER DIGITAL (Geração & Restauração de Estampas)

export const generatePattern = async (apiKey, prompt, colors, textileSpecs) => {
    // 1. Definição do Modelo (Imagen 3 para Alta Fidelidade Têxtil)
    const MODEL_NAME = 'imagen-3.0-generate-001'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:predict?key=${apiKey}`;

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
        // Payload específico para Imagen (Predict API)
        const payload = {
            instances: [
                { prompt: finalPrompt }
            ],
            parameters: {
                sampleCount: 1,
                aspectRatio: "1:1"
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
        
        // Estrutura de resposta do Imagen
        const prediction = data.predictions?.[0];
        
        if (prediction?.bytesBase64Encoded) {
            const mime = prediction.mimeType || 'image/png';
            return `data:${mime};base64,${prediction.bytesBase64Encoded}`;
        }
        
        throw new Error("A IA processou o pedido mas não retornou a imagem (Formato inesperado).");

    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
