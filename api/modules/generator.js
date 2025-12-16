
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
    
    // 1. PALETTE DEFINITION (Solid Flat Colors)
    const colorString = (colors || []).map(c => `${c.name} (${c.hex})`).join(', ');
    const paletteInstruction = colorString 
        ? `TECHNICAL COLOR PALETTE: Strictly use colors: ${colorString}. Flat Solid Colors, no gradients, ready for screen separation.`
        : `TECHNICAL COLOR PALETTE: Harmonious, flat and contrasting colors suitable for commercial collection.`;

    // 2. INDUSTRIAL MASTER PROMPT (ENGLISH)
    const MASTER_PROMPT = `
    ACT AS: Senior Textile Designer (Industrial Print Specialist).
    OBJECTIVE: Generate a high-resolution final textile pattern swatch file.
    
    --- PATTERN DEFINITION ---
    MAIN MOTIF: ${prompt}
    STRUCTURE: Textile engineered ${layout === 'Barrada' ? 'BORDER PRINT (Barrado)' : 'ALL-OVER REPEAT (Corrido)'} pattern with seamless continuity and regular technical repeat. ${repeat === 'Half-Drop' ? 'Half-drop repeat.' : 'Straight repeat.'}
    
    --- VISUAL REFINEMENT GUIDELINES (MUST FOLLOW) ---
    1. LINE WORK: Develop in a clean vector-like language with crisp, well-defined outlines.
    2. STYLE: Stylized and planar elements (Flat Design).
    3. FINISH: Eliminate noise and painterly textures. Filling must be predominantly solid/flat.
    4. DETAIL: Subtle and controlled line weight variation, simulating refined technical hand-drawing.
    5. COMPOSITION: Rhythmic and balanced distribution, ensuring continuous reading.
    
    --- SECURITY & TECHNICAL RULES (NEGATIVE CONSTRAINTS) ---
    - DO NOT generate people, bodies, models, or mannequins.
    - DO NOT generate photographic or realistic 3D rendering.
    - DO NOT use blurry watercolor effects or grain.
    - DO NOT include watermarks or text.
    
    --- OUTPUT SPECIFICATIONS ---
    ${paletteInstruction}
    VIEW: TOP-DOWN FLAT 2D SWATCH.
    FILE TYPE: Industrial production ready.
    `;

    try {
        return await callGeminiImage(apiKey, MASTER_PROMPT);
    } catch (e) {
        const errString = e.message || e.toString();
        
        // Fallback técnico em Inglês
        if (errString.includes("SAFETY_BLOCK")) {
            console.warn("Engaging Technical Fallback (English)...");
            const FALLBACK_PROMPT = `
            Technical Textile Pattern.
            Subject: Abstract geometric composition based on: ${prompt.substring(0, 30)}.
            Style: Flat Vector, Solid Colors, Minimalist.
            View: 2D Swatch.
            `;
            return await callGeminiImage(apiKey, FALLBACK_PROMPT);
        }
        throw e;
    }
};
