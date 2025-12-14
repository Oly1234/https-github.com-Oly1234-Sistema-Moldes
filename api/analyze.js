
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
    // ROTA 0: SCRAPER ROBUSTO "PYTHON-LIKE" (GET_LINK_PREVIEW)
    // ==========================================================================================
    if (action === 'GET_LINK_PREVIEW') {
        if (!targetUrl) return res.status(400).json({ error: 'URL necessária' });
        if (targetUrl.includes('google.com/search')) return res.status(200).json({ success: false });

        try {
            const commonHeaders = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Upgrade-Insecure-Requests': '1'
            };
            
            const siteRes = await fetch(targetUrl, { headers: commonHeaders });
            if (!siteRes.ok) throw new Error(`Site bloqueou (${siteRes.status})`);
            const html = await siteRes.text();
            
            let imageUrl = null;
            
            // 1. JSON-LD
            const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
            if (jsonLdMatch) {
                try {
                    const json = JSON.parse(jsonLdMatch[1]);
                    const extractImg = (obj) => {
                         if (obj.image) return Array.isArray(obj.image) ? obj.image[0] : obj.image;
                         if (obj.thumbnailUrl) return obj.thumbnailUrl;
                         return null;
                    };
                    let found = extractImg(json);
                    if (!found && Array.isArray(json)) found = json.map(extractImg).find(i => i);
                    if (found) imageUrl = (typeof found === 'object' && found.url) ? found.url : found;
                } catch (e) {}
            }

            // 2. Open Graph
            if (!imageUrl) {
                const metaRegex = /<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']\s*\/?>/i;
                const match = html.match(metaRegex);
                if (match) imageUrl = match[1];
            }

            // 3. Fallbacks Específicos
            if (!imageUrl) {
                if (targetUrl.includes('shutterstock')) {
                     const galleryMatch = html.match(/src=["'](https:\/\/image\.shutterstock\.com\/image-[^"']+)["']/i);
                     if (galleryMatch) imageUrl = galleryMatch[1];
                }
                if (targetUrl.includes('patternbank')) {
                     const pbMatch = html.match(/data-src=["']([^"']+)["']|src=["']([^"']+)["']/i); 
                     if (pbMatch) imageUrl = pbMatch[1] || pbMatch[2];
                }
                if (targetUrl.includes('etsy')) {
                     const etsyMatch = html.match(/data-src-zoom-image=["']([^"']+)["']|data-src-full=["']([^"']+)["']/i);
                     if (etsyMatch) imageUrl = etsyMatch[1] || etsyMatch[2];
                }
            }

            if (!imageUrl) return res.status(200).json({ success: false });
            if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
            imageUrl = imageUrl.replace(/&amp;/g, '&');
            return res.status(200).json({ success: true, image: imageUrl });

        } catch (err) {
            return res.status(200).json({ success: false, error: err.message });
        }
    }

    // ==========================================================================================
    // ROTA 1: GERAÇÃO DE ESTAMPA (INDEPENDENTE)
    // ==========================================================================================
    if (action === 'GENERATE_PATTERN') {
        if (!apiKey) return res.status(401).json({ success: false, error: "Missing API Key" });
        try {
            const imageEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
            const colorInstruction = colors && colors.length > 0 ? `STRICT COLOR PALETTE: ${colors.map(c => c.name).join(', ')}.` : '';
            const finalPrompt = `Create a High-End Seamless Pattern. ${prompt}. ${colorInstruction}. Flat lay, 8k resolution, texture detailed.`;
            
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
            if (!imagePart) return res.status(200).json({ success: false });
            return res.status(200).json({ success: true, image: `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}` });
        } catch (e) {
            return res.status(200).json({ success: false }); 
        }
    }

    // ==========================================================================================
    // ROTA 2: PATTERN STUDIO (INDEPENDENTE)
    // ==========================================================================================
    if (action === 'DESCRIBE_PATTERN') {
        // Mantém a lógica existente para o criador de estampas
        if (!apiKey) return res.status(500).json({ error: "No Key" });
        try {
            const visionEndpoint = genAIEndpoint('gemini-2.5-flash');
            const MASTER_VISION_PROMPT = `
            ACT AS: Senior Textile Designer.
            TASK: Analyze the image for a Generative AI prompt.
            1. Describe Artistic Technique (Watercolor, Vector, etc).
            2. Extract 5 Colors.
            3. Generate 30 Search URLs for Stock Sites (Shutterstock, Patternbank).
            JSON OUTPUT: { "prompt": "...", "colors": [], "stockMatches": [] }
            `;
            const visionPayload = {
                contents: [{ parts: [{ text: MASTER_VISION_PROMPT }, { inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }] }],
                generation_config: { response_mime_type: "application/json" }
            };
            const visionRes = await fetch(visionEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(visionPayload) });
            const visionData = await visionRes.json();
            const text = visionData.candidates?.[0]?.content?.parts?.[0]?.text;
            return res.status(200).json({ success: true, ...JSON.parse(cleanJson(text)) });
        } catch (e) { return res.status(500).json({ error: "Vision Failed" }); }
    }

    // ==========================================================================================
    // ROTA 3: SCAN CLOTHING - CORREÇÃO DE "ZERO RESULTADOS" E "RESULTADOS FAKES"
    // ==========================================================================================
    if (action === 'SCAN_CLOTHING' || !action) { 
        if (!apiKey) return res.status(503).json({ error: "Backend Unavailable" });

        // PROMPT PROJETADO PARA GERAR LINKS DE BUSCA REAIS E EM QUANTIDADE
        const GLOBAL_SEARCH_PROMPT = `
        VOCÊ É: VINGI AI, O Melhor Buscador de Moldes do Mundo.
        
        TAREFA: Analisar a roupa e encontrar MOLDES (Sewing Patterns) para compra ou download.
        
        PROBLEMA A EVITAR: Não tente adivinhar links diretos de produtos antigos (eles dão 404).
        SOLUÇÃO: Gere URLs DE BUSCA (SEARCH QUERIES) usando os termos técnicos que você identificar.
        
        QUANTIDADE OBRIGATÓRIA: 
        - Você DEVE gerar pelo menos 40 resultados no total.
        - 15 Exatos + 15 Próximos + 10 Ousados.
        
        PASSO 1: Identifique o DNA Técnico (Ex: "Square Neck Puff Sleeve Mini Dress").
        
        PASSO 2: Gere os LINKS DE BUSCA para os maiores sites de molde do mundo:
        - Etsy: "https://www.etsy.com/search?q=" + DNA_TERM + "+sewing+pattern"
        - Burda: "https://www.burdastyle.com/catalogsearch/result/?q=" + DNA_TERM
        - The Fold Line: "https://thefoldline.com/?s=" + DNA_TERM
        - Vikisews: "https://vikisews.com/search/?q=" + DNA_TERM
        - Makerist: "https://www.makerist.com/patterns?q=" + DNA_TERM
        - Mood Fabrics: "https://www.moodfabrics.com/blog/?s=" + DNA_TERM

        ESTRUTURA JSON (Responda APENAS JSON):
        {
          "patternName": "Nome Técnico Completo em Português",
          "category": "Vestido/Blusa/Calça",
          "technicalDna": { 
             "silhouette": "Silhueta (A-line, Bodycon...)", 
             "neckline": "Decote", 
             "sleeve": "Manga", 
             "fabricStructure": "Tecido Sugerido" 
          },
          "matches": { 
             "exact": [ 
                 ... LISTA DE 15 ITENS ...
                 { 
                   "source": "Etsy", 
                   "patternName": "Vestido Manga Bufante (Busca)", 
                   "type": "PAGO", 
                   "linkType": "SEARCH_QUERY", 
                   "url": "https://www.etsy.com/search?q=puff+sleeve+square+neck+dress+pattern", 
                   "description": "Busca direta por moldes com estas características exatas.",
                   "similarityScore": 99 
                 }
             ], 
             "close": [ ... LISTA DE 15 ITENS ... ], 
             "adventurous": [ ... LISTA DE 10 ITENS ... ] 
          },
          "curatedCollections": [
             { "sourceName": "Etsy Search", "title": "Todos os Moldes Similares", "itemCount": "100+", "searchUrl": "URL DE BUSCA GERAL", "description": "Busca ampla.", "icon": "SHOPPING" }
          ]
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
        
        // --- FALLBACK DE SEGURANÇA (Se a IA falhar em gerar a lista) ---
        // Se a lista vier vazia, injetamos buscas manuais baseadas no nome identificado
        if ((!jsonResult.matches.exact || jsonResult.matches.exact.length === 0) && jsonResult.patternName) {
            const term = encodeURIComponent(jsonResult.patternName + " sewing pattern");
            const termEn = encodeURIComponent(jsonResult.technicalDna.silhouette + " " + jsonResult.technicalDna.neckline + " pattern");
            
            jsonResult.matches.exact = [
                { source: "Etsy Global", patternName: "Resultados no Etsy", type: "PAGO", linkType: "SEARCH_QUERY", url: `https://www.etsy.com/search?q=${termEn}`, similarityScore: 95 },
                { source: "Burda Style", patternName: "Catálogo Burda", type: "PREMIUM", linkType: "SEARCH_QUERY", url: `https://www.burdastyle.com/catalogsearch/result/?q=${termEn}`, similarityScore: 90 },
                { source: "Google Shopping", patternName: "Busca Geral", type: "BUSCA", linkType: "SEARCH_QUERY", url: `https://www.google.com/search?tbm=shop&q=${term}`, similarityScore: 85 },
                { source: "The Fold Line", patternName: "Indie Patterns", type: "INDIE", linkType: "SEARCH_QUERY", url: `https://thefoldline.com/?s=${termEn}`, similarityScore: 90 },
                { source: "Vikisews", patternName: "Moldes Russos", type: "TÉCNICO", linkType: "SEARCH_QUERY", url: `https://vikisews.com/search/?q=${termEn}`, similarityScore: 88 },
                { source: "Mood Fabrics", patternName: "Moldes Grátis", type: "GRATUITO", linkType: "SEARCH_QUERY", url: `https://www.moodfabrics.com/blog/?s=${termEn}`, similarityScore: 85 },
                { source: "Pinterest", patternName: "Inspiração Visual", type: "VISUAL", linkType: "SEARCH_QUERY", url: `https://www.pinterest.com/search/pins/?q=${term}`, similarityScore: 80 }
            ];
            // Duplica para preencher visualmente se necessário
            jsonResult.matches.close = [...jsonResult.matches.exact]; 
        }

        return res.status(200).json(jsonResult);
    }
    
    return res.status(200).json({ success: false });

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(503).json({ error: "Service Unavailable" });
  }
}
