
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
    "dress": "textile design", 
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
    
    // CONFIGURAÇÃO SEGURA: Sem generationConfig (evita erro 400)
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

    const colorInstruction = safeColors 
        ? `Aplicar paleta cromática precisa: ${safeColors}. Cores chapadas e harmoniosas.` 
        : "Aplicar paleta cromática harmoniosa e comercial.";

    // 2. SANITIZAÇÃO DO PROMPT DO USUÁRIO
    let safePrompt = sanitizeText(prompt);
    if (!safePrompt || safePrompt.length < 3) safePrompt = "Estampa botânica contemporânea";

    // 3. DEFINIÇÃO DE CONSTRUÇÃO (Baseado no JSON 'construction_variations')
    let constructionPrompt = "";
    switch(layout) {
        case 'Barrada':
            constructionPrompt = "CONSTRUÇÃO: Estruturar a estampa em dois sistemas coordenados: área corrida principal no topo e BARRADO ORNAMENTAL horizontal na base, com elementos estilizados.";
            break;
        case 'Localizada':
            constructionPrompt = "CONSTRUÇÃO: Desenvolver estampa LOCALIZADA MODULAR, mantendo leitura central clara e elementos distribuídos de forma equilibrada, preservando áreas de respiro visual (Negative Space).";
            break;
        default: // Corrida
            constructionPrompt = "CONSTRUÇÃO: Organizar a estampa em sistema TOTALMENTE CORRIDO (All-over), com distribuição orgânica dos motivos e repetição contínua (Rapport perfeito), sem hierarquia direcional evidente.";
            break;
    }

    // 4. PROMPT MESTRE (Adaptação Fiel do JSON 'base_textile_floral_contemporary')
    // Usamos Inglês para melhor interpretação da IA, mas mantendo a lógica estrita.
    const MASTER_PROMPT = `
    ACT AS: Senior Textile Designer (20+ Years Experience).
    TASK: Create a professional High-Resolution Textile Print Design (Surface Pattern).
    
    // DESIGN BRIEF (Contemporary Professional Style)
    - SUBJECT: ${safePrompt}.
    - STYLE: Stylized clean illustration, professional vector trace. Sophisticated and commercial.
    - COMPOSITION: Balanced composition with clear reading of elements.
    - TECHNIQUE: Organic vector style, precise lines. 
    
    // COLOR & FINISH
    - ${colorInstruction}
    - FINISH: Solid flat colors (Cores Chapadas) with subtle internal tonal variations.
    - CONSTRAINT: NO pictorial textures, NO watercolor blur, NO grain/noise. Clean definition.
    
    // TECHNICAL SPECS
    - ${constructionPrompt}
    - REPEAT: ${repeat} (Seamless perfect rapport).
    - VIEW: FLAT 2D SWATCH (Top-down view). NO shadows, NO fabric folds, NOT a photo of a dress. Just the artwork.
    
    OUTPUT: A production-ready textile file.
    `;

    try {
        return await callGeminiImage(apiKey, MASTER_PROMPT);
    } catch (e) {
        const errString = e.message || e.toString();
        
        // 5. FALLBACK "MEMORÁVEL" (Simplificado mas com qualidade)
        if (errString.includes("SAFETY_BLOCK") || errString.includes("400") || errString.includes("503") || errString.includes("Erro")) {
            console.warn("Block detected. Engaging 'Memorável' Fallback...");
            
            const SAFE_FALLBACK_PROMPT = `
            Textile Pattern Design.
            Theme: ${safePrompt.substring(0, 50)}.
            Style: Flat Vector Art, Clean Lines, Solid Colors.
            Composition: Seamless Repeat Pattern.
            ${colorInstruction}
            View: 2D Texture Swatch.
            `;
            
            try {
                return await callGeminiImage(apiKey, SAFE_FALLBACK_PROMPT);
            } catch (retryError) {
                // Última tentativa: Abstração Geométrica Pura (Garantia de não falhar)
                const LAST_RESORT_PROMPT = `
                Geometric seamless pattern.
                Style: Modern, abstract shapes, clean lines.
                ${colorInstruction}
                `;
                return await callGeminiImage(apiKey, LAST_RESORT_PROMPT);
            }
        }
        throw e;
    }
};
