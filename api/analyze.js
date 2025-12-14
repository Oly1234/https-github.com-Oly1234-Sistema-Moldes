
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
            // Reforça termos de DESIGN DIGITAL
            const query = `${cleanTerm} seamless pattern digital print vector texture -car -vehicle -auto -wheel -machine`;
            const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&scenario=ImageBasicHover`;
            const html = await fetchHtml(searchUrl);
            if (!html) return [];

            const candidates = [];
            const regex = /murl&quot;:&quot;(https?:\/\/[^&]+)&quot;.*?&quot;t&quot;:&quot;([^&]+)&quot;/g;
            let match;
            let count = 0;
            
            while ((match = regex.exec(html)) !== null && count < 8) {
                candidates.push({ url: match[1], title: match[2] });
                count++;
            }

            if (candidates.length === 0) {
                 const regex2 = /"murl":"(https?:\/\/[^"]+)".*?"t":"([^"]+)"/g;
                 while ((match = regex2.exec(html)) !== null && count < 8) {
                    candidates.push({ url: match[1], title: match[2] });
                    count++;
                }
            }

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
            if (!userRefImage || !apiKey) return candidates[0].url; 

            try {
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                const candidatesText = candidates.map((c, i) => `ID ${i}: [TITLE: ${c.title}]`).join('\n');
                
                const JUDGE_PROMPT = `
                TASK: Visual Curator - Pattern Design.
                INPUT: 1 Reference Image (Source Pattern) + List of Search Results (Titles).
                GOAL: Select the ID of the image that BEST matches the print design/motif.
                
                CRITICAL RULES:
                1. ELIMINATE REAL WORLD OBJECTS (Cars, People, Furniture). Look for FLAT SWATCHES, DIGITAL PRINTS, VECTORS.
                2. Match the visual vibe (floral, geometric, tropical) and color palette.
                3. Prioritize "Seamless", "Vector", "Print", "Texture".
                
                CANDIDATES:
                ${candidatesText}
                
                OUTPUT JSON ONLY: { "bestId": 0 }
                `;

                const payload = {
                    contents: [{
                        parts: [
                            { text: JUDGE_PROMPT },
                            { inline_data: { mime_type: "image/jpeg", data: userRefImage } } 
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
                console.error("AI Judging failed", e);
                return candidates[0].url;
            }
        };

        try {
            let imageUrl = null;
            const isSearchPage = targetUrl.includes('/search') || targetUrl.includes('google.com') || targetUrl.includes('bing.com');
            
            if (!isSearchPage) {
                const html = await fetchHtml(targetUrl);
                if (html) {
                     // Lógica de extração de imagem oficial
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
                }
            }

            if (!imageUrl && backupSearchTerm) {
                const candidates = await fetchCandidatesFromBing(backupSearchTerm);
                if (candidates.length > 0) {
                    if (userReferenceImage && apiKey) {
                        imageUrl = await selectBestMatchAI(candidates, userReferenceImage);
                    } else {
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
            return res.status(200).json({ success: false, error: err.message });
        }
    }

    if (action === 'GENERATE_PATTERN') {
        if (!apiKey) return res.status(401).json({ success: false, error: "Missing API Key" });
        try {
            const imageEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
            const colorInstruction = colors && colors.length > 0 ? `PALETTE: ${colors.map(c => c.name).join(', ')}.` : '';
            const finalPrompt = `Professional Textile Design. Seamless Repeat Pattern. ${prompt}. ${colorInstruction}. High fidelity, flat lay texture, 8k resolution, suitable for fabric printing. No watermarks.`;
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
            
            // ANALISADOR TÊXTIL AVANÇADO (CURADORIA DIGITAL)
            const MASTER_VISION_PROMPT = `
            ACT AS: Senior Surface Designer & Digital Curator.
            TASK: Analyze the image to find matching DIGITAL SEAMLESS PATTERNS on marketplaces.
            
            METHODOLOGY:
            1. Analyze Grid: Is it Half-Drop, Block, Geometric, Floral?
            2. Extract Key Motifs: (e.g. "Watercolor Peony", "Bauhaus Geometric", "Tropical Palm").
            3. Determine Style: (e.g. "Vector", "Hand Painted", "Minimalist").
            
            OUTPUT JSON:
            { 
              "prompt": "Highly technical prompt describing the seamless repeat structure (e.g. 'Seamless half-drop repeat of watercolor roses...')", 
              "colors": [{"name": "Color Name", "hex": "#RRGGBB"}], 
              "technicalSpecs": { "repeat": "Type", "motif": "Main Element", "style": "Style Name" },
              "searchQuery": "Optimized search query for digital marketplaces (e.g. 'Watercolor blush floral seamless pattern')"
            }
            `;
            
            const visionPayload = {
                contents: [{ parts: [{ text: MASTER_VISION_PROMPT }, { inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }] }],
                generation_config: { response_mime_type: "application/json" }
            };
            
            const visionRes = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(visionPayload) });
            const visionData = await visionRes.json();
            const text = visionData.candidates?.[0]?.content?.parts?.[0]?.text;
            const analysis = JSON.parse(cleanJson(text));

            // --- GERAÇÃO DE LINKS DE MARKETPLACES DIGITAIS ---
            const baseQuery = analysis.searchQuery || `${analysis.technicalSpecs.style} ${analysis.technicalSpecs.motif}`;
            
            const createMarketLink = (source, type, urlBase, querySuffix, boost) => ({
                source,
                patternName: `${analysis.technicalSpecs.motif} (${type})`, 
                type,
                linkType: "SEARCH_QUERY",
                url: `${urlBase}${encodeURIComponent(baseQuery + " " + querySuffix)}`,
                backupSearchTerm: `${source} ${baseQuery} seamless pattern`, 
                similarityScore: 90 + boost,
                imageUrl: null 
            });

            // Matriz de Marketplaces de Design Têxtil (Global)
            const patternMarketplaces = [
                // Premium & Studios
                { name: "Patternbank", type: "PREMIUM", url: "https://patternbank.com/designs?search=", suffix: "", boost: 2 },
                { name: "Print Pattern Repeat", type: "STUDIO", url: "https://printpatternrepeat.com/?s=", suffix: "", boost: 1 },
                { name: "Pattern Design", type: "EUROPE", url: "https://patterndesigns.com/en/search/", suffix: "", boost: 0 },
                
                // Marketplaces Independentes
                { name: "Creative Market", type: "INDIE", url: "https://creativemarket.com/search?q=", suffix: "seamless pattern", boost: 1 },
                { name: "Etsy Digital", type: "MARKETPLACE", url: "https://www.etsy.com/search?q=", suffix: "digital seamless pattern commercial license", boost: 0 },
                
                // Stock & Vetores
                { name: "VectorStock", type: "VETOR", url: "https://www.vectorstock.com/royalty-free-vectors/", suffix: "pattern vectors", boost: -1 },
                { name: "Depositphotos", type: "STOCK", url: "https://depositphotos.com/stock-photos/", suffix: "seamless pattern", boost: -1 },
                { name: "Adobe Stock", type: "PRO", url: "https://stock.adobe.com/search?k=", suffix: "seamless pattern", boost: -1 },
                
                // Freemium / Tools
                { name: "Vecteezy", type: "FREEMIUM", url: "https://www.vecteezy.com/free-vector/", suffix: "pattern", boost: -2 },
                { name: "Patterncooler", type: "TOOL", url: "https://www.google.com/search?q=site:patterncooler.com+", suffix: "", boost: -5 }
            ];

            const matches = patternMarketplaces.map(store => createMarketLink(store.name, store.type, store.url, store.suffix, store.boost));

            return res.status(200).json({ 
                success: true, 
                ...analysis,
                stockMatches: matches 
            });

        } catch (e) { 
            console.error(e);
            return res.status(500).json({ error: "Vision Failed" }); 
        }
    }

    if (action === 'SCAN_CLOTHING' || !action) { 
        if (!apiKey) return res.status(503).json({ error: "Backend Unavailable" });
        
        const SEARCH_GEN_PROMPT = `
        ACT AS: Senior Pattern Maker.
        TASK: Analyze garment to find sewing pattern.
        OUTPUT JSON: { "patternName": "Name", "technicalDna": {}, "searchQuery": "Query" }
        `;
        
        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const parts = [{ inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }];
        parts.push({ text: SEARCH_GEN_PROMPT });
        
        const googleResponse = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) });
        const dataMain = await googleResponse.json();
        const text = dataMain.candidates?.[0]?.content?.parts?.[0]?.text;
        let analysis = JSON.parse(cleanJson(text));
        
        const mainQuery = analysis.searchQuery || `${analysis.patternName} sewing pattern`;
        const shortName = analysis.patternName;

        const createRealLink = (source, type, urlBase, termQuery, score) => ({
            source, patternName: shortName, type, linkType: "SEARCH_QUERY",
            url: `${urlBase}${encodeURIComponent(termQuery)}`,
            backupSearchTerm: `${source} ${termQuery}`, 
            similarityScore: score, imageUrl: null 
        });

        const stores = [
            { name: "Etsy Global", type: "PAGO", url: "https://www.etsy.com/search?q=", group: "exact", boost: 0 },
            { name: "Burda Style", type: "PAGO", url: "https://www.burdastyle.com/catalogsearch/result/?q=", group: "exact", boost: 0 },
            { name: "Vikisews", type: "PREMIUM", url: "https://vikisews.com/search/?q=", group: "exact", boost: 0 },
            { name: "The Fold Line", type: "INDIE", url: "https://thefoldline.com/?s=", group: "close", boost: 0 },
            { name: "Makerist", type: "INDIE", url: "https://www.makerist.com/search?q=", group: "close", boost: 0 },
            { name: "Google Shopping", type: "GERAL", url: "https://www.google.com/search?tbm=shop&q=", group: "adventurous", boost: 0 },
            { name: "Pinterest", type: "INSPIRACAO", url: "https://www.pinterest.com/search/pins/?q=", group: "adventurous", boost: -5 }
        ];

        const matches = { exact: [], close: [], adventurous: [] };
        stores.forEach(store => {
            let score = 95 + store.boost;
            if (store.group === 'close') score = 85 + store.boost;
            if (store.group === 'adventurous') score = 75 + store.boost;
            const link = createRealLink(store.name, store.type, store.url, mainQuery, score);
            matches[store.group].push(link);
        });

        return res.status(200).json({
            patternName: analysis.patternName,
            technicalDna: analysis.technicalDna || {}, 
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
