
// api/modules/departments/layerLab.js
// DEPARTAMENTO: LAYER LAB (Estúdio de Decomposição)
// Responsabilidade: Simular decomposição de imagem usando técnicas generativas.

const generateImage = async (apiKey, prompt) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { imageConfig: { aspectRatio: "1:1" } }
    };

    const response = await fetch(endpoint, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
    });

    const data = await response.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
    if (imagePart) return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
    return null;
};

// SIMULAÇÃO DE DECOMPOSIÇÃO:
// Como não temos um modelo de segmentação real (SAM) rodando, usamos a IA para:
// 1. Recriar o FUNDO sem os objetos (Inpainting Genérico).
// 2. Recriar os OBJETOS isolados em fundo branco (para remoção de cor no front).
export const decomposePattern = async (apiKey, originalImageBase64) => {
    // 1. Análise Visual para entender o que é fundo e o que é elemento
    // (Poderíamos chamar o Forense aqui, mas vamos embutir na call de imagem para economizar tempo)
    
    // PROMPT PARA O FUNDO (BACKGROUND)
    // Pedimos para a IA olhar a imagem (se suportado pelo modelo de imagem 2.5, senão usamos text-to-image com descrição)
    // NOTA: O modelo 2.5-flash-image atualmente é Text-to-Image. Image-to-Image requer endpoints específicos ou workaround.
    // WORKAROUND: Vamos pedir primeiro uma descrição textual da imagem original, depois gerar os assets baseados nela.
    
    // Passo 1: Descrever a imagem original
    const descEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const descPayload = {
        contents: [{ parts: [
            { text: "Describe this pattern in detail. 1. What is the background texture/color? 2. What are the main motifs (objects)? Return JSON: { backgroundDesc: string, motifsDesc: string }" },
            { inline_data: { mime_type: "image/jpeg", data: originalImageBase64 } }
        ] }],
        generation_config: { response_mime_type: "application/json" }
    };
    
    const descRes = await fetch(descEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(descPayload) });
    const descData = await descRes.json();
    const descText = descData.candidates?.[0]?.content?.parts?.[0]?.text;
    const analysis = JSON.parse(descText.replace(/```json/g, '').replace(/```/g, ''));

    // Passo 2: Gerar Fundo Limpo
    const bgPrompt = `Texture design. ${analysis.backgroundDesc}. Seamless pattern background only. NO ${analysis.motifsDesc}. Empty space. Flat texture.`;
    const bgImage = await generateImage(apiKey, bgPrompt);

    // Passo 3: Gerar Motivo Principal Isolado
    // "White background" ajuda o frontend a remover o fundo
    const elPrompt = `Vector illustration of ${analysis.motifsDesc}. Isolated on solid white background. High contrast. Flat style matching the description.`;
    const elImage = await generateImage(apiKey, elPrompt);

    return {
        backgroundLayer: bgImage,
        elements: elImage ? [{ name: analysis.motifsDesc, src: elImage }] : []
    };
};

export const generateElement = async (apiKey, prompt) => {
    // Gera um novo elemento solicitado pelo usuário (Magic Edit)
    const finalPrompt = `Vector illustration of ${prompt}. Isolated on solid white background. High contrast. Professional textile design element.`;
    return await generateImage(apiKey, finalPrompt);
};
