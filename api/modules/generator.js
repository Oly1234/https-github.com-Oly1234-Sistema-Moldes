// api/modules/generator.js
// DEPARTAMENTO: FABRICAÇÃO DE ESTAMPAS (The Loom)
// TECNOLOGIA: SafeTexture Gen v6.0 (Architecture: Texture-First)

const callGeminiImage = async (apiKey, prompt) => {
    // USAMOS O MODELO DE IMAGEM MAIS ESTÁVEL
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    // SAFETY: Configuramos para bloquear apenas conteúdo extremamente nocivo.
    // O segredo está no prompt, não apenas aqui.
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
        ],
        generationConfig: {
            temperature: 0.3, // Menor temperatura = Menos alucinação
            topK: 32,
            topP: 0.95,
            candidateCount: 1
        }
    };

    const response = await fetch(endpointImg, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
    });
    
    if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    
    // Tratamento específico para BLOQUEIO DE SEGURANÇA
    if (data.promptFeedback?.blockReason) {
         console.warn("Bloqueio de Segurança Detectado:", data.promptFeedback);
         throw new Error("SAFETY_BLOCK");
    }

    const candidate = data.candidates?.[0]?.content?.parts;
    if (!candidate) throw new Error("NO_CONTENT");

    const imagePart = candidate.find(p => p.inline_data);
    if (imagePart) {
        return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
    }
    
    // Se a IA recusou gerando texto (ex: "I cannot generate...")
    const textPart = candidate.find(p => p.text);
    if (textPart) {
        console.warn("Recusa Textual da IA:", textPart.text);
        throw new Error("SAFETY_REFUSAL"); 
    }
    
    throw new Error("GENERIC_FAIL");
};

// LIMPEZA DE VOCABULÁRIO PERIGOSO
const sanitizePromptInternal = (text) => {
    if (!text) return "Abstract geometric pattern";
    return text
        .replace(/\b(nude|skin|body|flesh|sexy|bikini|underwear|lingerie|human|woman|man|girl|boy|face|model)\b/gi, "organic form")
        .replace(/\b(blood|gore|violent)\b/gi, "red vivid")
        .replace(/\b(dress|shirt|skirt|pants)\b/gi, "fabric texture"); // Força contexto de tecido, não roupa
};

export const generatePattern = async (apiKey, prompt, colors, textileSpecs) => {
    const { layout = "Corrida", repeat = "Straight" } = textileSpecs || {};
    
    // 1. HIGIENIZAÇÃO DO PROMPT (Crucial para evitar filtros)
    const cleanPrompt = sanitizePromptInternal(prompt);
    
    // 2. CONSTRUÇÃO DA PALETA TÉCNICA
    const colorList = (colors || []).map(c => `${sanitizePromptInternal(c.name)} (${c.hex})`).join(', ');
    const colorInstruction = colorList 
        ? `Palette: ${colorList}. Use flat solid colors.` 
        : `Palette: High contrast professional colors.`;

    // 3. PROMPT MESTRE "TEXTURE-FIRST"
    // Truque: Pedimos "Wallpaper" ou "Texture Swatch" para evitar que a IA desenhe pessoas.
    const MASTER_PROMPT = `
    Create a high-quality seamless texture file.
    VISUAL SUBJECT: ${cleanPrompt}
    
    TECHNICAL SPECS:
    - View: Top-down flat texture swatch (2D).
    - Layout: ${layout === 'Barrada' ? 'Border arrangement' : 'Seamless repeat pattern'}.
    - Style: Vector art, clear lines, commercial print quality.
    - ${colorInstruction}
    
    NEGATIVE CONSTRAINTS (STRICT):
    - NO human figures, NO body parts, NO realistic photos, NO shadows, NO garments.
    - Just the raw artwork pattern.
    `;

    try {
        return await callGeminiImage(apiKey, MASTER_PROMPT);
    } catch (e) {
        console.warn("Tentativa Principal Falhou:", e.message);
        
        // 4. FALLBACK DE EMERGÊNCIA (O "Plano B" Garantido)
        // Se a IA bloquear por segurança ou erro, geramos algo 100% seguro (Geométrico) com as cores do usuário.
        
        const SAFE_FALLBACK_PROMPT = `
        Abstract geometric Bauhaus texture.
        Style: Minimalist vector art, clean shapes.
        ${colorInstruction}
        View: Flat 2D swatch.
        `;
        
        try {
            console.log("Ativando Protocolo de Fallback...");
            return await callGeminiImage(apiKey, SAFE_FALLBACK_PROMPT);
        } catch (fallbackError) {
            throw new Error("O sistema de segurança da IA bloqueou esta solicitação. Tente usar termos mais abstratos (ex: 'Floral' em vez de 'Estampa de Biquíni').");
        }
    }
};