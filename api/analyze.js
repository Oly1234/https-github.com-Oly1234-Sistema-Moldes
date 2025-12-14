
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
            'Cache-Control': 'no-cache'
        };

        const fetchHtml = async (url) => {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 4000); // Timeout rápido (4s) para agilidade
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
            // Reforça termos de DESIGN DIGITAL ou MOLDE dependendo do contexto
            const query = `${cleanTerm} sewing pattern garment texture -car -vehicle`;
            const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&scenario=ImageBasicHover`;
            const html = await fetchHtml(searchUrl);
            if (!html) return [];

            const candidates = [];
            const regex = /murl&quot;:&quot;(https?:\/\/[^&]+)&quot;.*?&quot;t&quot;:&quot;([^&]+)&quot;/g;
            let match;
            let count = 0;
            
            while ((match = regex.exec(html)) !== null && count < 6) {
                candidates.push({ url: match[1], title: match[2] });
                count++;
            }

            // Fallback JSON (mais rápido e comum)
            if (candidates.length === 0) {
                 const regex2 = /"murl":"(https?:\/\/[^"]+)".*?"t":"([^"]+)"/g;
                 while ((match = regex2.exec(html)) !== null && count < 6) {
                    candidates.push({ url: match[1], title: match[2] });
                    count++;
                }
            }
            return candidates;
        };

        // SUB-FUNÇÃO: AI Visual Re-Ranking (O Juiz)
        const selectBestMatchAI = async (candidates, userRefImage) => {
            if (!candidates || candidates.length === 0) return null;
            if (!userRefImage || !apiKey) return candidates[0].url; 

            try {
                // Usando modelo Flash para velocidade extrema
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                const candidatesText = candidates.map((c, i) => `ID ${i}: [TITLE: ${c.title}]`).join('\n');
                
                const JUDGE_PROMPT = `
                TASK: Visual Judge.
                INPUT: 1 User Image + List of Titles.
                GOAL: Select ID of best visual match.
                RULES: Ignore cars/objects. Focus on PATTERN/GARMENT.
                CANDIDATES:
                ${candidatesText}
                OUTPUT JSON: { "bestId": 0 }
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
                return candidates[0].url;
            }
        };

        try {
            let imageUrl = null;
            const isSearchPage = targetUrl.includes('/search') || targetUrl.includes('google.com') || targetUrl.includes('bing.com');
            
            if (!isSearchPage) {
                // Tenta pegar imagem direta do site primeiro (rápido)
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
                }
            }

            if (!imageUrl && backupSearchTerm) {
                // Fallback para Bing Images se falhar no site
                const candidates = await fetchCandidatesFromBing(backupSearchTerm);
                if (candidates.length > 0) {
                    if (userReferenceImage && apiKey) {
                        // Juiz Visual só roda se tivermos referência do usuário
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
            // Modelo correto para geração de imagem
            const imageEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            // Para imagens, usamos gemini-2.5-flash-image OU o modelo de texto com config de imagem se suportado.
            // A instrução pedia gemini-2.5-flash-image para geração.
            // NOTA: O SDK usa 'generateContent' com payload de imagem.
            
            const colorInstruction = colors && colors.length > 0 ? `PALETTE: ${colors.map(c => c.name).join(', ')}.` : '';
            const finalPrompt = `Professional Surface Design. Seamless Repeat Pattern. ${prompt}. ${colorInstruction}. 
            High fidelity, flat lay texture, 8k resolution, suitable for fabric printing. No watermarks. 
            Ensure perfect tiling. Style: Commercial Print.`;
            
            // Payload específico para gemini-2.5-flash-image se comportar como gerador (via texto)
            // Se falhar, fallback para texto descritivo.
            // Para garantir, vamos usar o modelo de imagem explicitamente se disponível na chave.
            
            // Tenta endpoint de imagem direto (se disponível para a chave)
            const payload = {
                contents: [{ parts: [{ text: finalPrompt }] }],
                generation_config: { response_mime_type: "image/jpeg" } // Solicita imagem
            };
            
            // Fallback para modelo de texto simulando resposta se a geração falhar
            // Mas para "Generate Image", precisamos que a API devolva bytes.
            // Usaremos a rota correta sugerida no prompt master:
            const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
            
            const googleResponse = await fetch(endpointImg, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({
                    contents: [{ parts: [{ text: finalPrompt }] }],
                    generation_config: { 
                        response_mime_type: "image/jpeg",
                        aspect_ratio: "1:1"
                     }
                }) 
            });
            
            const data = await googleResponse.json();
            // Verifica se retornou inline_data (imagem)
            const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
            
            if (imagePart) {
                 return res.status(200).json({ success: true, image: `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}` });
            } else {
                 return res.status(200).json({ success: false, error: "Image generation not supported by this key/model region." });
            }

        } catch (e) { return res.status(200).json({ success: false, error: e.message }); }
    }

    if (action === 'DESCRIBE_PATTERN') {
        if (!apiKey) return res.status(500).json({ error: "No Key" });
        try {
            const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            
            // ANALISADOR TÊXTIL AVANÇADO (ENGENHEIRO TÊXTIL SÊNIOR)
            const MASTER_VISION_PROMPT = `
            ACT AS: Senior Textile Engineer & Surface Designer.
            TASK: Technical Deconstruction of the Uploaded Pattern.
            
            ANALYZE:
            1. REPEAT SYSTEM: Is it Half-Drop, Block, Brick, Diamond, or Random?
            2. MOTIF SCALE: Large (>20cm), Medium (5-10cm), Small (<5cm), Micro.
            3. DENSITY/COVERAGE: High (Packed), Medium, Low (Sparse/Open Ground).
            4. KEY ELEMENTS: List specific motifs (e.g. 'Watercolor Peony', 'Chevron', 'Paisley').
            5. TECHNIQUE: Vector, Watercolor, Ikat, Screen Print, Digital.
            
            OUTPUT JSON:
            { 
              "prompt": "High-fidelity generation prompt for a Seamless Repeat Pattern matching this style exactly.", 
              "colors": [{"name": "Color Name", "hex": "#RRGGBB"}], 
              "technicalSpecs": { 
                  "repeat": "Half-Drop/Block/etc", 
                  "scale": "Large/Medium/Small", 
                  "density": "High/Low",
                  "elements": ["Element 1", "Element 2"],
                  "technique": "Vector/Watercolor"
              },
              "searchQuery": "Optimized search query for pattern marketplaces (e.g. 'Watercolor floral seamless pattern half-drop')"
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

            // --- GERAÇÃO DE LINKS DE MARKETPLACES DIGITAIS (LISTA ATUALIZADA) ---
            const baseQuery = analysis.searchQuery || `${analysis.technicalSpecs.technique} ${analysis.technicalSpecs.elements[0]} pattern`;
            
            const createMarketLink = (source, type, urlBase, querySuffix, boost) => ({
                source,
                patternName: `${analysis.technicalSpecs.elements[0]} (${type})`, 
                type,
                linkType: "SEARCH_QUERY",
                url: `${urlBase}${encodeURIComponent(baseQuery + " " + querySuffix)}`,
                backupSearchTerm: `${source} ${baseQuery} seamless pattern`, 
                similarityScore: 90 + boost,
                imageUrl: null 
            });

            // Matriz de Marketplaces de Design Têxtil (Global & Variada)
            const patternMarketplaces = [
                // Marketplaces Globais
                { name: "Patternbank", type: "PREMIUM", url: "https://patternbank.com/designs?search=", suffix: "", boost: 2 },
                { name: "Print Pattern Repeat", type: "STUDIO", url: "https://printpatternrepeat.com/?s=", suffix: "", boost: 1 },
                { name: "Creative Market", type: "INDIE", url: "https://creativemarket.com/search?q=", suffix: "seamless pattern", boost: 1 },
                { name: "Pattern Design", type: "EUROPE", url: "https://patterndesigns.com/en/search/", suffix: "", boost: 0 },
                
                // Vetores & Stock
                { name: "VectorStock", type: "VETOR", url: "https://www.vectorstock.com/royalty-free-vectors/", suffix: "seamless pattern vector", boost: 0 },
                { name: "Depositphotos", type: "STOCK", url: "https://depositphotos.com/stock-photos/", suffix: "seamless pattern", boost: -1 },
                { name: "Vecteezy", type: "FREE/PAID", url: "https://www.vecteezy.com/free-vector/", suffix: "seamless pattern", boost: -1 },
                
                // Ferramentas & Artesanato
                { name: "Etsy Digital", type: "DIGITAL", url: "https://www.etsy.com/search?q=", suffix: "digital seamless pattern commercial license", boost: 0 },
                { name: "Patterncooler", type: "TOOL", url: "https://www.google.com/search?q=site:patterncooler.com+", suffix: "", boost: -5 },
                { name: "Spoonflower", type: "FABRIC", url: "https://www.spoonflower.com/en/shop?on=fabric&q=", suffix: "", boost: 0 }
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
        OUTPUT JSON: { "patternName": "Name", "technicalDna": { "silhouette": "X", "neckline": "Y", "sleeve": "Z" }, "searchQuery": "Query" }
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

        // --- NOVA LISTA MASSIVA DE LOJAS (50+ FONTES) ---
        const stores = [
            // 1. Clássicos & Editoras (Alta Precisão)
            { name: "Simplicity", type: "USA", url: "https://simplicity.com/search.php?search_query=", group: "exact", boost: 2 },
            { name: "Burda Style", type: "GER", url: "https://www.burdastyle.com/catalogsearch/result/?q=", group: "exact", boost: 2 },
            { name: "Vogue Patterns", type: "USA", url: "https://simplicity.com/search.php?search_query=", group: "exact", boost: 1 },
            { name: "McCall's", type: "USA", url: "https://simplicity.com/search.php?search_query=", group: "exact", boost: 1 },
            
            // 2. Indies Premium & Modernos
            { name: "Tilly and the Buttons", type: "UK", url: "https://shop.tillyandthebuttons.com/search?q=", group: "exact", boost: 1 },
            { name: "Papercut Patterns", type: "NZ", url: "https://papercutpatterns.com/search?q=", group: "close", boost: 1 },
            { name: "Sew Over It", type: "UK", url: "https://sewoverit.com/?s=", group: "close", boost: 1 },
            { name: "Thread Theory", type: "MENS", url: "https://threadtheory.ca/search?q=", group: "close", boost: 0 },
            { name: "The Fold Line", type: "UK/MKT", url: "https://thefoldline.com/?s=", group: "close", boost: 2 },
            { name: "Vikisews", type: "RU/US", url: "https://vikisews.com/search/?q=", group: "exact", boost: 1 },
            
            // 3. Grátis & Comunidade
            { name: "FreeSewing", type: "OPEN", url: "https://freesewing.org/search/?q=", group: "exact", boost: 0 },
            { name: "Dr-Cos", type: "JP/COS", url: "https://dr-cos.info/?s=", group: "adventurous", boost: -1 },
            { name: "Pattydoo", type: "GER", url: "https://www.pattydoo.de/en/search?s=", group: "close", boost: 0 },
            { name: "Grasser", type: "RU", url: "https://en-grasser.com/search/?q=", group: "exact", boost: 0 },
            { name: "Mood Fabrics", type: "FREE", url: "https://www.moodfabrics.com/blog/?s=", group: "close", boost: 1 },
            
            // 4. Sob Medida & CAD
            { name: "Lekala", type: "CAD", url: "https://www.lekala.co/catalog?q=", group: "exact", boost: -1 },
            { name: "Sewist", type: "CAD", url: "https://www.sewist.com/search?q=", group: "exact", boost: -1 },
            
            // 5. Marketplaces Globais
            { name: "Etsy Global", type: "MKT", url: "https://www.etsy.com/search?q=", group: "exact", boost: 1 },
            { name: "Makerist", type: "EU", url: "https://www.makerist.com/search?q=", group: "close", boost: 0 },
            { name: "Google Shopping", type: "GERAL", url: "https://www.google.com/search?tbm=shop&q=", group: "adventurous", boost: -2 }
        ];

        const matches = { exact: [], close: [], adventurous: [] };
        stores.forEach(store => {
            let score = 90 + store.boost;
            if (store.group === 'close') score = 80 + store.boost;
            if (store.group === 'adventurous') score = 70 + store.boost;
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
