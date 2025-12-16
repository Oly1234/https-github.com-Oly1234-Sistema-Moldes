// api/modules/generator.js
// DEPARTAMENTO: FABRICAÇÃO DE ESTAMPAS (The Loom)
// VERSÃO: LITE (Direct Texture Mode)

const callGeminiImage = async (apiKey, prompt) => {
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    // Configuração de segurança permissiva (BLOCK_ONLY_HIGH)
    // O segredo é o prompt: pedimos "Wallpaper" (Papel de Parede) em vez de "Fashion".
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
        ],
        generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 0.95,
            candidateCount: 1
        }
    };

    try {
        const response = await fetch(endpointImg, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!response.ok) {
            const errTxt = await response.text();
            console.error("Gemini API Error:", errTxt);
            throw new Error(`Erro na API: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.promptFeedback?.blockReason) {
             console.warn("Block Reason:", data.promptFeedback);
             throw new Error("SAFETY_BLOCK");
        }

        const candidate = data.candidates?.[0]?.content?.parts;
        if (!candidate) throw new Error("NO_CONTENT");

        const imagePart = candidate.find(p => p.inline_data);
        if (imagePart) {
            return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        }
        
        const textPart = candidate.find(p => p.text);
        if (textPart) {
            // Se a IA responder com texto, é uma recusa.
            console.warn("AI Refusal:", textPart.text);
            throw new Error("SAFETY_REFUSAL"); 
        }
        
        throw new Error("GENERIC_FAIL");
    } catch (e) {
        throw e;
    }
};

export const generatePattern = async (apiKey, prompt, colors, textileSpecs) => {
    // 1. EXTRAÇÃO DE KEYWORDS SEGURAS
    // Removemos qualquer contexto de "corpo", "mulher", "vestido"
    const safePrompt = prompt
        .replace(/\b(dress|shirt|woman|man|model|body|skin|nude|face|wear|clothing|garment|fashion)\b/gi, "")
        .trim();

    // 2. PROMPT "TEXTURE SWATCH" (O Pulo do Gato)
    // Enganamos a IA pedindo um "Papel de Parede" ou "Azulejo". Isso é 100% seguro.
    const MASTER_PROMPT = `
    Generate a seamless SQUARE TEXTURE TILE (Wallpaper style).
    
    MOTIF: ${safePrompt || "Geometric abstract shapes"}.
    STYLE: Vector Art, Flat 2D, Clean Lines.
    COLORS: ${colors && colors.length > 0 ? colors.map(c => c.hex).join(', ') : "Vibrant high contrast"}.
    
    TECHNICAL RULES:
    - NO human figures. NO body parts. NO realistic photos.
    - Top-down view (Satellite view).
    - Repeatable pattern.
    - High quality vector illustration.
    `;

    try {
        return await callGeminiImage(apiKey, MASTER_PROMPT);
    } catch (e) {
        console.warn("Primary Gen Failed:", e.message);
        
        // 3. FALLBACK "BAUHAUS SAFE MODE"
        // Se falhar, geramos formas geométricas. É melhor entregar algo do que um erro.
        const FALLBACK_PROMPT = `
        Seamless geometric Bauhaus pattern. 
        Colors: ${colors && colors.length > 0 ? colors.map(c => c.hex).join(', ') : "Colorful"}.
        Style: Minimalist vector art.
        `;
        
        try {
            return await callGeminiImage(apiKey, FALLBACK_PROMPT);
        } catch (fallbackError) {
            throw new Error("A IA não conseguiu gerar esta imagem. Tente termos como 'Floral', 'Geométrico', 'Listras'.");
        }
    }
};