
// api/modules/generator.js
// DEPARTAMENTO: FABRICAÇÃO DE ESTAMPAS (The Loom)
// TECNOLOGIA: Master Textile Prompt v2.0 (Industrial Standard - English)

const callGeminiImage = async (apiKey, prompt) => {
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    // SAFETY: Relaxada para permitir cores de pele em contexto vetorial/botânico.
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
        ]
    };

    const response = await fetch(endpointImg, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
    });
    
    if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini API Error:", errText);
        throw new Error(`Erro na API (${response.status})`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts;
    
    if (!candidate) throw new Error("A IA não retornou conteúdo.");

    const imagePart = candidate.find(p => p.inline_data);
    if (imagePart) {
        return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
    }
    
    const textPart = candidate.find(p => p.text);
    if (textPart) {
        console.warn("Gemini Refusal:", textPart.text);
        throw new Error("SAFETY_BLOCK"); 
    }
    
    throw new Error("Nenhuma imagem gerada.");
};

export const generatePattern = async (apiKey, prompt, colors, textileSpecs) => {
    const { layout = "Corrida", repeat = "Straight" } = textileSpecs || {};
    
    // 1. PALETTE DEFINITION
    const colorString = (colors || []).map(c => `${c.name} (${c.hex})`).join(', ');
    const paletteInstruction = colorString 
        ? `COLOR PALETTE: Use exactly: ${colorString}. Flat Solid Colors.`
        : `COLOR PALETTE: Harmonious, high-contrast flat colors.`;

    // 2. INDUSTRIAL MASTER PROMPT (ENGLISH)
    // FORCE "SURFACE DESIGN" CONTEXT, NOT "FASHION DESIGN"
    const MASTER_PROMPT = `
    TASK: Generate a 2D TEXTILE PATTERN SWATCH (Digital File).
    TYPE: Surface Design / Vector Illustration.
    
    --- DESCRIPTION ---
    ${prompt}
    
    --- TECHNICAL SPECS ---
    STRUCTURE: ${layout === 'Barrada' ? 'Engineered Border Print' : 'Seamless All-over Pattern'}.
    STYLE: Flat Vector Art, Clean Lines, 2D Planar view.
    VIEW: Top-down, 90 degrees. NO perspective, NO folds.
    
    --- NEGATIVE CONSTRAINTS (STRICT) ---
    - NO PEOPLE, NO MODELS, NO BODY PARTS, NO MANNEQUINS.
    - NO CLOTHING ITEMS (Do not draw a dress, draw the PRINT on a square canvas).
    - NO PHOTOREALISM (Do not look like a photo of fabric, look like the digital file).
    - NO BLUR, NO NOISE.
    
    ${paletteInstruction}
    `;

    try {
        return await callGeminiImage(apiKey, MASTER_PROMPT);
    } catch (e) {
        const errString = e.message || e.toString();
        
        // Fallback técnico em Inglês
        if (errString.includes("SAFETY_BLOCK")) {
            console.warn("Engaging Technical Fallback (English)...");
            const FALLBACK_PROMPT = `
            Abstract geometric textile pattern swatch.
            Style: Flat Vector, Solid Colors, Minimalist.
            Colors: ${colorString || 'Neutral'}.
            View: 2D Top-down.
            `;
            return await callGeminiImage(apiKey, FALLBACK_PROMPT);
        }
        throw e;
    }
};
