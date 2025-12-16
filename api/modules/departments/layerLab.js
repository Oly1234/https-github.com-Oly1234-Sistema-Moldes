
// api/modules/departments/layerLab.js
// DEPARTAMENTO: LAYER LAB (Estúdio de Decomposição & Reconstrução)
// Responsabilidade: Manipulação avançada de pixels e semântica via IA.

const generateImage = async (apiKey, prompt) => {
    // USO CORRETO: gemini-2.5-flash-image
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
    
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        // NENHUMA config de 'imageSize' ou 'sampleCount' permitida aqui.
        generationConfig: {}
    };

    try {
        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });

        if (!response.ok) {
            console.error(`LayerLab API Error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts;
        const imagePart = candidate?.find(p => p.inline_data);
        
        if (imagePart) return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        
        // Log se houver recusa textual
        const textPart = candidate?.find(p => p.text);
        if (textPart) console.warn("LayerLab Refusal:", textPart.text);
        
        return null;
    } catch (e) {
        console.error("LayerLab Gen Error:", e);
        return null;
    }
};

// 1. RECONSTRUÇÃO DE ELEMENTO (SEMANTIC WHOLE OBJECT)
export const reconstructElement = async (apiKey, cropBase64, originalPrompt) => {
    // Passo 1: Análise do Fragmento (Usa Flash Text)
    const descEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const descPayload = {
        contents: [{ parts: [
            { text: "Analyze this image fragment. Identify the WHOLE object it belongs to (e.g. flower from a petal). Return JSON: { wholeObject: string, style: string }" },
            { inline_data: { mime_type: "image/png", data: cropBase64 } }
        ] }],
        generation_config: { response_mime_type: "application/json" }
    };
    
    let analysis = { wholeObject: "abstract shape", style: "vector flat style" };
    try {
        const descRes = await fetch(descEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(descPayload) });
        const descData = await descRes.json();
        const descText = descData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (descText) {
             const clean = descText.replace(/```json/g, '').replace(/```/g, '');
             const first = clean.indexOf('{'); const last = clean.lastIndexOf('}');
             if (first !== -1 && last !== -1) {
                const parsed = JSON.parse(clean.substring(first, last+1));
                if (parsed.wholeObject) analysis = parsed;
             }
        }
    } catch (e) {
        console.error("Analysis failed, using fallback");
    }

    // Passo 2: Gerar o Objeto INTEIRO (Usa Flash Image com Prompt Estruturado)
    const reconstructionPrompt = `
    Generate a vector illustration.
    Subject: ${analysis.wholeObject}.
    Style: ${analysis.style}, isolated on WHITE background, Flat 2D, No shadows.
    `;

    const newImage = await generateImage(apiKey, reconstructionPrompt);
    
    if (!newImage) throw new Error("Falha na reconstrução do elemento.");

    return { 
        src: newImage, 
        name: analysis.wholeObject || "Elemento Reconstruído"
    };
};

// 2. TRANSFORMAÇÃO MÁGICA
export const transformElement = async (apiKey, cropBase64, userPrompt) => {
    const transformPrompt = `
    Generate a vector illustration.
    Subject: ${userPrompt}.
    Style: Flat textile print motif, isolated on WHITE background, No photorealism.
    `;
    
    const newImage = await generateImage(apiKey, transformPrompt);
    if (!newImage) throw new Error("Falha na transformação do elemento.");

    return { src: newImage };
};

// 3. DECOMPOSIÇÃO GLOBAL (Legacy)
export const decomposePattern = async (apiKey, originalImageBase64) => {
    return { backgroundLayer: null, elements: [] };
};
