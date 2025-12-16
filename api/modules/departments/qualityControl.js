
// api/modules/departments/qualityControl.js
// DEPARTAMENTO: CONTROLE DE QUALIDADE & REFINAMENTO (The Polisher)
// Responsabilidade: Transformar rascunhos em arquivos prontos para estamparia (Upscaling & Denoising via img2img).

export const enhancePatternQuality = async (apiKey, imageBase64, contextPrompt) => {
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const TECH_PROMPT = `
    ACT AS: Senior Textile Pre-Press Technician.
    TASK: Vectorize and Refine this textile pattern swatch.
    
    STRICT PROCESSING RULES:
    1. INPUT IS ARTWORK: This image is a design file, NOT a photo of a person. Treat all colors (even beige/pink) as ink/paint.
    2. VECTORIZE: Sharpen edges, remove JPEG artifacts, remove noise/grain.
    3. FLATTEN: Remove 3D shading. Make it look like a screen print (Flat Color).
    4. PRESERVE: Keep the exact motif shapes. Do not hallucinate new objects.
    
    CONTEXT: ${contextPrompt || "Textile pattern design"}
    
    OUTPUT: High-resolution 2D flat textile file.
    `;

    // CRITICAL: Adicionar Safety Settings aqui também, pois o Image-to-Image é rigoroso com "pele".
    const payload = {
        contents: [{ 
            parts: [
                { text: TECH_PROMPT },
                { inline_data: { mime_type: "image/png", data: imageBase64 } }
            ] 
        }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
        ]
    };

    try {
        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });

        if (!response.ok) {
            const errText = await response.text();
            console.warn("Quality Control Glitch:", errText);
            // Se falhar o refinamento, retornamos erro mas o frontend pode manter a imagem original
            throw new Error("Refinamento indisponível. A imagem original foi mantida.");
        }

        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts;
        
        // Verifica bloqueio de segurança na resposta
        if (data.promptFeedback?.blockReason) {
            throw new Error("SAFETY_BLOCK_QC");
        }

        const imagePart = candidate?.find(p => p.inline_data);

        if (imagePart) {
            return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        }
        
        throw new Error("O refinamento não gerou uma imagem válida.");

    } catch (e) {
        console.error("QC Department Error:", e);
        throw e;
    }
};
