
// api/modules/generator.js
// DEPARTAMENTO: FABRICAÇÃO DE ESTAMPAS (The Loom)
// TECNOLOGIA: Master Textile Prompt v2.0 (Industrial Standard)

const callGeminiImage = async (apiKey, prompt) => {
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    // SAFETY: Relaxada para permitir "pele" como cor, pois o prompt técnico já removeu o contexto humano.
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
    
    // 1. DEFINIÇÃO DE PALETA (Cores Chapadas)
    // Se houver cores definidas, forçamos "Solid Flat Colors"
    const colorString = (colors || []).map(c => `${c.name} (${c.hex})`).join(', ');
    const paletteInstruction = colorString 
        ? `PALETA CROMÁTICA TÉCNICA: Utilizar estritamente as cores: ${colorString}. Cores chapadas (Solid Colors), sem degradês, prontas para separação de cilindro.`
        : `PALETA CROMÁTICA TÉCNICA: Cores harmoniosas, chapadas e contrastantes, adequadas para coleção comercial.`;

    // 2. MONTAGEM DO PROMPT MESTRE INDUSTRIAL
    // A estrutura segue exatamente o pedido: Definição -> Estilo -> Técnica -> Saída.
    
    const MASTER_PROMPT = `
    ATUE COMO: Designer Têxtil Sênior (Especialista em Estamparia Industrial).
    OBJETIVO: Gerar arquivo de estampa final (Pattern Swatch) em alta resolução.
    
    --- DEFINIÇÃO DO PADRÃO ---
    MOTIVO PRINCIPAL: ${prompt}
    ESTRUTURA: Estampa têxtil de padrão ${layout === 'Barrada' ? 'BARRADO (Border Print)' : 'CORRIDO (All-over Repeat)'} com repetição contínua e encaixe técnico regular.
    
    --- DIRETRIZES DE REFINO VISUAL (O QUE FAZER) ---
    1. TRAÇO: Desenvolver em linguagem vetorial, com contornos limpos e bem definidos.
    2. ESTILO: Elementos estilizados e planificados (Flat Design).
    3. ACABAMENTO: Eliminar ruídos e texturas pictóricas. O preenchimento deve ser predominantemente chapado.
    4. DETALHE: Variação sutil e controlada de espessura de linha, simulando desenho técnico refinado.
    5. COMPOSIÇÃO: Distribuição rítmica e equilibrada, garantindo leitura contínua.
    
    --- REGRAS DE SEGURANÇA E TÉCNICA (O QUE NÃO FAZER) ---
    - NÃO gerar pessoas, corpos, modelos ou manequins.
    - NÃO gerar fotografia ou renderização 3D realista.
    - NÃO usar efeito aquarela borrado (Watercolor Blur) ou granulação.
    - NÃO incluir marcas d'água ou texto.
    
    --- ESPECIFICAÇÕES DE SAÍDA ---
    ${paletteInstruction}
    VISUALIZAÇÃO: SWATCH 2D PLANO (Top-down view).
    RAPPORT: ${repeat}.
    ARQUIVO: Pronto para produção industrial.
    `;

    try {
        return await callGeminiImage(apiKey, MASTER_PROMPT);
    } catch (e) {
        const errString = e.message || e.toString();
        
        // Fallback para geometria pura se falhar (Garantia de entrega)
        if (errString.includes("SAFETY_BLOCK")) {
            console.warn("Engaging Technical Fallback...");
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
