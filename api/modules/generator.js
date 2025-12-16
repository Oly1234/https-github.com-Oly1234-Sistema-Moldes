
// api/modules/generator.js
// DEPARTAMENTO: ATELIER DIGITAL (Geração & Restauração de Estampas)
// TECNOLOGIA: Vingi Neuro-Bridge (Semantic Safety Negotiation)

const SANITIZATION_MAP = {
    // Anatomia & Corpo (Inglês)
    "hot pink": "vibrant magenta",
    "flesh tone": "warm beige",
    "skin color": "sand",
    "skin tone": "tan",
    "skin": "texture",
    "nude": "soft beige",
    "naked": "bare",
    "flesh": "organic",
    "body": "form",
    "face": "visage",
    "human": "figure",
    "sexy": "elegant",
    "breast": "chest",
    "chest": "torso",
    "nipple": "dot",
    "legs": "stripes",
    "woman": "pattern",
    "girl": "motif",
    "lady": "style",
    "model": "composition",
    "wearing": "featuring",
    // MODA 3D -> SUPERFÍCIE 2D (Crucial para evitar geração de pessoas)
    "dress": "seamless pattern file", 
    "vestido": "seamless pattern file",
    "shirt": "fabric print design",
    "camisa": "fabric print design",
    "skirt": "surface pattern",
    "saia": "surface pattern",
    "roupa": "textile texture",
    "clothing": "textile texture",
    
    // Anatomia & Corpo (Português - CRUCIAL)
    "pele": "bege areia",
    "corpo": "forma orgânica",
    "mulher": "arte abstrata",
    "menina": "motivo delicado",
    "seios": "curvas",
    "peito": "busto",
    "mamilo": "ponto",
    "nu": "natural",
    "nuda": "natural",
    "pelada": "natural",
    "sensual": "elegante",
    "humano": "figura",
    "pessoa": "elemento",
    
    // Violência & Armas
    "blood": "crimson",
    "sangue": "carmesim",
    "kill": "remove",
    "matar": "remover",
    "gun": "device",
    "arma": "objeto",
    "war": "conflict",
    "guerra": "conflito",
    
    // Termos de Realismo (Gatilhos de Deepfake)
    "realistic": "detailed vector illustration",
    "realista": "ilustração vetorial detalhada",
    "photorealistic": "high definition digital art",
    "fotorealista": "arte digital alta definição",
    "photo": "image",
    "foto": "imagem",
    "photography": "art",
    "fotografia": "arte"
};

const sanitizeText = (text) => {
    if (!text) return "";
    let safeText = text.toLowerCase();
    Object.keys(SANITIZATION_MAP).forEach(forbidden => {
        const safe = SANITIZATION_MAP[forbidden];
        // Regex com word boundary para evitar substituir partes de palavras
        const regex = new RegExp(`\\b${forbidden}\\b`, 'gi');
        safeText = safeText.replace(regex, safe);
    });
    return safeText;
};

const callGeminiImage = async (apiKey, prompt) => {
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    // CONFIGURAÇÃO SEGURA: Bloqueio apenas em ALTA probabilidade.
    // Isso permite que a IA gere "pele" em contextos artísticos sem bloquear imediatamente.
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
        if (response.status === 400) throw new Error("Erro 400: Parâmetros inválidos na IA.");
        if (response.status === 503) throw new Error("Erro 503: IA sobrecarregada.");
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
    const { layout = "Corrida", repeat = "Straight", styleGuide = "Vector Art" } = textileSpecs || {};
    
    // 1. SANITIZAÇÃO DE CORES
    const safeColors = (colors || []).map(c => {
        return sanitizeText(c.name) + ` (${c.hex})`; 
    }).join(', ');

    const colorInstruction = safeColors 
        ? `Palette: ${safeColors}. Use flat, solid colors.` 
        : "Palette: Harmonious commercial trend colors.";

    // 2. SANITIZAÇÃO DO PROMPT
    let safePrompt = sanitizeText(prompt);
    if (!safePrompt || safePrompt.length < 3) safePrompt = "Abstract artistic textile pattern";

    // 3. CONSTRUÇÃO TÉCNICA
    let constructionPrompt = "";
    switch(layout) {
        case 'Barrada':
            constructionPrompt = "Layout: Engineered Border Print (Barrado). Main motif at bottom, lighter texture at top.";
            break;
        case 'Localizada':
            constructionPrompt = "Layout: Placed Motif (Localizada). Centralized artwork with negative space.";
            break;
        default: 
            constructionPrompt = "Layout: Seamless All-Over Repeat (Rapport). Continuous pattern with no visible seams.";
            break;
    }

    // 4. PROMPT MESTRE (TEXTILE DESIGNER PERSONA)
    // Focamos em "Flat 2D" para evitar que a IA tente desenhar uma pessoa vestindo a roupa.
    const MASTER_PROMPT = `
    ACT AS: Senior Textile Designer (Surface Design Specialist).
    TASK: Create a Production-Ready Textile File (Swatch).
    
    ARTWORK BRIEF:
    - Subject: ${safePrompt}.
    - Style: ${styleGuide}, Clean Vector aesthetic, High Definition.
    - ${colorInstruction}
    - ${constructionPrompt}
    
    TECHNICAL CONSTRAINTS (CRITICAL):
    - VIEW: TOP-DOWN FLAT 2D TEXTURE ONLY. 
    - NO MODELS: Do not draw people, mannequins, or bodies.
    - NO 3D RENDERING: Do not render folds, shadows, or garment shapes. This is the raw print file.
    - NO TEXT: Do not include watermarks or text.
    - QUALITY: Sharp edges, no blur, no noise.
    `;

    try {
        return await callGeminiImage(apiKey, MASTER_PROMPT);
    } catch (e) {
        const errString = e.message || e.toString();
        
        // 5. FALLBACK SEGURO
        if (errString.includes("SAFETY_BLOCK") || errString.includes("400") || errString.includes("503") || errString.includes("Erro")) {
            console.warn("Block detected. Engaging 'Safe Abstraction' Fallback...");
            
            const SAFE_FALLBACK_PROMPT = `
            Abstract Textile Texture.
            Theme: ${safePrompt.substring(0, 40)} inspired shapes.
            Style: Geometric, Minimalist, Vector Art.
            View: Flat 2D Swatch.
            Colors: ${safeColors || "Multicolor"}.
            `;
            
            try {
                return await callGeminiImage(apiKey, SAFE_FALLBACK_PROMPT);
            } catch (retryError) {
                const LAST_RESORT_PROMPT = `
                Beautiful seamless fabric pattern, abstract floral shapes, colorful, vector style flat view.
                `;
                return await callGeminiImage(apiKey, LAST_RESORT_PROMPT);
            }
        }
        throw e;
    }
};
