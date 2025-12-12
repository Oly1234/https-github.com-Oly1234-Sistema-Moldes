
export default async function handler(req, res) {
  // 1. Configuração Manual de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { action, prompt, mainImageBase64, mainMimeType, secondaryImageBase64, secondaryMimeType, excludePatterns } = req.body;
    
    // --- GESTÃO DE CHAVES DE SEGURANÇA ---
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;

    if (!apiKey) {
        return res.status(500).json({ error: "Erro de Configuração: Chave de API não encontrada." });
    }

    const genAIEndpoint = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // ==========================================================================================
    // ROTA 1: ENHANCE PROMPT (Refinamento de Texto para Estampas)
    // ==========================================================================================
    if (action === 'ENHANCE_PROMPT') {
        const endpoint = genAIEndpoint('gemini-2.5-flash');
        
        const systemPrompt = `
        ATUE COMO: Curador de Arte Têxtil Sênior.
        TAREFA: Transformar a entrada do usuário em um prompt técnico para geração de PADRÃO CONTÍNUO (SEAMLESS PATTERN).
        
        ENTRADA DO USUÁRIO: "${prompt}"
        
        SAÍDA (Apenas o texto refinado em Português):
        Crie uma descrição rica focada em elementos visuais, estilo artístico (ex: Bauhaus, Art Nouveau, Farm Rio), paleta de cores e técnica de pintura.
        Adicione ao final: ", design de superfície profissional, alta resolução, padrão repetitivo perfeito."
        `;

        const payload = {
            contents: [{ parts: [{ text: systemPrompt }] }]
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        const enhancedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        return res.status(200).json({ success: true, enhancedPrompt: enhancedText || prompt });
    }

    // ==========================================================================================
    // ROTA 2: DESCRIÇÃO DE ESTAMPA (VISÃO COMPUTACIONAL - PROMPT MESTRE)
    // ==========================================================================================
    if (action === 'DESCRIBE_PATTERN') {
        const visionEndpoint = genAIEndpoint('gemini-2.5-flash');
        
        const VISION_PROMPT = `
          ATUE COMO: Designer de Superfície Têxtil Sênior (Expert em Print Design).
          TAREFA: Analisar a imagem fornecida e gerar um "Prompt Técnico Mestre" para recriação da estampa.
          
          OBJETIVO: O texto gerado deve ser rico, estruturado e técnico, seguindo EXATAMENTE este modelo:

          🎨 Prompt Técnico para Geração de Estampa Têxtil Digital
          
          1. Contexto e Estilo
          - Estilo Visual: (Ex: Floral Tropical, Geométrico Bauhaus, Paisley Boho, etc)
          - Vibe: (Ex: Vibrante, Minimalista, Romântico, Nostálgico)
          - Técnica Aparente: (Ex: Aquarela, Vetor Flat, Serigrafia, Óleo sobre tela)

          2. Composição e Estrutura
          - Fundo (Base): Cor exata (nome e tom), textura ou cor sólida.
          - Elementos Principais: Descrição detalhada dos motivos (flores, formas, animais). Tamanho, distribuição e interação.
          - Elementos Secundários: Detalhes de preenchimento.
          - Barrados/Bordas: Se houver, descreva a estrutura geométrica ou linear nas bordas (muito importante se visível).

          3. Paleta de Cores (Maximalista e Precisa)
          - Cor Dominante:
          - Cores de Acento/Destaque:
          - Cores Secundárias:

          4. Requisitos de Repetição (Rapport)
          - Tipo: (Seamless Pattern, Half-Drop, Grid)
          - Instrução para IA: "Garantir que não haja cortes ou emendas visíveis. Alta resolução."

          IMPORTANTE:
          - Seja extremamente descritivo nas cores (ex: "Verde Floresta Profundo" em vez de apenas "Verde").
          - Identifique a "Pincelada" ou o traço artístico.
          - Responda em Português do Brasil.
        `;

        const visionPayload = {
            contents: [{
                parts: [
                    { text: VISION_PROMPT },
                    { inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }
                ]
            }],
            generation_config: {
                temperature: 0.4,
                max_output_tokens: 1000
            }
        };

        const visionRes = await fetch(visionEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(visionPayload)
        });

        if (!visionRes.ok) {
            const errText = await visionRes.text();
            throw new Error(`Vision API Error: ${visionRes.status} - ${errText}`);
        }
        
        const visionData = await visionRes.json();
        let description = visionData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!description) {
            throw new Error("Não foi possível ler a imagem.");
        }

        description = description.replace(/^Prompt:|^Descrição:/i, '').trim();
        return res.status(200).json({ success: true, description: description });
    }

    // ==========================================================================================
    // ROTA 3: GERAÇÃO DE ESTAMPAS (IMAGEN / GEMINI IMAGE)
    // ==========================================================================================
    if (action === 'GENERATE_PATTERN') {
        const imageEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
        
        const finalPrompt = `
          Task: Create a High-End Seamless Textile Pattern based on this description.
          
          Visual Description (Portuguese):
          "${prompt}"
          
          TECHNICAL MANDATORY REQUIREMENTS:
          1. SEAMLESS / TILEABLE: The edges must match perfectly. This is for fabric printing.
          2. VIEW: Top-down, flat 2D design. No perspective, no folds, no clothing mockups. Just the raw pattern.
          3. QUALITY: 8k resolution, sharp details, professional color grading.
          4. COMPOSITION: Balanced distribution. Avoid empty holes unless specified.
        `;
        
        const payload = {
            contents: [{ parts: [{ text: finalPrompt }] }],
            generation_config: {
                response_mime_type: "image/jpeg",
                aspect_ratio: "1:1"
            }
        };

        const googleResponse = await fetch(imageEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!googleResponse.ok) {
            throw new Error(`Erro na Geração: ${googleResponse.status}`);
        }

        const data = await googleResponse.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find(p => p.inline_data);
        
        if (!imagePart) {
             throw new Error("Conteúdo bloqueado pelos filtros de segurança. Tente um prompt mais suave.");
        }

        return res.status(200).json({ 
            success: true, 
            image: `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}` 
        });
    }

    // ==========================================================================================
    // ROTA 4: ANÁLISE DE ROUPAS - RETORNO MASSIVO (25+ ITENS)
    // ==========================================================================================
    const JSON_SCHEMA_PROMPT = `
You are a Fashion Technical Analyst. Analyze the image and return a JSON object.
It is CRITICAL that you find matching sewing patterns available for purchase or download.

MANDATORY: Return a MASSIVE LIST of 18 to 28 matches.
Focus on "Big 4" (Vogue, McCall's, Butterick, Simplicity), BurdaStyle, Etsy, The Fold Line, Mood Fabrics, Vikisews.

STRICTLY FOLLOW THIS JSON STRUCTURE. NO COMMENTS.

{
  "patternName": "Descriptive Name (PT-BR)",
  "category": "Category",
  "technicalDna": { "silhouette": "e.g. A-Line", "neckline": "e.g. V-Neck", "sleeve": "e.g. Puff", "fabricStructure": "e.g. Woven" },
  "matches": { 
      "exact": [{ "source": "Store Name", "patternName": "Pattern Name", "url": "https://...", "imageUrl": "OPTIONAL: URL of logo or thumb", "type": "PAGO", "similarityScore": 95 }], 
      "close": [{ "source": "Etsy Search", "patternName": "Pattern Name", "url": "https://...", "imageUrl": "OPTIONAL", "type": "INDIE", "similarityScore": 85 }], 
      "adventurous": [] 
  },
  "curatedCollections": [
      { "title": "Nome da Coleção (ex: Vestidos de Verão)", "searchUrl": "https://...", "itemCount": "50+ modelos", "description": "Curadoria de...", "sourceName": "Burda/Etsy" }
  ]
}
`;
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const parts = [{ inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }];
    if (secondaryImageBase64) parts.push({ inline_data: { mime_type: secondaryMimeType, data: secondaryImageBase64 } });

    let promptText = `EXECUTE VINGI GLOBAL SCAN. ${JSON_SCHEMA_PROMPT}`;
    if (excludePatterns?.length) promptText += ` EXCLUDE: ${excludePatterns.join(', ')}`;
    parts.push({ text: promptText });

    const payloadMain = {
        contents: [{ parts: parts }],
        generation_config: { 
            response_mime_type: "application/json",
            temperature: 0.2
        }
    };

    const googleResponse = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadMain)
    });

    if (!googleResponse.ok) throw new Error("Erro na API de Análise");
    const dataMain = await googleResponse.json();
    let generatedText = dataMain.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // --- CORREÇÃO DO ERRO DE URL (MANTIDA) ---
    if (generatedText) {
        generatedText = generatedText.replace(/```json/g, '').replace(/```/g, '');
        const firstBrace = generatedText.indexOf('{');
        const lastBrace = generatedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            generatedText = generatedText.substring(firstBrace, lastBrace + 1);
        }
    }

    let jsonResult;
    try {
        jsonResult = JSON.parse(generatedText);
    } catch (e) {
        console.error("JSON Parse Error Raw:", generatedText);
        jsonResult = {
            patternName: "Erro de Processamento",
            category: "Geral",
            technicalDna: { silhouette: "-", neckline: "-", sleeve: "-", fabricStructure: "-" },
            matches: { exact: [], close: [], adventurous: [] },
            curatedCollections: []
        };
    }
    
    res.status(200).json(jsonResult);

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: error.message || 'Erro Interno' });
  }
}
