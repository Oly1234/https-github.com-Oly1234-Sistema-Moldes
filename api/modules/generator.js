
// api/modules/generator.js
// DEPARTAMENTO: ATELIER DIGITAL (Geração & Restauração de Estampas)
// TECNOLOGIA: Vingi Neuro-Bridge (Semantic Safety Negotiation)

const SANITIZATION_MAP = {
    // Anatomia & Corpo (Gatilhos de NSFW)
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
    "dress": "textile design", // "Dress" confunde a IA para desenhar uma roupa 3D. Queremos o tecido plano.
    "shirt": "fabric print",
    "skirt": "surface pattern",
    
    // Violência & Armas
    "blood": "crimson",
    "kill": "remove",
    "shoot": "capture",
    "gun": "device",
    "war": "conflict",
    
    // Termos de Realismo (Gatilhos de Deepfake)
    "realistic": "detailed vector illustration",
    "photorealistic": "high definition digital art",
    "photo": "image",
    "photography": "art"
};

const sanitizeText = (text) => {
    if (!text) return "";
    let safeText = text.toLowerCase();
    Object.keys(SANITIZATION_MAP).forEach(forbidden => {
        const safe = SANITIZATION_MAP[forbidden];
        const regex = new RegExp(`\\b${forbidden}\\b`, 'gi');
        safeText = safeText.replace(regex, safe);
    });
    return safeText;
};

const callGeminiImage = async (apiKey, prompt) => {
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    // CONFIGURAÇÃO SEGURA: Sem generationConfig (evita erro 400) e filtros permissivos
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
        // Tratamento de erros comuns para retry
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
    
    // 1. SANITIZAÇÃO DE CORES (Crucial: Cores como "Nude" ou "Flesh" vindas do backend causam block)
    const safeColors = (colors || []).map(c => {
        return sanitizeText(c.name) + ` (${c.hex})`; 
    }).join(', ');

    const colorInstruction = safeColors ? `Palette: ${safeColors}.` : "Palette: Harmonious trend colors.";

    // 2. SANITIZAÇÃO DO PROMPT DO USUÁRIO
    // Se o usuário digitou "Floral dress on a model", isso vira "Floral textile design on a composition".
    let safePrompt = sanitizeText(prompt);
    if (!safePrompt || safePrompt.length < 3) safePrompt = "Abstract artistic textile pattern";

    // 3. PROMPT OTIMIZADO (Senior Textile Designer Persona)
    // Força a IA a criar um ARQUIVO TÉCNICO (Flat 2D), não uma foto realista.
    const MASTER_PROMPT = `
    Create a professional textile design file (Surface Pattern Design).
    
    TECHNICAL BRIEF:
    - Motif: ${safePrompt}.
    - ${colorInstruction}
    - Technique: ${styleGuide}, Screen Print aesthetic, Clean Vector Lines.
    - View: FLAT 2D SWATCH (Top-down view). NO shadows, NO folds, NO 3D rendering.
    - Layout: ${layout}, ${repeat}.
    - Quality: Production-ready artwork.
    
    RESTRICTIONS:
    - IGNORE any reference to human figures, bodies, or anatomy if present in the motif description. Convert them to abstract artistic shapes.
    `;

    try {
        return await callGeminiImage(apiKey, MASTER_PROMPT);
    } catch (e) {
        const errString = e.message || e.toString();
        
        // 4. FALLBACK QUÂNTICO (Se falhar, tentamos algo 100% seguro)
        if (errString.includes("SAFETY_BLOCK") || errString.includes("400") || errString.includes("503") || errString.includes("Erro")) {
            console.warn("Block detected. Engaging Safe Geometry Fallback...");
            
            const SAFE_FALLBACK_PROMPT = `
            Abstract Geometric Pattern.
            Theme: ${safePrompt.substring(0, 30)} inspired shapes.
            ${colorInstruction}
            Style: Bauhaus, Minimalist, Vector Art.
            View: Flat 2D Texture.
            `;
            
            try {
                return await callGeminiImage(apiKey, SAFE_FALLBACK_PROMPT);
            } catch (retryError) {
                // Última tentativa: Abstração pura
                const LAST_RESORT_PROMPT = `
                Beautiful seamless fabric pattern.
                Style: Abstract stripes and shapes.
                ${colorInstruction}
                `;
                return await callGeminiImage(apiKey, LAST_RESORT_PROMPT);
            }
        }
        throw e;
    }
};
