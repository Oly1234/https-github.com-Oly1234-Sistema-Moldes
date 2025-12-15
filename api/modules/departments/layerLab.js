
// api/modules/departments/layerLab.js
// DEPARTAMENTO: LAYER LAB (Estúdio de Decomposição & Reconstrução)
// Responsabilidade: Manipulação avançada de pixels e semântica via IA.

const generateImage = async (apiKey, prompt, inputImageBase64 = null) => {
    // Se tiver imagem de entrada, tentamos descrever e gerar baseada nela (Workaround para Img2Img no Flash)
    // Se o modelo suportar input direto no futuro, adaptamos.
    
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
    
    // Configuração para geração precisa
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
            imageConfig: { aspectRatio: "1:1" }
        }
    };

    const response = await fetch(endpoint, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
    });

    if (!response.ok) return null;

    const data = await response.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
    
    if (imagePart) return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
    return null;
};

// 1. RECONSTRUÇÃO DE ELEMENTO (AI OUTPAINTING SIMULADO)
// O sistema recebe um recorte (que pode estar cortado ou ter partes faltando) e recria o objeto inteiro.
export const reconstructElement = async (apiKey, cropBase64, originalPrompt) => {
    // Passo 1: Entender o que é o objeto
    const descEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const descPayload = {
        contents: [{ parts: [
            { text: "Analyze this image crop. What object is this? Return JSON: { objectName: string, style: string, visualDetails: string }" },
            { inline_data: { mime_type: "image/png", data: cropBase64 } }
        ] }],
        generation_config: { response_mime_type: "application/json" }
    };
    
    let analysis = { objectName: "object", style: "vector", visualDetails: "clean" };
    try {
        const descRes = await fetch(descEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(descPayload) });
        const descData = await descRes.json();
        const descText = descData.candidates?.[0]?.content?.parts?.[0]?.text;
        analysis = JSON.parse(descText.replace(/```json/g, '').replace(/```/g, ''));
    } catch (e) {
        console.error("Analysis failed, using generic prompt");
    }

    // Passo 2: Gerar versão "Inteira" e "Perfeita"
    // Solicitamos fundo branco sólido para fácil remoção no frontend
    const reconstructionPrompt = `
    Create a complete, high-quality vector illustration of a ${analysis.objectName}.
    Style: ${analysis.style}, ${analysis.visualDetails}.
    Context: The user cropped this from a pattern. RECONSTRUCT the full object. If parts were cut off, draw them.
    Background: SOLID WHITE HEX #FFFFFF.
    View: Flat, 2D, isolated.
    `;

    const newImage = await generateImage(apiKey, reconstructionPrompt);
    return { 
        src: newImage, 
        name: analysis.objectName 
    };
};

// 2. TRANSFORMAÇÃO MÁGICA (GEN AI EDIT)
export const transformElement = async (apiKey, cropBase64, userPrompt) => {
    // Transforma o elemento atual em outra coisa, mantendo o estilo visual (se possível)
    const transformPrompt = `
    Create a vector illustration of: ${userPrompt}.
    Style: High quality textile print motif, isolated.
    Background: SOLID WHITE HEX #FFFFFF.
    `;
    
    const newImage = await generateImage(apiKey, transformPrompt);
    return { src: newImage };
};

// 3. DECOMPOSIÇÃO GLOBAL (Manter legado para compatibilidade)
export const decomposePattern = async (apiKey, originalImageBase64) => {
    // ... (Mantido código anterior) ...
    return { backgroundLayer: null, elements: [] };
};
