
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
    const { action, prompt, colors, mainImageBase64, mainMimeType, secondaryImageBase64, secondaryMimeType, targetUrl, backupSearchTerm } = req.body;
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY || process.env.VITE_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;
    
    // --- MOTOR DE SCRAPING HÍBRIDO (GET_LINK_PREVIEW) ---
    // Mantido e otimizado para usar o termo contextual
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
            setTimeout(() => controller.abort(), 10000); 
            try {
                const response = await fetch(url, { headers: browserHeaders, signal: controller.signal });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.text();
            } catch (e) {
                return null;
            }
        };

        const fallbackToImageSearch = async (term) => {
            if (!term) return null;
            
            // LIMPEZA E CONTEXTO ESPECÍFICO
            // A query agora inclui o nome do site (vinda do backupSearchTerm) para tentar achar imagens daquele site no Bing.
            // Removemos 'sewing pattern' da string bruta se ela já estiver lá para evitar duplicação
            let cleanTerm = term.replace(/sewing pattern/gi, '').trim();
            
            // Query Contextual: "Burda Style Mini Dress Pattern"
            // Isso aumenta a chance de achar a imagem correta mesmo no Bing
            const query = `${cleanTerm} sewing pattern -car -vehicle -auto -wheel -machine`;
            
            const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&scenario=ImageBasicHover`;
            const html = await fetchHtml(searchUrl);
            if (!html) return null;
            
            const murlMatch = html.match(/&quot;murl&quot;:&quot;(https?:\/\/[^&]+)&quot;/);
            if (murlMatch) return murlMatch[1];
            
            const murlMatch2 = html.match(/"murl":"(https?:\/\/[^"]+)"/);
            if (murlMatch2) return murlMatch2[1];

            const imgMatch = html.match(/src="(https:\/\/tse\d\.mm\.bing\.net\/th\?id=[^"]+)"/);
            if (imgMatch) return imgMatch[1];

            return null;
        };

        try {
            let imageUrl = null;
            const isSearchPage = targetUrl.includes('/search') || targetUrl.includes('google.com') || targetUrl.includes('bing.com');
            
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
                    if (!imageUrl) {
                        if (targetUrl.includes('etsy')) {
                            const etsy = html.match(/src="(https:\/\/i\.etsystatic\.com\/[^"]+il_[^"]+\.jpg)"/i);
                            if (etsy) imageUrl = etsy[1];
                        }
                    }
                }
            }

            if (!imageUrl && backupSearchTerm) {
                imageUrl = await fallbackToImageSearch(backupSearchTerm);
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

    // --- ROTA PRINCIPAL: SCANNER DE MOLDES (INTELECTO REFINADO) ---
    if (action === 'SCAN_CLOTHING' || !action) { 
        if (!apiKey) return res.status(503).json({ error: "Backend Unavailable" });
        
        // 1. ANÁLISE PROFUNDA E GERAÇÃO DE QUERY DE CAUDA LONGA
        const SEARCH_GEN_PROMPT = `
        ACT AS: Senior Pattern Maker & Fashion Tech Expert.
        TASK: Analyze the garment in the image to find the EXACT sewing pattern online.
        
        CRITICAL: Identify the specific attributes (Silhouette + Neckline + Sleeve + Length + Details).
        
        OUTPUT JSON:
        {
          "patternName": "Technical Name (e.g. 'Milkmaid Bodice Mini Dress', 'Wide Leg Pleated Trousers')",
          "technicalDna": { 
             "silhouette": "Specific Silhouette (e.g. A-Line, Bodycon, Boxy)", 
             "neckline": "Specific Neckline (e.g. Square, Cowl, Sweetheart)",
             "details": "Key construction details (e.g. Puff sleeves, Darted bodice)"
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
        
        // 2. Lógica de Busca Aprimorada
        // Usamos a 'searchQuery' (cauda longa) gerada pela IA, não apenas o nome simples.
        const mainQuery = analysis.searchQuery || `${analysis.patternName} sewing pattern`;
        const shortName = analysis.patternName;

        // Função de Link Refinada: Inclui o NOME DA LOJA no termo de backup
        // Isso força o Bing Images a achar uma imagem visualmente coerente com a loja (ex: "Burda Style dress").
        const createRealLink = (source, type, urlBase, termQuery, score) => ({
            source,
            patternName: shortName, // Nome legível no Card
            type: type,
            linkType: "SEARCH_QUERY",
            url: `${urlBase}${encodeURIComponent(termQuery)}`,
            
            // TRUQUE VISUAL: O termo de backup inclui a FONTE. 
            // Se o site oficial falhar, o Bing busca "Burda Style Square Neck Dress Pattern"
            // Isso aumenta drasticamente a chance da miniatura parecer com o site original.
            backupSearchTerm: `${source} ${termQuery}`, 
            
            similarityScore: score,
            imageUrl: null 
        });

        // Usamos a query detalhada para todos os motores de busca
        const matches = {
            exact: [
                createRealLink("Etsy Global", "PAGO", "https://www.etsy.com/search?q=", mainQuery, 98),
                createRealLink("Burda Style", "PAGO", "https://www.burdastyle.com/catalogsearch/result/?q=", mainQuery, 95),
                createRealLink("Vikisews", "PREMIUM", "https://vikisews.com/search/?q=", mainQuery, 92),
            ],
            close: [
                createRealLink("Makerist", "INDIE", "https://www.makerist.com/search?q=", mainQuery, 88),
                createRealLink("The Fold Line", "INDIE", "https://thefoldline.com/?s=", mainQuery, 85),
                createRealLink("Google Shopping", "GERAL", "https://www.google.com/search?tbm=shop&q=", mainQuery, 80),
            ],
            adventurous: [
                createRealLink("Pinterest Ideas", "INSPIRACAO", "https://www.pinterest.com/search/pins/?q=", `${mainQuery} outfit`, 75),
                createRealLink("Youtube Tutorials", "VIDEO", "https://www.youtube.com/results?search_query=", `How to sew ${shortName}`, 70)
            ]
        };

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
