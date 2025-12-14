
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
            // Headers de Navegador Real para evitar bloqueios 403
            const commonHeaders = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Upgrade-Insecure-Requests': '1'
            };
            
            const siteRes = await fetch(targetUrl, { headers: commonHeaders });
            if (!siteRes.ok) throw new Error(`Site bloqueou (${siteRes.status})`);
            const html = await siteRes.text();
            
            let imageUrl = null;
            
            // --- ESTRATÉGIA DE EXTRAÇÃO DE IMAGEM ---

            // 1. JSON-LD (E-commerce Structure) - Geralmente a melhor qualidade
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

            // 2. Open Graph / Twitter Cards (Metadados Sociais)
            if (!imageUrl) {
                const metaRegex = /<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']\s*\/?>/i;
                const match = html.match(metaRegex);
                if (match) imageUrl = match[1];
            }

            // 3. Seletores Específicos por Site (Scraping Visual)
            if (!imageUrl) {
                // Shutterstock (Busca ou Produto)
                if (targetUrl.includes('shutterstock')) {
                     // Tenta pegar a primeira imagem da galeria de busca
                     const galleryMatch = html.match(/src=["'](https:\/\/image\.shutterstock\.com\/image-[^"']+)["']/i);
                     if (galleryMatch) imageUrl = galleryMatch[1];
                     // Tenta imagem de preview maior
                     if (!imageUrl) {
                        const previewMatch = html.match(/<img[^>]+data-src=["']([^"']+)["'][^>]*class=["'].*?jss.*?["']/i); 
                        if (previewMatch) imageUrl = previewMatch[1];
                     }
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
                // Spoonflower
                if (targetUrl.includes('spoonflower')) {
                    const sfMatch = html.match(/src=["'](https:\/\/s3\.amazonaws\.com\/spoonflower[^"']+)["']/i);
                    if (sfMatch) imageUrl = sfMatch[1];
                }
            }

            if (!imageUrl) return res.status(200).json({ success: false });
            
            // Sanitização da URL
            if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
            imageUrl = imageUrl.replace(/&amp;/g, '&');
            
            return res.status(200).json({ success: true, image: imageUrl });

        } catch (err) {
            return res.status(200).json({ success: false, error: err.message });
        }
    }

    // ==========================================================================================
    // ROTA 1: GERAÇÃO DE ESTAMPA (GEMINI IMAGEN)
    // ==========================================================================================
    if (action === 'GENERATE_PATTERN') {
        if (!apiKey) return res.status(401).json({ success: false, error: "Missing API Key" });

        try {
            // Tenta usar o modelo de imagem do Google primeiro (Melhor qualidade)
            const imageEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
            
            const colorInstruction = colors && colors.length > 0 
                ? `STRICT COLOR PALETTE (Use mainly these): ${colors.map(c => c.name).join(', ')}.`
                : '';

            // PROMPT DE DESIGNER SÊNIOR
            const finalPrompt = `
            ACT AS: World-Class Textile Designer.
            TASK: Create a High-End Seamless Pattern based on this description:
            "${prompt}"
            
            TECHNICAL SPECS:
            - TECHNIQUE: ${prompt.includes('watercolor') ? 'Wet-on-wet watercolor technique, fluid edges, painterly feel.' : 'Clean vector lines, precise geometry, crisp edges.'}
            - COMPOSITION: Balanced repeat, no visible grid lines, professional flow.
            - QUALITY: 8K resolution, detailed texture, commercial grade fabric print.
            - LOGIC: Ensure floral/geometric elements overlap naturally. Maintain consistent line weight.
            ${colorInstruction}
            
            OUTPUT: A single seamless tile. Flat lay. No perspective.
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
            
            if (!imagePart) return res.status(200).json({ success: false }); // Falha silenciosa para fallback
            
            return res.status(200).json({ success: true, image: `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}` });
        } catch (e) {
            // Se o Gemini falhar, retorna false para o frontend usar o Pollinations
            return res.status(200).json({ success: false }); 
        }
    }

    // ==========================================================================================
    // ROTA 2: PATTERN STUDIO - ANÁLISE TÉCNICA PROFUNDA
    // ==========================================================================================
    if (action === 'DESCRIBE_PATTERN') {
         if (!apiKey) return res.status(500).json({ error: "No Key" });

        try {
            const visionEndpoint = genAIEndpoint('gemini-2.5-flash');
            
            const MASTER_VISION_PROMPT = `
            ACT AS: Senior Textile Designer & Print Engineer.
            
            TASK 1: DECONSTRUCT THE ARTISTIC TECHNIQUE (Visual DNA).
            Analyze the image and describe it for a generative AI. Be extremely technical:
            - LINE QUALITY: Is it monoline, variable width, ink bleed, or vector crisp?
            - BRUSHWORK: Is it dry brush, wet-on-wet watercolor, gouache opacity, or digital airbrush?
            - MOTIF LOGIC: How do elements interact? (Overlapping, tossing, ogee grid, foulard).
            - STYLE: Identify the specific art movement (e.g., Liberty London, Bauhaus, Arts & Crafts, Tropical Maximalism).
            
            TASK 2: Extract 5 Dominant Pantone Colors (Name + Hex).
            
            TASK 3: Generate 30 (THIRTY) High-Quality Search URLs.
            Crucial: Create SMART SEARCH QUERIES. Do not look for specific IDs. Look for the STYLE.
            
            SOURCES: Shutterstock, Patternbank, Adobe Stock, Spoonflower, Creative Market, Vecteezy.
            
            Example: If image is "Watercolor Floral", create:
            - "https://www.shutterstock.com/search/watercolor+floral+seamless+pattern+hand+painted"
            - "https://www.patternbank.com/search?q=painted+tropical+flowers"

            JSON OUTPUT:
            { 
              "prompt": "Professional textile design, [Technique Details], [Motif Logic], [Style], seamless repeat...",
              "colors": [{ "name": "...", "code": "...", "hex": "..." }],
              "stockMatches": [
                 ... GENERATE 30 ITEMS ...
                 { 
                   "source": "Site Name", 
                   "patternName": "Descriptive Name (e.g. Lush Watercolor Tropical)", 
                   "type": "ROYALTY-FREE", 
                   "linkType": "SEARCH_QUERY", 
                   "url": "https://site.com/search?q=...",
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
        VOCÊ É: VINGI AI, O Maior Modelista Técnico do Mundo.
        MISSÃO: Analisar a foto da roupa e encontrar MOLDES DE COSTURA (Sewing Patterns).

        PASSO 1: Extraia o DNA Técnico (Silhueta, Decote, Manga).
        PASSO 2: BUSCA MASSIVA (Gere 30-40 resultados).
        
        IMPORTANTE: Construa LINKS DE BUSCA (SEARCH QUERY) inteligentes em Inglês.
        Ex: "https://www.etsy.com/search?q=puff+sleeve+wrap+dress+sewing+pattern"

        ESTRUTURA JSON:
        {
          "patternName": "Nome Técnico em PT-BR",
          "category": "Categoria",
          "technicalDna": { "silhouette": "...", "neckline": "...", "sleeve": "...", "fabricStructure": "..." },
          "matches": { 
             "exact": [ ... min 10 itens ... ], 
             "close": [ ... min 10 itens ... ], 
             "adventurous": [ ... min 10 itens ... ] 
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
        
        if (!jsonResult.matches.exact.length && !jsonResult.matches.close.length) {
            jsonResult.matches.exact.push({
                source: "Google Shopping",
                patternName: "Busca Automática",
                type: "BUSCA",
                linkType: "SEARCH_QUERY",
                url: `https://www.google.com/search?q=${encodeURIComponent(jsonResult.patternName + " molde costura pattern")}`,
                similarityScore: 80
            });
        }
        
        return res.status(200).json(jsonResult);
    }
    
    return res.status(200).json({ success: false });

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(503).json({ error: "Service Unavailable" });
  }
}
