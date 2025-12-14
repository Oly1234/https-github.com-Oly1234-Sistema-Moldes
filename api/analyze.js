
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

  const cleanJson = (text) => {
      if (!text) return null;
      let cleaned = text.replace(/```json/g, '').replace(/```/g, '');
      const first = cleaned.indexOf('{');
      const last = cleaned.lastIndexOf('}');
      if (first !== -1 && last !== -1) {
          cleaned = cleaned.substring(first, last + 1);
      }
      return cleaned;
  };

  try {
    const { action, prompt, colors, mainImageBase64, mainMimeType, secondaryImageBase64, secondaryMimeType, targetUrl } = req.body;
    
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY || process.env.VITE_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;
    const genAIEndpoint = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // ==========================================================================================
    // ROTA 0: SCRAPER ROBUSTO (GET_LINK_PREVIEW) - MODO "PYTHON" SIMULADO
    // ==========================================================================================
    if (action === 'GET_LINK_PREVIEW') {
        if (!targetUrl) return res.status(400).json({ error: 'URL necessária' });
        // Bloqueamos google search genérico, mas permitimos tudo o mais para tentar extrair imagem real
        if (targetUrl.includes('google.com/search')) return res.status(200).json({ success: false });

        try {
            const commonHeaders = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Upgrade-Insecure-Requests': '1'
            };
            
            const siteRes = await fetch(targetUrl, { headers: commonHeaders });
            if (!siteRes.ok) throw new Error('Site bloqueou ou 404');
            const html = await siteRes.text();
            
            let imageUrl = null;
            
            // Lógica de Prioridade de Extração (Scraping Real)
            
            // 1. JSON-LD (Muitos sites de e-commerce modernos usam isso para a imagem principal)
            const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
            if (jsonLdMatch) {
                try {
                    const json = JSON.parse(jsonLdMatch[1]);
                    if (json.image) {
                        imageUrl = Array.isArray(json.image) ? json.image[0] : json.image;
                        if (typeof imageUrl === 'object' && imageUrl.url) imageUrl = imageUrl.url;
                    }
                } catch (e) {}
            }

            // 2. Open Graph (Padrão Ouro para Redes Sociais)
            if (!imageUrl) {
                const metaRegex = /<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']\s*\/?>/i;
                const match = html.match(metaRegex);
                if (match) imageUrl = match[1];
            }

            // 3. Fallback para sites específicos (Etsy, Shutterstock)
            if (!imageUrl) {
                // Shutterstock
                if (targetUrl.includes('shutterstock')) {
                     const ssMatch = html.match(/src=["'](https:\/\/image\.shutterstock\.com\/[^"']+)["']/i);
                     if (ssMatch) imageUrl = ssMatch[1];
                }
                // Patternbank
                if (targetUrl.includes('patternbank')) {
                     const pbMatch = html.match(/data-src=["']([^"']+)["']|src=["']([^"']+)["']/i); // Tenta achar imagem grande
                     if (pbMatch) imageUrl = pbMatch[1] || pbMatch[2];
                }
            }

            if (!imageUrl) return res.status(200).json({ success: false });
            
            // Corrigir protocolos
            if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
            
            return res.status(200).json({ success: true, image: imageUrl });

        } catch (err) {
            return res.status(200).json({ success: false, error: err.message });
        }
    }

    // ==========================================================================================
    // ROTA 1: GERAÇÃO DE ESTAMPA (RÉPLICA BASEADA NO DNA)
    // ==========================================================================================
    if (action === 'GENERATE_PATTERN') {
        if (!apiKey) return res.status(401).json({ success: false, error: "Missing API Key" });

        try {
            const imageEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
            
            // Instrução Estrita de Cores
            const colorInstruction = colors && colors.length > 0 
                ? `STRICT COLOR PALETTE (USE ONLY THESE): ${colors.map(c => `${c.name} (${c.hex})`).join(', ')}.`
                : 'Extract colors from the description provided.';

            const finalPrompt = `
            ACT AS: Professional Textile Designer mimicking an existing print.
            TASK: Recreate the seamless pattern described below with High Fidelity.
            
            VISUAL DESCRIPTION (DNA):
            "${prompt}"
            
            COLORS:
            ${colorInstruction}
            
            TECHNICAL REQUIREMENTS:
            - OUTPUT: A single, high-resolution seamless tile.
            - VIEW: Flat Lay, Vector Style, No perspective, No folds.
            - STYLE: Commercial Fabric Print (Ready for production).
            `;
            
            const payload = {
                contents: [{ parts: [{ text: finalPrompt }] }],
                generation_config: { response_mime_type: "image/jpeg", aspect_ratio: "1:1" }
            };

            const googleResponse = await fetch(imageEndpoint, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload) 
            });

            if (!googleResponse.ok) throw new Error("Google GenAI Error");
            const data = await googleResponse.json();
            const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
            
            if (!imagePart) throw new Error("No image generated");
            
            return res.status(200).json({ success: true, image: `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}` });
        } catch (e) {
            console.error("Gen Image Error:", e);
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    // ==========================================================================================
    // ROTA 2: ANÁLISE + BUSCA REAL (STOCK MATCHING)
    // ==========================================================================================
    if (action === 'DESCRIBE_PATTERN') {
         if (!apiKey) return res.status(500).json({ error: "No Key" });

        try {
            const visionEndpoint = genAIEndpoint('gemini-2.5-flash');
            
            const MASTER_VISION_PROMPT = `
            ATUE COMO: CURADOR TÊXTIL SÊNIOR.
            
            TAREFA 1: Analise a imagem enviada. Descreva o "Visual DNA" em Inglês (técnica, elementos, composição).
            TAREFA 2: Extraia a Paleta de Cores exata.
            TAREFA 3: Encontre ou Construa URLs de Busca para bancos de imagens REAIS.
            
            OBJETIVO DE BUSCA:
            Queremos que o usuário encontre estampas IGUAIS ou MUITO SIMILARES para comprar.
            
            FONTES OBRIGATÓRIAS (Inclua diversidade):
            - Shutterstock, Patternbank, Adobe Stock, Spoonflower, Creative Market, Vecteezy.
            
            REGRAS DE URL (CRÍTICO):
            - Tente ser específico nas Keywords da URL para garantir que a página de destino mostre estampas relevantes.
            - Exemplo: "https://www.shutterstock.com/search/red+watercolor+hibiscus+seamless"
            - NÃO use links quebrados. Use URLs de busca (Search Queries) construídas com as características visuais da imagem.

            JSON OUTPUT:
            { 
              "prompt": "Detailed visual description of the pattern for regeneration...",
              "colors": [{ "name": "...", "code": "...", "hex": "..." }],
              "stockMatches": [
                 { 
                   "source": "Nome do Site", 
                   "patternName": "Nome Descritivo (ex: Red Floral Watercolor)", 
                   "type": "ROYALTY-FREE" ou "PREMIUM", 
                   "linkType": "SEARCH_QUERY", 
                   "url": "https://site.com/search?q=keywords+from+image",
                   "similarityScore": 95 
                 },
                 ... (Gere pelo menos 15 resultados variados)
              ]
            }
            `;

            const visionPayload = {
                contents: [{
                    parts: [
                        { text: MASTER_VISION_PROMPT },
                        { inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }
                    ]
                }],
                generation_config: { response_mime_type: "application/json" }
            };
            
            const visionRes = await fetch(visionEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(visionPayload) });
            const visionData = await visionRes.json();
            let generatedText = visionData.candidates?.[0]?.content?.parts?.[0]?.text;
            const jsonResult = JSON.parse(cleanJson(generatedText));
            return res.status(200).json({ success: true, ...jsonResult });
        } catch (e) {
            return res.status(500).json({ error: "Vision Failed" });
        }
    }

    // (ROTA 3 SCAN_CLOTHING MANTIDA IGUAL AO ORIGINAL)
    if (action === 'SCAN_CLOTHING' || !action) { 
        if (!apiKey) return res.status(503).json({ error: "Backend Unavailable" });
        // ... (Mantém o código existente do Scan Clothing para não quebrar a outra feature)
        const GLOBAL_SEARCH_PROMPT = `
        VOCÊ É: VINGI AI, O Maior Especialista em Moldes do Mundo.
        MISSÃO: Retornar uma lista massiva e precisa de moldes de costura (40-60 itens).

        ACERVO GLOBAL OBRIGATÓRIO (Pesquise Nestes Domínios):
        1. EUA/UK: Simplicity, Vogue Patterns, McCall's, Butterick, Mood Fabrics (Free), The Fold Line, Peppermint Mag, Seamwork, Tilly and the Buttons.
        2. EUROPA: Burda Style (Alemanha), Patrones (Espanha), Makerist (EU), MyFabrics, Vikisews (Rússia/Intl), Grasser (Rússia), Lekala (Sob Medida).
        3. INDIE/MODERN: Papercut Patterns, Thread Theory, Pattern Emporium, Closet Core, Friday Pattern Co, True Bias.
        4. BRASIL: Marlene Mukai, Maximus Tecidos, Sigbol.
        5. VINTAGE/MARKET: Etsy (Busca profunda), eBay.

        REGRAS DE RETORNO:
        - Priorize links diretos de produtos. Se não existir, use links de busca INTELIGENTE dentro da loja (ex: burdastyle.com/catalogsearch/result/?q=termo).
        - NÃO invente links mortos.
        - Descrições em PT-BR ricas.

        ESTRUTURA JSON:
        {
          "patternName": "Nome (PT-BR)",
          "category": "Categoria",
          "technicalDna": { "silhouette": "...", "neckline": "...", "sleeve": "..." },
          "matches": { 
             "exact": [ ... mínimo 20 itens ... ], 
             "close": [ ... mínimo 20 itens ... ], 
             "adventurous": [ ... mínimo 10 itens ... ] 
          },
          "curatedCollections": []
        }
        `;

        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const parts = [{ inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }];
        if (secondaryImageBase64) parts.push({ inline_data: { mime_type: secondaryMimeType, data: secondaryImageBase64 } });
        parts.push({ text: GLOBAL_SEARCH_PROMPT });

        const googleResponse = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) });
        
        if (!googleResponse.ok) throw new Error("Erro Gemini API");
        const dataMain = await googleResponse.json();
        const text = dataMain.candidates?.[0]?.content?.parts?.[0]?.text;
        const jsonResult = JSON.parse(cleanJson(text));
        return res.status(200).json(jsonResult);
    }

    return res.status(200).json({ success: false });

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(503).json({ error: "Service Unavailable" });
  }
}
