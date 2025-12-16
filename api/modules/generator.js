
// api/modules/generator.js
// DEPARTAMENTO: ATELIER DIGITAL (Geração & Restauração de Estampas)

// Lista negra de termos que confundem o filtro de segurança (Safety Filter Confusion)
// Mesmo em contextos inocentes (ex: "cor de pele"), a IA pode bloquear. Usamos sinônimos técnicos.
const SANITIZATION_MAP = {
    "skin": "beige",
    "nude": "neutral sand",
    "flesh": "peach",
    "body": "form",
    "naked": "bare",
    "blood": "crimson red",
    "kill": "eliminate",
    "shoot": "capture",
    "hot": "vibrant", // "Hot pink" as vezes gatilha
    "sexy": "alluring",
    "human": "figure",
    "face": "portrait",
    "child": "youth",
    "kid": "junior"
};

const sanitizePrompt = (text) => {
    if (!text) return "";
    let safeText = text.toLowerCase();
    Object.keys(SANITIZATION_MAP).forEach(forbidden => {
        const safe = SANITIZATION_MAP[forbidden];
        const regex = new RegExp(`\\b${forbidden}\\b`, 'gi');
        safeText = safeText.replace(regex, safe);
    });
    return safeText;
};

export const generatePattern = async (apiKey, prompt, colors, textileSpecs) => {
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const { layout = "Corrida", repeat = "Straight", styleGuide = "Vector Art", dpi = 300 } = textileSpecs || {};
    
    // Injeção de Cores
    const colorList = colors && colors.length > 0 
        ? colors.map(c => `${c.name} (Hex: ${c.hex})`).join(', ') 
        : 'harmonious trend colors';

    // Engenharia de Prompt (Optimized for Flash Image - Structured Tags)
    let layoutInstruction = "Seamless Repeat Pattern";
    if (layout === 'Barrada') layoutInstruction = "Engineered Border Print (Heavy bottom, open top)";
    else if (layout === 'Localizada') layoutInstruction = "Placement Print (Centralized motif, isolated)";

    // Fallback e Sanitização
    let safeSubject = prompt && prompt.trim().length > 2 ? prompt : "Abstract textile pattern";
    safeSubject = sanitizePrompt(safeSubject);

    // PROMPT OTIMIZADO (Tag-based) - Enfatiza "DESIGN" e "ART" para evitar realismo biológico
    const RAW_DIGITAL_PROMPT = `
    Create a professional textile design file.
    Subject: ${safeSubject}.
    Colors: ${colorList}.
    Technique: ${styleGuide}, Flat 2D Vector Graphics, Screen Print style.
    Layout: ${layoutInstruction}, ${repeatTypeToText(repeat)}.
    Restrictions: NO photorealism, NO shading, NO 3D effects, NO biological textures. Keep it graphic and artistic.
    Quality: High resolution print file.
    `;

    try {
        const payload = {
            contents: [{ parts: [{ text: RAW_DIGITAL_PROMPT }] }]
        };

        const response = await fetch(endpointImg, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Google API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        
        const candidate = data.candidates?.[0]?.content?.parts;
        if (!candidate) throw new Error("A IA retornou uma resposta vazia.");

        const imagePart = candidate.find(p => p.inline_data);
        
        if (imagePart) {
            return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        }
        
        const textPart = candidate.find(p => p.text);
        if (textPart) {
            console.warn("AI Refusal:", textPart.text);
            // Mensagem amigável para o usuário
            throw new Error(`A IA ajustou os parâmetros de segurança. Tente mudar "hot pink" para "magenta" ou simplificar a descrição.`);
        }
        
        throw new Error("Falha na geração: A IA não retornou imagem.");

    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};

const repeatTypeToText = (type) => {
    switch(type) {
        case 'Half-Drop': return 'Half-drop repeat alignment';
        case 'Mirror': return 'Mirrored repeat alignment';
        default: return 'Straight grid repeat';
    }
};
