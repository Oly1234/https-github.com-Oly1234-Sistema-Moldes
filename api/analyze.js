
export default async function handler(req, res) {
  // Headers CORS permissivos
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
    const { action, prompt, colors, mainImageBase64, mainMimeType, secondaryImageBase64, secondaryMimeType, targetUrl, backupSearchTerm, userReferenceImage } = req.body;
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY || process.env.VITE_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;
    
    // --- MOTOR DE SCRAPING HÍBRIDO (GET_LINK_PREVIEW) ---
    if (action === 'GET_LINK_PREVIEW') {
        if (!targetUrl) return res.status(400).json({ error: 'URL necessária' });
        
        const browserHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Upgrade-Insecure-Requests': '1'
        };

        const fetchHtml = async (url) => {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 8000); 
            try {
                const response = await fetch(url, { headers: browserHeaders, signal: controller.signal });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.text();
            } catch (e) {
                return null;
            }
        };

        // SUB-FUNÇÃO: Coleta MÚLTIPLOS candidatos do Bing
        const fetchCandidatesFromBing = async (term) => {
            if (!term) return [];
            let cleanTerm = term.replace(/sewing pattern/gi, '').trim();
            // Reforça termos de moda e nega veículos
            const query = `${cleanTerm} sewing pattern clothing garment -car -vehicle -auto -wheel -machine`;
            const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&scenario=ImageBasicHover`;
            const html = await fetchHtml(searchUrl);
            if (!html) return [];

            const candidates = [];
            // Regex para capturar murl (URL da imagem) e t (Título/Contexto)
            // Bing estrutura: murl:"url", ..., t:"Título"
            const regex = /murl&quot;:&quot;(https?:\/\/[^&]+)&quot;.*?&quot;t&quot;:&quot;([^&]+)&quot;/g;
            let match;
            let count = 0;
            
            // Tenta o formato encoded
            while ((match = regex.exec(html)) !== null && count < 8) {
                candidates.push({ url: match[1], title: match[2] });
                count++;
            }

            // Fallback para formato JSON limpo
            if (candidates.length === 0) {
                 const regex2 = /"murl":"(https?:\/\/[^"]+)".*?"t":"([^"]+)"/g;
                 while ((match = regex2.exec(html)) !== null && count < 8) {
                    candidates.push({ url: match[1], title: match[2] });
                    count++;
                }
            }

            // Fallback bruto (apenas URLs)
            if (candidates.length === 0) {
                 const imgMatch = html.match(/src="(https:\/\/tse\d\.mm\.bing\.net\/th\?id=[^"]+)"/g);
                 if (imgMatch) {
                     imgMatch.slice(0, 5).forEach(src => {
                         const cleanSrc = src.replace('src="', '').replace('"', '');
                         candidates.push({ url: cleanSrc, title: "Bing Image Result" });
                     });
                 }
            }
            
            return candidates;
        };

        // SUB-FUNÇÃO: AI Visual Re-Ranking (O Juiz)
        const selectBestMatchAI = async (candidates, userRefImage) => {
            if (!candidates || candidates.length === 0) return null;
            if (!userRefImage || !apiKey) return candidates[0].url; // Sem ref, retorna o primeiro

            try {
                // Prepara o prompt para o Gemini julgar
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                
                const candidatesText = candidates.map((c, i) => `ID ${i}: [TITLE: ${c.title}]`).join('\n');
                
                const JUDGE_PROMPT = `
                TASK: Visual Curator.
                INPUT: 1 Reference Image (User's Garment) + List of Search Results (Titles).
                GOAL: Select the ID of the image that BEST matches the garment style/category.
                
                CRITICAL RULES:
                1. ELIMINATE CARS (Mini Cooper), VEHICLES, FURNITURE. 
                2. Prioritize 'Pattern', 'Sewing', 'Dress', 'Clothing' in titles.
                3. Match the visual vibe of the reference image.
                
                CANDIDATES:
                ${candidatesText}
                
                OUTPUT JSON ONLY: { "bestId": 0 }
                `;

                // Enviamos a imagem de referência (pequena) + texto dos candidatos
                // Nota: Não enviamos as URLs das imagens candidatas para o Gemini baixar (lento/bloqueio),
                // usamos o TÍTULO/CONTEXTO para filtrar semanticamente (ex: "Mini Cooper" vs "Mini Dress")
                // e a imagem de referência para dar o contexto visual do que estamos procurando.
                const payload = {
                    contents: [{
                        parts: [
                            { text: JUDGE_PROMPT },
                            { inline_data: { mime_type: "image/jpeg", data: userRefImage } } // userRefImage já vem limpa do frontend
                        ]
                    }],
                    generation_config: { response_mime_type: "application/json" }
                };

                const response = await fetch(endpoint, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                const decision = JSON.parse(cleanJson(text));
                
                const bestIndex = decision.bestId !== undefined ? decision.bestId : 0;
                return candidates[bestIndex] ? candidates[bestIndex].url : candidates[0].url;

            } catch (e) {
                console.error("AI Judging failed, using first result", e);
                return candidates[0].url;
            }
        };

        try {
            let imageUrl = null;
            const isSearchPage = targetUrl.includes('/search') || targetUrl.includes('google.com') || targetUrl.includes('bing.com');
            
            // Tenta pegar imagem oficial primeiro
            if (!isSearchPage) {
                const html = await fetchHtml(targetUrl);
                if (html) {
                     const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
                    let match;
                    while ((match = jsonLdRegex.exec(html)) !== null) {
                        try {
                            const json = JSON.parse(match[1]);
                            const extract = (obj) => {
                                if (!obj) return null;
                                if (obj.image) return Array.isArray(obj.image) ? obj.image[0] : (typeof obj.image === 'object' ? obj.image.url : obj.image);
                                if (obj.thumbnailUrl) return obj.thumbnailUrl;
                                return null;
                            };
                            const img = extract(json) || (json.itemListElement && extract(json.itemListElement[0]?.item));
                            if (img) { imageUrl = img; break; }
                        } catch (e) {}
                    }
                    if (!imageUrl) {
                        const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
                        if (og) imageUrl = og[1];
                    }
                    if (!imageUrl && targetUrl.includes('etsy')) {
                         const etsy = html.match(/src="(https:\/\/i\.etsystatic\.com\/[^"]+il_[^"]+\.jpg)"/i);
                         if (etsy) imageUrl = etsy[1];
                    }
                }
            }

            // SE NÃO ACHOU OFICIAL OU É PÁGINA DE BUSCA -> USA O JUIZ VISUAL
            if (!imageUrl && backupSearchTerm) {
                const candidates = await fetchCandidatesFromBing(backupSearchTerm);
                if (candidates.length > 0) {
                    if (userReferenceImage && apiKey) {
                        // Usa IA para escolher a melhor entre as candidatas
                        imageUrl = await selectBestMatchAI(candidates, userReferenceImage);
                    } else {
                        // Fallback simples
                        imageUrl = candidates[0].url;
                    }
                }
            }

            if (imageUrl) {
                imageUrl = imageUrl.replace(/&amp;/g, '&');
                if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
                if (imageUrl.includes('etsystatic') && imageUrl.includes('340x270')) {
                    imageUrl = imageUrl.replace('340x270', '794xN');
                }
                return res.status(200).json({ success: true, image: imageUrl });
            }

            return res.status(200).json({ success: false, message: "No visual found" });

        } catch (err) {
            console.error("Scraper Error:", err);
            return res.status(200).json({ success: false, error: err.message });
        }
    }

    if (action === 'GENERATE_PATTERN') {
        if (!apiKey) return res.status(401).json({ success: false, error: "Missing API Key" });
        try {
            const imageEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
            const colorInstruction = colors && colors.length > 0 ? `COLORS: ${colors.map(c => c.name).join(', ')}.` : '';
            const finalPrompt = `Create a Seamless Textile Pattern. ${prompt}. ${colorInstruction}. High resolution, professional print quality.`;
            const payload = {
                contents: [{ parts: [{ text: finalPrompt }] }],
                generation_config: { aspect_ratio: "1:1" } 
            };
            const googleResponse = await fetch(imageEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await googleResponse.json();
            const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
            if (!imagePart) return res.status(200).json({ success: false });
            return res.status(200).json({ success: true, image: `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}` });
        } catch (e) { return res.status(200).json({ success: false }); }
    }

    if (action === 'DESCRIBE_PATTERN') {
        if (!apiKey) return res.status(500).json({ error: "No Key" });
        try {
            const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const MASTER_VISION_PROMPT = `
            ACT AS: Senior Textile Designer.
            TASK: Analyze the PRINT/TEXTURE.
            OUTPUT JSON:
            { "prompt": "Detailed description...", "colors": [{"name": "Name", "hex": "#RRGGBB", "code": "Code"}], "stockMatches": [] }
            `;
            const visionPayload = {
                contents: [{ parts: [{ text: MASTER_VISION_PROMPT }, { inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }] }],
                generation_config: { response_mime_type: "application/json" }
            };
            const visionRes = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(visionPayload) });
            const visionData = await visionRes.json();
            const text = visionData.candidates?.[0]?.content?.parts?.[0]?.text;
            return res.status(200).json({ success: true, ...JSON.parse(cleanJson(text)) });
        } catch (e) { return res.status(500).json({ error: "Vision Failed" }); }
    }

    // --- ROTA PRINCIPAL: SCANNER DE MOLDES (MASSIVE SEARCH) ---
    if (action === 'SCAN_CLOTHING' || !action) { 
        if (!apiKey) return res.status(503).json({ error: "Backend Unavailable" });
        
        // 1. ANÁLISE PROFUNDA E GERAÇÃO DE QUERY DE CAUDA LONGA
        const SEARCH_GEN_PROMPT = `
        ACT AS: Senior Pattern Maker & Fashion Tech Expert.
        TASK: Analyze the garment in the image to find the EXACT sewing pattern online.
        
        CRITICAL: Identify attributes for technical specification.
        
        OUTPUT JSON:
        {
          "patternName": "Technical Name (e.g. 'Milkmaid Bodice Mini Dress')",
          "technicalDna": { 
             "silhouette": "Specific Silhouette (e.g. A-Line, Bodycon, Boxy)", 
             "neckline": "Specific Neckline (e.g. Square, Cowl, Sweetheart)",
             "sleeve": "Sleeve Type (e.g. Puff, Raglan, Sleeveless)",
             "length": "Length (e.g. Mini, Midi, Floor-Length)",
             "fit": "Fit Type (e.g. Oversized, Fitted, Bias Cut)",
             "fabric": "Best Fabric Suggestion (e.g. Linen, Silk Charmeuse, Heavy Cotton)",
             "details": "Key construction details"
          },
          "searchQuery": "Highly descriptive search string optimized for search engines. Combine all details. (e.g. 'Square neck puff sleeve bodycon mini dress sewing pattern')"
        }
        `;
        
        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const parts = [{ inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }];
        parts.push({ text: SEARCH_GEN_PROMPT });
        
        const googleResponse = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) });
        
        if (!googleResponse.ok) throw new Error("Erro Gemini API");
        const dataMain = await googleResponse.json();
        const text = dataMain.candidates?.[0]?.content?.parts?.[0]?.text;
        let analysis = JSON.parse(cleanJson(text));
        
        // 2. LOGICA DE MATRIZ DE LOJAS
        const mainQuery = analysis.searchQuery || `${analysis.patternName} sewing pattern`;
        const shortName = analysis.patternName;

        const createRealLink = (source, type, urlBase, termQuery, score) => ({
            source,
            patternName: shortName, 
            type: type,
            linkType: "SEARCH_QUERY",
            url: `${urlBase}${encodeURIComponent(termQuery)}`,
            backupSearchTerm: `${source} ${termQuery}`, 
            similarityScore: score,
            imageUrl: null 
        });

        // Matriz de Fontes Globais
        const stores = [
            // Exact / Paid
            { name: "Etsy Global", type: "PAGO", url: "https://www.etsy.com/search?q=", group: "exact", boost: 0 },
            { name: "Burda Style", type: "PAGO", url: "https://www.burdastyle.com/catalogsearch/result/?q=", group: "exact", boost: 0 },
            { name: "Vikisews", type: "PREMIUM", url: "https://vikisews.com/search/?q=", group: "exact", boost: 0 },
            { name: "Simplicity", type: "CLASSICO", url: "https://simplicity.com/search.php?search_query=", group: "exact", boost: -5 },
            
            // Indie / Close
            { name: "The Fold Line", type: "INDIE", url: "https://thefoldline.com/?s=", group: "close", boost: 0 },
            { name: "Makerist", type: "INDIE", url: "https://www.makerist.com/search?q=", group: "close", boost: 0 },
            { name: "Mood Fabrics", type: "GRATIS", url: "https://www.moodfabrics.com/blog/?s=", group: "close", boost: -5 },
            { name: "Something Delightful", type: "BIG4", url: "https://somethingdelightful.com/search.php?search_query=", group: "close", boost: -5 },
            
            // Adventurous / General
            { name: "Google Shopping", type: "GERAL", url: "https://www.google.com/search?tbm=shop&q=", group: "adventurous", boost: 0 },
            { name: "Pinterest", type: "INSPIRACAO", url: "https://www.pinterest.com/search/pins/?q=", group: "adventurous", boost: -5 },
            { name: "Youtube", type: "VIDEO", url: "https://www.youtube.com/results?search_query=sewing+pattern+", group: "adventurous", boost: -10 },
            { name: "Sew Direct", type: "UK", url: "https://www.sewdirect.com/?s=", group: "close", boost: -2 },
            { name: "Grasser", type: "RUSSO", url: "https://en-grasser.com/search/?q=", group: "exact", boost: -2 },
            { name: "Peppermint Mag", type: "GRATIS", url: "https://peppermintmag.com/?s=", group: "close", boost: -5 }
        ];

        const matches = {
            exact: [],
            close: [],
            adventurous: []
        };

        stores.forEach(store => {
            let score = 95 + store.boost;
            if (store.group === 'close') score = 85 + store.boost;
            if (store.group === 'adventurous') score = 75 + store.boost;

            const link = createRealLink(store.name, store.type, store.url, mainQuery, score);
            matches[store.group].push(link);

            if (['Etsy Global', 'The Fold Line'].includes(store.name)) {
                matches[store.group].push(createRealLink(store.name + " (Variação)", store.type, store.url, `${shortName} sewing pattern`, score - 2));
            }
        });

        return res.status(200).json({
            patternName: analysis.patternName,
            technicalDna: analysis.technicalDna, 
            matches: matches,
            curatedCollections: [],
            recommendedResources: []
        });
    }
    
    return res.status(200).json({ success: false });

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(503).json({ error: "Service Unavailable" });
  }
}
