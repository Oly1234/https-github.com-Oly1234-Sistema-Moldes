
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  const cleanJson = (text) => {
      if (!text) return null;
      let cleaned = text.replace(/```json/g, '').replace(/```/g, '');
      const first = cleaned.indexOf('{');
      const last = cleaned.lastIndexOf('}');
      if (first !== -1 && last !== -1) { cleaned = cleaned.substring(first, last + 1); }
      return cleaned;
  };

  try {
    const { action, prompt, colors, mainImageBase64, mainMimeType, secondaryImageBase64, secondaryMimeType, targetUrl } = req.body;
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY || process.env.VITE_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;
    const genAIEndpoint = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    if (action === 'GET_LINK_PREVIEW') {
        if (!targetUrl) return res.status(400).json({ error: 'URL necessária' });
        if (targetUrl.includes('google.com/search')) return res.status(200).json({ success: false });

        const fetchWithFallback = async (url) => {
            let html = '';
            // TENTATIVA 1: Direct Fetch com Headers de Browser
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
                
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                    },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (response.ok) { html = await response.text(); } 
                else { throw new Error(`Status ${response.status}`); }
            } catch (directError) {
                // TENTATIVA 2: API Microlink
                try {
                    const fallbackRes = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}&palette=true&audio=false&video=false`);
                    const fallbackData = await fallbackRes.json();
                    if (fallbackData.status === 'success' && fallbackData.data.image) {
                        return { type: 'api', data: fallbackData.data.image.url };
                    }
                } catch (e) {}
            }
            return { type: 'html', data: html };
        };

        try {
            const result = await fetchWithFallback(targetUrl);
            if (result.type === 'api') { return res.status(200).json({ success: true, image: result.data }); }

            const html = result.data;
            if (!html) return res.status(200).json({ success: false });

            let imageUrl = null;

            // 1. EXTRAÇÃO ROBUSTA ETSY (Via Script JSON em vez de HTML que muda sempre)
            if (targetUrl.includes('etsy')) {
                // Tenta pegar de blocos JSON embutidos
                const scriptMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
                if (scriptMatch) {
                     try {
                         const json = JSON.parse(scriptMatch[1]);
                         if (json.image) imageUrl = json.image;
                         if (Array.isArray(json) && json[0]?.image) imageUrl = json[0].image;
                     } catch(e) {}
                }
                // Fallback regex HTML
                if (!imageUrl) {
                    const etsyMatch = html.match(/src=["'](https:\/\/i\.etsystatic\.com\/[^"']+\/r\/il\/[^"']+)["']/i);
                    if (etsyMatch) imageUrl = etsyMatch[1];
                }
            }
            
            // 2. EXTRAÇÃO JSON-LD GENÉRICA
            if (!imageUrl) {
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
            }

            // 3. FALLBACKS ESPECÍFICOS DE GRID
            if (!imageUrl) {
                if (targetUrl.includes('shutterstock')) {
                     const gridImg = html.match(/src=["'](https:\/\/image\.shutterstock\.com\/image-[^"']+)["']/i);
                     if (gridImg) imageUrl = gridImg[1];
                }
                else if (targetUrl.includes('patternbank')) {
                     const pbMatch = html.match(/class=["']design-image["'][^>]*src=["']([^"']+)["']/i); 
                     if (pbMatch) imageUrl = pbMatch[1];
                     if (!imageUrl) {
                         const pbLazy = html.match(/data-src=["'](https:\/\/s3\.amazonaws\.com\/patternbank[^"']+)["']/i);
                         if (pbLazy) imageUrl = pbLazy[1];
                     }
                }
            }

            if (!imageUrl) {
                const metaMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']\s*\/?>/i);
                if (metaMatch) imageUrl = metaMatch[1];
            }

            if (!imageUrl) return res.status(200).json({ success: false });
            
            if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
            imageUrl = imageUrl.replace(/&amp;/g, '&');
            if (imageUrl.includes('75x75')) imageUrl = imageUrl.replace('75x75', '300x300');
            
            return res.status(200).json({ success: true, image: imageUrl });

        } catch (err) {
            return res.status(200).json({ success: false, error: err.message });
        }
    }

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
            const googleResponse = await fetch(imageEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!googleResponse.ok) throw new Error("Google GenAI Error");
            const data = await googleResponse.json();
            const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
            if (!imagePart) return res.status(200).json({ success: false });
            return res.status(200).json({ success: true, image: `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}` });
        } catch (e) { return res.status(200).json({ success: false }); }
    }

    if (action === 'DESCRIBE_PATTERN') {
        if (!apiKey) return res.status(500).json({ error: "No Key" });
        try {
            const visionEndpoint = genAIEndpoint('gemini-2.5-flash');
            const MASTER_VISION_PROMPT = `
            ACT AS: Senior Textile Designer.
            TASK 1: Deconstruct the Artistic Technique (Visual DNA).
            TASK 2: Extract 5 Dominant Pantone Colors.
            TASK 3: Generate 30 High-Quality Search URLs (Shutterstock, Patternbank, etc).
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

    if (action === 'SCAN_CLOTHING' || !action) { 
        if (!apiKey) return res.status(503).json({ error: "Backend Unavailable" });
        const GLOBAL_SEARCH_PROMPT = `
        VOCÊ É: VINGI AI, O Melhor Buscador de Moldes.
        TAREFA: Encontrar MOLDES (Sewing Patterns).
        PROBLEMA: Não use links diretos antigos. USE SEARCH QUERIES.
        QUANTIDADE: 40 resultados (15 Exatos, 15 Próximos, 10 Ousados).
        PASSO 1: DNA Técnico.
        PASSO 2: Gere LINKS DE BUSCA (Etsy, Burda, Vikisews).
        JSON OUTPUT: { "patternName": "...", "technicalDna": {}, "matches": { "exact": [], "close": [], "adventurous": [] }, "curatedCollections": [] }
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
