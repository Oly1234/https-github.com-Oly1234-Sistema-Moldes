
// api/modules/generator.js
// DEPARTAMENTO: FABRICAÇÃO DE ESTAMPAS (The Loom)
// TECNOLOGIA: Clean Vector Prompt v3.0 (No Negative Constraints)

const callGeminiImage = async (apiKey, prompt) => {
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    // SAFETY: Configuramos para bloquear apenas o extremo.
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
        ],
        generationConfig: {
            temperature: 0.4, // Baixa temperatura para seguir o prompt fielmente (menos alucinação)
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
    // Forçamos "Flat Solid Colors" para evitar que a IA tente misturar cores de pele realistas
    const colorString = (colors || []).map(c => `${c.name} (${c.hex})`).join(', ');
    const paletteInstruction = colorString 
        ? `COLORS: Use strictly these solid flat colors: ${colorString}. High contrast, no shading.`
        : `COLORS: High contrast flat vector colors.`;

    // 2. INDUSTRIAL MASTER PROMPT (CLEAN VERSION)
    // REMOVIDO: "NO PEOPLE", "NO BODIES" (Isso ativava o filtro de segurança)
    // ADICIONADO: Termos fortes de design gráfico abstrato.
    
    const layoutTerm = layout === 'Barrada' ? 'Engineered border print design' : 'Seamless all-over repeat pattern';
    
    const MASTER_PROMPT = `
    Professional Textile Surface Design.
    
    Product: Digital vector file for fabric printing.
    Type: ${layoutTerm}.
    Style: Flat Vector Illustration, Clean Lines, 2D Planar Geometry.
    
    VISUAL DESCRIPTION:
    ${prompt}
    
    TECHNICAL FINISH:
    - High resolution vector graphics.
    - Sharp defined edges.
    - Solid fills (Screen print style).
    - Composition: Balanced, rhythmic, professional ${repeatType === 'Half-Drop' ? 'half-drop' : 'straight'} repeat.
    
    ${paletteInstruction}
    `;

    try {
        return await callGeminiImage(apiKey, MASTER_PROMPT);
    } catch (e) {
        const errString = e.message || e.toString();
        
        // Fallback: Simplificação Extrema
        // Se der erro, tentamos um prompt puramente geométrico/botânico sem adjetivos complexos.
        if (errString.includes("SAFETY_BLOCK")) {
            console.warn("Engaging Technical Fallback (Pure Abstract)...");
            
            // Extraímos apenas os substantivos principais para limpar "lixo" semântico
            const cleanSubject = prompt.split('.')[0].substring(0, 100); 
            
            const FALLBACK_PROMPT = `
            Textile Pattern Design.
            Subject: ${cleanSubject}.
            Style: Abstract flat vector geometry.
            Colors: ${colorString || 'Vibrant'}.
            View: 2D Texture Swatch.
            `;
            return await callGeminiImage(apiKey, FALLBACK_PROMPT);
        }
        throw e;
    }
};
