
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
    // ROTA 2: DESCRIÇÃO DE ESTAMPA (VISÃO COMPUTACIONAL)
    // ==========================================================================================
    if (action === 'DESCRIBE_PATTERN') {
        const visionEndpoint = genAIEndpoint('gemini-2.5-flash');
        
        const VISION_PROMPT = `
          Analise esta imagem como um Designer de Estampas. 
          Descreva EXATAMENTE o padrão visual para que uma IA geradora de imagens possa replicar o estilo.
          
          ESTRUTURA DA RESPOSTA (Em Português):
          "Estampa [ESTILO: ex: Floral, Geométrico, Étnico], composta por [ELEMENTOS PRINCIPAIS], utilizando técnica de [TÉCNICA: ex: Aquarela, Vetor Flat, Óleo].
          Paleta de cores: [CORES DOMINANTES].
          Fundo: [COR/TEXTURA DO FUNDO].
          Vibe: [SENSAÇÃO: ex: Tropical, Minimalista, Retrô].
          Design repetitivo seamless (sem emendas)."
          
          Seja direto e técnico. Não use frases introdutórias.
        `;

        const visionPayload = {
            contents: [{
                parts: [
                    { text: VISION_PROMPT },
                    { inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }
                ]
            }],
            generation_config: {
                temperature: 0.2, 
                max_output_tokens: 500
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
        
        // Reforço para Seamless Pattern
        const finalPrompt = `
          Design a High-End Seamless Textile Pattern.
          Visual Description: "${prompt}".
          
          MANDATORY REQUIREMENTS:
          1. SEAMLESS / TILEABLE: The edges must match perfectly for repetition.
          2. VIEW: Top-down, flat 2D design. No perspective, no folds, no mockups.
          3. STYLE: Professional Surface Design. High detail, 8k resolution.
          4. COMPOSITION: Balanced distribution of elements.
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
    // ROTA 4: ANÁLISE DE ROUPAS
    // ==========================================================================================
    const JSON_SCHEMA_PROMPT = `
RESPONSE FORMAT (JSON ONLY):
{
  "patternName": "Name",
  "category": "Category",
  "technicalDna": { "silhouette": "", "neckline": "", "sleeve": "", "fabricStructure": "" },
  "matches": { "exact": [], "close": [], "adventurous": [] },
  "curatedCollections": []
}
`;
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const parts = [{ inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }];
    if (secondaryImageBase64) parts.push({ inline_data: { mime_type: secondaryMimeType, data: secondaryImageBase64 } });

    let promptText = `EXECUTE VINGI GLOBAL SCAN. GENERATE 45 PATTERNS. ${JSON_SCHEMA_PROMPT}`;
    if (excludePatterns?.length) promptText += ` EXCLUDE: ${excludePatterns.join(', ')}`;
    parts.push({ text: promptText });

    const payloadMain = {
        contents: [{ parts: parts }],
        generation_config: { response_mime_type: "application/json" }
    };

    const googleResponse = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadMain)
    });

    if (!googleResponse.ok) throw new Error("Erro na API de Análise");
    const dataMain = await googleResponse.json();
    const generatedText = dataMain.candidates?.[0]?.content?.parts?.[0]?.text;
    const jsonResult = JSON.parse(generatedText.replace(/```json|```/g, '').trim());
    res.status(200).json(jsonResult);

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: error.message || 'Erro Interno' });
  }
}
