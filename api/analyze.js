
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
        if (targetUrl.includes('google.com/search')) return res.status(200).json({ success: false });

        try {
            const commonHeaders = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
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
                    // Tenta encontrar 'image' em Product, Article ou raiz
                    const extractImg = (obj) => {
                         if (obj.image) return Array.isArray(obj.image) ? obj.image[0] : obj.image;
                         return null;
                    };
                    let found = extractImg(json);
                    if (!found && Array.isArray(json)) found = json.map(extractImg).find(i => i);
                    
                    if (found) {
                        imageUrl = (typeof found === 'object' && found.url) ? found.url : found;
                    }
                } catch (e) {}
            }

            // 2. Open Graph (Padrão Ouro para Redes Sociais)
            if (!imageUrl) {
                const metaRegex = /<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']\s*\/?>/i;
                const match = html.match(metaRegex);
                if (match) imageUrl = match[1];
            }

            // 3. Fallback para sites específicos (Scraping Específico)
            if (!imageUrl) {
                // Shutterstock
                if (targetUrl.includes('shutterstock')) {
                     // Tenta pegar a imagem grande de preview
                     const ssMatch = html.match(/src=["'](https:\/\/image\.shutterstock\.com\/[^"']+)["']/i);
                     if (ssMatch) imageUrl = ssMatch[1];
                }
                // Patternbank
                if (targetUrl.includes('patternbank')) {
                     const pbMatch = html.match(/data-src=["']([^"']+)["']|src=["']([^"']+)["']/i); 
                     if (pbMatch) imageUrl = pbMatch[1] || pbMatch[2];
                }
                 // Etsy
                if (targetUrl.includes('etsy')) {
                     const etsyMatch = html.match(/data-src-zoom-image=["']([^"']+)["']|data-src-full=["']([^"']+)["']/i);
                     if (etsyMatch) imageUrl = etsyMatch[1] || etsyMatch[2];
                }
            }

            if (!imageUrl) return res.status(200).json({ success: false });
            
            // Corrigir protocolos e limpar
            if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
            imageUrl = imageUrl.replace(/&amp;/g, '&');
            
            return res.status(200).json({ success: true, image: imageUrl });

        } catch (err) {
            return res.status(200).json({ success: false, error: err.message });
        }
    }

    // ==========================================================================================
    // ROTA 1: GERAÇÃO DE ESTAMPA (AGORA RETORNA ERRO SE FALHAR PARA FRONTEND USAR FALLBACK)
    // ==========================================================================================
    if (action === 'GENERATE_PATTERN') {
        if (!apiKey) return res.status(401).json({ success: false, error: "Missing API Key" });

        try {
            // Tenta usar o Gemini para gerar (pode falhar dependendo da chave, o Frontend lida com isso)
            const imageEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
            
            // Instrução Estrita de Cores
            const colorInstruction = colors && colors.length > 0 
                ? `STRICT COLORS: ${colors.map(c => c.name).join(', ')}`
                : '';

            const finalPrompt = `Create a seamless pattern: ${prompt}. ${colorInstruction}`;
            
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
            
            if (!imagePart) return res.status(200).json({ success: false }); // Frontend usará Pollinations
            
            return res.status(200).json({ success: true, image: `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}` });
        } catch (e) {
            return res.status(200).json({ success: false }); // Retorna falso para Frontend usar Fallback
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
            
            TAREFA 1: Analise a imagem. Descreva o "Visual DNA" em Inglês (Prompt rico para geração).
            TAREFA 2: Extraia Paleta de Cores.
            TAREFA 3: Gere 30 (TRINTA) URLs de Busca para bancos de imagens REAIS.
            
            OBJETIVO:
            Queremos que o usuário encontre estampas IGUAIS ou MUITO SIMILARES para comprar.
            
            FONTES OBRIGATÓRIAS (Inclua diversidade):
            - Shutterstock, Patternbank, Adobe Stock, Spoonflower, Creative Market, Vecteezy.
            
            REGRAS DE URL (CRÍTICO):
            - Crie URLs de Busca (Search Queries) combinando palavras-chave visuais.
            - Exemplo: "https://www.shutterstock.com/search/red+watercolor+hibiscus+seamless"

            JSON OUTPUT:
            { 
              "prompt": "Detailed visual description...",
              "colors": [{ "name": "...", "code": "...", "hex": "..." }],
              "stockMatches": [
                 ... GERE 30 ITENS ...
                 { 
                   "source": "Nome do Site", 
                   "patternName": "Nome Descritivo", 
                   "type": "ROYALTY-FREE", 
                   "linkType": "SEARCH_QUERY", 
                   "url": "https://site.com/search?q=keywords",
                   "similarityScore": 95 
                 }
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

    // ==========================================================================================
    // ROTA 3: SCAN CLOTHING (GLOBAL SEARCH)
    // ==========================================================================================
    if (action === 'SCAN_CLOTHING' || !action) { 
        if (!apiKey) return res.status(503).json({ error: "Backend Unavailable" });

        const GLOBAL_SEARCH_PROMPT = `
        VOCÊ É: VINGI AI, Especialista em Engenharia Reversa de Moda.
        MISSÃO: Analisar a roupa e encontrar MOLDES DE COSTURA (Sewing Patterns) compatíveis.

        PASSO 1: Analise o DNA Técnico da peça.
        PASSO 2: Busque moldes em acervos globais.

        FONTES: 
        - Vikisews, Burda Style, The Fold Line, Mood Fabrics (Free), Marlene Mukai (Brasil), Etsy.

        REGRAS DE LINK:
        - PREFERÊNCIA ABSOLUTA por URLs de BUSCA ("SEARCH_QUERY").
        
        QUANTIDADE:
        - Gere TOTAL de 30 a 40 sugestões (Exact + Close). O usuário quer muitas opções.

        ESTRUTURA JSON DE RETORNO:
        {
          "patternName": "Nome em PT-BR",
          "category": "Categoria",
          "technicalDna": { "silhouette": "...", "neckline": "...", "sleeve": "...", "fabricStructure": "..." },
          "matches": { 
             "exact": [ ... min 15 itens ... ], 
             "close": [ ... min 15 itens ... ], 
             "adventurous": [ ... ] 
          },
          "curatedCollections": [ ... ]
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
