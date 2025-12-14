
// api/modules/generator.js
// DEPARTAMENTO: ATELIER DIGITAL (Geração & Restauração de Estampas)

export const generatePattern = async (apiKey, prompt, colors, textileSpecs) => {
    // 1. Definição do Modelo (Nano Banana para Imagem)
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    // 2. Desconstrução das Specs
    // 'styleGuide' substitui 'restoration' para focar em criação
    const { layout = "Corrida", selvedge = "Inferior", width = 140, height = 100, styleGuide = "Clean lines", dpi = 72 } = textileSpecs || {};
    
    const colorList = colors && colors.length > 0 ? colors.map(c => c.name).join(', ') : 'harmonious colors';

    // LÓGICA DE LAYOUT TÊXTIL (Direção da Arte)
    let layoutInstruction = "";
    
    if (layout === 'Barrada') {
        layoutInstruction = `
        LAYOUT: ENGINEERED BORDER PRINT (BARRADO).
        - DIMENSIONS: Design must fit exactly within the ${width}x${height}cm canvas.
        - GRAVITY: Motifs concentrated at the ${selvedge.toUpperCase()} edge.
        - NEGATIVE SPACE: Fade to solid color towards the opposite edge.
        `;
    } else if (layout === 'Localizada') {
        layoutInstruction = `
        LAYOUT: PLACEMENT PRINT (LOCALIZADA).
        - COMPOSITION: Single central element centered in ${width}x${height}cm.
        - BACKGROUND: Clean or subtle texture.
        `;
    } else {
        // Corrida (Default)
        layoutInstruction = `
        LAYOUT: SEAMLESS REPEAT (ALL-OVER).
        - REPETITION: Design must be a perfect tile capable of covering ${width}x${height}cm via infinite repetition.
        - EDGES: Match left-right and top-bottom perfectly.
        `;
    }

    // AJUSTE DE QUALIDADE BASEADO EM DPI (PRO MODE)
    // Se o DPI for alto (>=150), forçamos um estilo vetorizado/limpo que permita Upscaling sem perda (SVG-like).
    let qualityPrompt = "Style: Vector illustration style, flat lighting, high definition.";
    if (dpi >= 300) {
        qualityPrompt = "Style: ULTRA-HIGH DEFINITION, 8K, Vector Art, Sharp Edges, No Noise, Professional Print Quality. Optimized for upscaling.";
    } else if (dpi >= 150) {
        qualityPrompt = "Style: High definition textile print, clear lines, standard print quality.";
    }

    // Prompt Otimizado para evitar Safety Blocks e erros de formato
    const finalPrompt = `
    Create a professional textile pattern design file.
    Subject: ${prompt}.
    Colors: ${colorList}.
    
    Technical Specs:
    ${layoutInstruction}
    
    Quality Standards (Auto-Restoration):
    - ${styleGuide}
    - ${qualityPrompt}
    - Output: A single high-quality texture tile.
    `;

    try {
        // PAYLOAD BLINDADO (Minimalista para evitar rejeição)
        const payload = {
            contents: [{ 
                parts: [
                    { text: finalPrompt }
                ] 
            }],
            generationConfig: {
                imageConfig: {
                    aspectRatio: "1:1" // Único parâmetro mandatório e estável
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
            
            if (response.status === 400 || response.status === 403) {
                throw new Error("Acesso negado ao modelo de imagem. Verifique API Key.");
            }
            throw new Error(`Erro Atelier (${response.status}): O servidor rejeitou a solicitação.`);
        }

        const data = await response.json();
        
        // Verificação de Segurança (Safety Filter)
        const candidate = data.candidates?.[0];
        if (candidate?.finishReason === 'SAFETY') {
            throw new Error("A IA bloqueou a geração por segurança (Safety Filter). Tente simplificar o prompt ou remover termos sensíveis.");
        }
        if (candidate?.finishReason === 'RECITATION') {
            throw new Error("Bloqueio de Copyright. O prompt solicitou algo muito similar a uma marca protegida.");
        }

        // 3. Extração da Imagem
        const parts = candidate?.content?.parts;
        const imagePart = parts?.find(p => p.inlineData);
        
        if (imagePart) {
             return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        } 
        
        console.error("Payload recebido sem imagem:", JSON.stringify(data));
        throw new Error("A IA processou o pedido mas não retornou a imagem. Tente novamente em instantes.");

    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
