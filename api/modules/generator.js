
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

    // LÓGICA DE LAYOUT TÊXTIL (Direção da Arte baseada em Ourela/Trama)
    // Se altura (Urdume) > Largura, favorecer layout vertical.
    let layoutInstruction = "";
    const isVertical = height > width;
    
    if (layout === 'Barrada') {
        layoutInstruction = `
        LAYOUT: ENGINEERED BORDER PRINT (BARRADO).
        - CANVAS: ${width}cm (Weft) x ${height}cm (Warp).
        - DIRECTION: The border motifs must run along the ${isVertical ? 'vertical' : 'horizontal'} edge.
        - GRAVITY: Heavy motifs at the bottom/edge, fading to solid color.
        `;
    } else if (layout === 'Localizada') {
        layoutInstruction = `
        LAYOUT: PLACEMENT PRINT (LOCALIZADA).
        - CANVAS: ${width}cm x ${height}cm.
        - COMPOSITION: Single central element, perfectly centered.
        - BACKGROUND: Clean or subtle texture, suitable for a t-shirt chest or scarf panel.
        `;
    } else {
        // Corrida (Default)
        // LÓGICA DE MAESTRIA PARA MEIO-SALTO (HALF-DROP)
        // Para que o meio-salto funcione em um tile único gerado por IA, 
        // solicitamos que a disposição interna dos motivos seja "Diamante" ou "Diagonal".
        // Assim, visualmente não cria linhas (avenidas), simulando o efeito de cilindro.
        
        let repeatLogic = "";
        if (repeat === 'Half-Drop') {
             repeatLogic = "REPEAT STYLE: VISUAL HALF-DROP (MEIO-SALTO). Arrange motifs in a Diamond/Diagonal grid to avoid vertical striping. Fluid distribution.";
        } else if (repeat === 'Mirror') {
             repeatLogic = "REPEAT STYLE: KALEIDOSCOPIC MIRROR SYMMETRY. Center focused, reflecting outwards.";
        } else {
             repeatLogic = "REPEAT STYLE: STANDARD STRAIGHT GRID (CORRIDO). Aligned motif distribution.";
        }

        layoutInstruction = `
        LAYOUT: SEAMLESS REPEAT (ALL-OVER).
        - REPEAT SIZE: ${width}cm (Weft) x ${height}cm (Warp).
        - ${repeatLogic}
        - TILING: Must be a perfect seamless tile. Edges must match perfectly on all sides.
        - ORIENTATION: ${isVertical ? 'Vertical flow (Waterfall)' : 'Multi-directional'}.
        `;
    }

    // AJUSTE DE QUALIDADE BASEADO EM DPI (PRO MODE)
    // DPI alto força estilo vetorial "plano" para facilitar vetorização posterior.
    // DPI baixo (72) permite mais "ruído" artístico.
    let qualityPrompt = "";
    if (dpi >= 300) {
        qualityPrompt = "Style: VECTOR ILLUSTRATION, Flat Colors, Sharp Edges, No Blur, No JPEG Artifacts. Optimized for Screen Printing Separation.";
    } else {
        qualityPrompt = "Style: Digital Textile Print, High Definition, Rich Texture.";
    }

    // Prompt Otimizado
    const finalPrompt = `
    Create a professional textile pattern design file.
    Subject: ${prompt}.
    
    COLOR PALETTE (STRICT ADHERENCE):
    ${colorList}
    
    TECHNICAL SPECS:
    ${layoutInstruction}
    
    QUALITY STANDARDS:
    - ${styleGuide}
    - ${qualityPrompt}
    - Output: A single high-quality texture tile.
    `;

    try {
        const payload = {
            contents: [{ parts: [{ text: finalPrompt }] }],
            generationConfig: {
                imageConfig: {
                    aspectRatio: "1:1" // Mantemos 1:1 pois o modelo ainda não suporta custom aspect ratio arbitrário confiavelmente, o corte é feito no layout.
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
            console.error("Generator API Error Details:", errText);
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
