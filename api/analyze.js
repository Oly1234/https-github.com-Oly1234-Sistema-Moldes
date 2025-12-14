
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
            
            // --- ESTRATÉGIA HÍBRIDA: JSON-LD + SEARCH GRID SCRAPING ---

            // 1. Tenta extrair de JSON-LD (funciona bem para produtos únicos)
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

            // 2. Tenta Open Graph
            if (!imageUrl) {
                const metaRegex = /<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']\s*\/?>/i;
                const match = html.match(metaRegex);
                if (match) imageUrl = match[1];
            }

            // 3. FALLBACKS DE "SEARCH GRID" (Crucial para PatternBank, Shutterstock, Etsy Search)
            // Isso permite que o sistema entre numa página de busca e "roube" a primeira imagem relevante.
            if (!imageUrl) {
                
                // SHUTTERSTOCK: Pega a primeira imagem da galeria de busca
                if (targetUrl.includes('shutterstock')) {
                     // Tenta seletor de galeria
                     const gridImg = html.match(/<img[^>]+src=["'](https:\/\/image\.shutterstock\.com\/image-[^"']+)["'][^>]*>/i);
                     if (gridImg) imageUrl = gridImg[1];
                }

                // PATTERNBANK: Pega o primeiro design da lista
                if (targetUrl.includes('patternbank')) {
                     const pbMatch = html.match(/class=["']design-image["'][^>]*src=["']([^"']+)["']/i); 
                     if (pbMatch) imageUrl = pbMatch[1];
                     
                     // Fallback para lazy load data-src
                     if (!imageUrl) {
                         const pbLazy = html.match(/data-src=["'](https:\/\/s3\.amazonaws\.com\/patternbank[^"']+)["']/i);
                         if (pbLazy) imageUrl = pbLazy[1];
                     }
                }

                // SPOONFLOWER
                if (targetUrl.includes('spoonflower')) {
                    const sfMatch = html.match(/src=["'](https:\/\/s3\.amazonaws\.com\/spoonflower[^"']+)["']/i);
                    if (sfMatch) imageUrl = sfMatch[1];
                }

                // ADOBE STOCK
                if (targetUrl.includes('adobe')) {
                    const asMatch = html.match(/src=["'](https:\/\/t4\.ftcdn\.net\/jpg\/[^"']+)["']/i);
                    if (asMatch) imageUrl = asMatch[1];
                }

                // ETSY (Search Page)
                if (targetUrl.includes('etsy')) {
                     const etsyMatch = html.match(/src=["'](https:\/\/i\.etsystatic\.com\/[^"']+\/r\/il\/[^"']+)["']/i);
                     if (etsyMatch) imageUrl = etsyMatch[1];
                }
            }

            if (!imageUrl) return res.status(200).json({ success: false });
            
            // Sanitização
            if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
            imageUrl = imageUrl.replace(/&amp;/g, '&');
            
            // Remove thumbnails muito pequenos se possível (optimistic)
            if (imageUrl.includes('75x75')) imageUrl = imageUrl.replace('75x75', '300x300');
            
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
        if (!apiKey) return res.status(500).json({ error: "No Key" });
        try {
            const visionEndpoint = genAIEndpoint('gemini-2.5-flash');
            const MASTER_VISION_PROMPT = `
            ACT AS: Senior Textile Designer & Print Engineer.
            
            TASK 1: Deconstruct the Artistic Technique (Visual DNA).
            - LINE QUALITY: Monoline, variable width, ink bleed, or vector crisp?
            - BRUSHWORK: Dry brush, wet-on-wet watercolor, gouache opacity?
            - STYLE: Liberty London, Bauhaus, Arts & Crafts, Tropical Maximalism?
            
            TASK 2: Extract 5 Dominant Pantone Colors (Name + Hex).
            
            TASK 3: Generate 30 (THIRTY) High-Quality Search URLs.
            CRITICAL: Create "SEARCH QUERY" links. Do NOT try to guess specific product IDs.
            - Shutterstock: "https://www.shutterstock.com/search/" + keywords
            - Patternbank: "https://patternbank.com/search?q=" + keywords
            - Spoonflower: "https://www.spoonflower.com/en/shop?q=" + keywords
            - Adobe Stock: "https://stock.adobe.com/search?k=" + keywords
            
            JSON OUTPUT:
            { 
              "prompt": "Professional textile design, [Technique], [Style], seamless repeat...",
              "colors": [{ "name": "...", "code": "...", "hex": "..." }],
              "stockMatches": [
                 ... GENERATE 30 ITEMS ...
                 { 
                   "source": "Shutterstock", 
                   "patternName": "Watercolor Floral Search", 
                   "type": "ROYALTY-FREE", 
                   "linkType": "SEARCH_QUERY", 
                   "url": "https://www.shutterstock.com/search/watercolor+floral+seamless",
                   "similarityScore": 95 
                 }
              ]
            }
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
    // ROTA 3: SCAN CLOTHING - INDEPENDENTE
    // ==========================================================================================
    if (action === 'SCAN_CLOTHING' || !action) { 
        if (!apiKey) return res.status(503).json({ error: "Backend Unavailable" });

        const GLOBAL_SEARCH_PROMPT = `
        VOCÊ É: VINGI AI, O Melhor Buscador de Moldes do Mundo.
        TAREFA: Analisar a roupa e encontrar MOLDES (Sewing Patterns).
        PROBLEMA: Não tente adivinhar links diretos (404). USE LINKS DE BUSCA (SEARCH QUERIES).
        
        QUANTIDADE: 40 resultados (15 Exatos, 15 Próximos, 10 Ousados).
        
        PASSO 1: DNA Técnico (Ex: "Square Neck Puff Sleeve").
        PASSO 2: Gere LINKS DE BUSCA:
        - Etsy: "https://www.etsy.com/search?q=" + DNA_TERM
        - Burda: "https://www.burdastyle.com/catalogsearch/result/?q=" + DNA_TERM
        - Vikisews: "https://vikisews.com/search/?q=" + DNA_TERM

        JSON OUTPUT:
        {
          "patternName": "Nome Técnico PT-BR",
          "category": "Categoria",
          "technicalDna": { "silhouette": "...", "neckline": "...", "sleeve": "...", "fabricStructure": "..." },
          "matches": { 
             "exact": [ ... { "source": "Etsy", "patternName": "...", "type": "PAGO", "linkType": "SEARCH_QUERY", "url": "...", "similarityScore": 99 } ... ], 
             "close": [ ... ], 
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
        
        // Fallback de segurança para listas vazias
        if ((!jsonResult.matches.exact || jsonResult.matches.exact.length === 0) && jsonResult.patternName) {
            const termEn = encodeURIComponent(jsonResult.technicalDna.silhouette + " " + jsonResult.technicalDna.neckline + " pattern");
            jsonResult.matches.exact = [
                { source: "Etsy Global", patternName: "Resultados no Etsy", type: "PAGO", linkType: "SEARCH_QUERY", url: `https://www.etsy.com/search?q=${termEn}`, similarityScore: 95 },
                { source: "Google Shopping", patternName: "Busca Geral", type: "BUSCA", linkType: "SEARCH_QUERY", url: `https://www.google.com/search?tbm=shop&q=${termEn}`, similarityScore: 85 }
            ];
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
