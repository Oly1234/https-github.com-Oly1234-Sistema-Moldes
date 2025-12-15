
// api/modules/departments/layerLab.js
// DEPARTAMENTO: LAYER LAB (Estúdio de Decomposição & Reconstrução)
// Responsabilidade: Manipulação avançada de pixels e semântica via IA.

const generateImage = async (apiKey, prompt, inputImageBase64 = null) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
    
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

// 1. RECONSTRUÇÃO DE ELEMENTO (SEMANTIC WHOLE OBJECT)
// O sistema agora assume que o input pode ser apenas "pedaços" de um todo.
export const reconstructElement = async (apiKey, cropBase64, originalPrompt) => {
    // Passo 1: Entender o que são os fragmentos
    const descEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const descPayload = {
        contents: [{ parts: [
            { text: "Analyze this image. It contains FRAGMENTS or PARTS of a specific object (e.g. petals of a flower, wing of a bird). Identify the WHOLE object they belong to. Return JSON: { wholeObject: string, style: string, visualDetails: string }" },
            { inline_data: { mime_type: "image/png", data: cropBase64 } }
        ] }],
        generation_config: { response_mime_type: "application/json" }
    };
    
    let analysis = { wholeObject: "object", style: "vector", visualDetails: "clean" };
    try {
        const descRes = await fetch(descEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(descPayload) });
        const descData = await descRes.json();
        const descText = descData.candidates?.[0]?.content?.parts?.[0]?.text;
        analysis = JSON.parse(descText.replace(/```json/g, '').replace(/```/g, ''));
    } catch (e) {
        console.error("Analysis failed, using generic prompt");
    }

    // Passo 2: Gerar o Objeto INTEIRO
    const reconstructionPrompt = `
    Create a COMPLETE, UNFRAGMENTED vector illustration of a ${analysis.wholeObject}.
    Style: ${analysis.style}, ${analysis.visualDetails}.
    Context: The user selected disjointed parts (e.g. separate petals). You must UNIFY them into a single, cohesive, organic object (e.g. the whole flower).
    Background: SOLID WHITE HEX #FFFFFF.
    View: Flat, 2D, isolated.
    `;

    const newImage = await generateImage(apiKey, reconstructionPrompt);
    return { 
        src: newImage, 
        name: analysis.wholeObject 
    };
};

// 2. TRANSFORMAÇÃO MÁGICA (GEN AI EDIT)
export const transformElement = async (apiKey, cropBase64, userPrompt) => {
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
    return { backgroundLayer: null, elements: [] };
};
