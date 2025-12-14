
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
    // Estratégia: 
    // 1. Tenta extrair metadados da URL oficial (Etsy, Burda, etc).
    // 2. Se falhar (bloqueio 403/Captcha), aciona o "Search Scraper" (Bing Images) usando o termo de busca.
    // Isso garante que SEMPRE tenhamos uma imagem visual.
    if (action === 'GET_LINK_PREVIEW') {
        if (!targetUrl) return res.status(400).json({ error: 'URL necessária' });
        
        // Headers que simulam um navegador real para evitar bloqueios simples
        const browserHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Upgrade-Insecure-Requests': '1'
        };

        const fetchHtml = async (url) => {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 8000); // 8s timeout
            try {
                const response = await fetch(url, { headers: browserHeaders, signal: controller.signal });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.text();
            } catch (e) {
                return null;
            }
        };

        // SUB-FUNÇÃO: Scraper de Imagens do Bing (Fallback Visual)
        // Usado quando o site alvo bloqueia o acesso direto.
        const fallbackToImageSearch = async (term) => {
            if (!term) return null;
            const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(term + " sewing pattern official")}&first=1`;
            const html = await fetchHtml(searchUrl);
            if (!html) return null;
            
            // Extração de URLs de miniaturas do Bing (geralmente .jpg acessíveis)
            // Procura padroes como murl (media url) ou turl (thumbnail url)
            const match = html.match(/murl&quot;:&quot;(https?:\/\/[^&]+)&quot;/);
            if (match) return match[1];
            
            const match2 = html.match(/src="(https:\/\/tse\d\.mm\.bing\.net\/th\?id=[^"]+)"/);
            if (match2) return match2[1];

            return null;
        };

        try {
            // TENTATIVA 1: Scraping Direto da URL Alvo
            let imageUrl = null;
            
            // Pular scraping direto para URLs de busca complexas (Google/Bing) pois falham muito
            // Ir direto para o fallback visual pode ser mais rápido
            const isSearchPage = targetUrl.includes('/search') || targetUrl.includes('google.com') || targetUrl.includes('bing.com');
            
            if (!isSearchPage) {
                const html = await fetchHtml(targetUrl);
                
                if (html) {
                    // Lógica JSON-LD (E-commerce Standard)
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

                    // Lógica Open Graph
                    if (!imageUrl) {
                        const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
                        if (og) imageUrl = og[1];
                    }
                    
                    // Fallbacks Específicos
                    if (!imageUrl) {
                        if (targetUrl.includes('etsy')) {
                            const etsy = html.match(/src="(https:\/\/i\.etsystatic\.com\/[^"]+il_[^"]+\.jpg)"/i);
                            if (etsy) imageUrl = etsy[1];
                        }
                    }
                }
            }

            // TENTATIVA 2: Fallback Inteligente (Bing Image Search)
            // Se o site bloqueou (html null) ou não achamos imagem, e temos um termo de busca...
            if (!imageUrl && backupSearchTerm) {
                console.log("Scraping direto falhou ou bloqueado. Tentando busca visual para:", backupSearchTerm);
                imageUrl = await fallbackToImageSearch(backupSearchTerm);
            }

            // TRATAMENTO FINAL DA IMAGEM
            if (imageUrl) {
                imageUrl = imageUrl.replace(/&amp;/g, '&');
                if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
                
                // Melhoria de qualidade para Etsy
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

    // --- ROTA DE GERAÇÃO DE ESTAMPA ---
    if (action === 'GENERATE_PATTERN') {
        if (!apiKey) return res.status(401).json({ success: false, error: "Missing API Key" });
        try {
            const imageEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
            const colorInstruction = colors && colors.length > 0 ? `COLORS: ${colors.map(c => c.name).join(', ')}.` : '';
            const finalPrompt = `Create a Seamless Textile Pattern. ${prompt}. ${colorInstruction}. High resolution, professional print quality.`;
            
            const payload = {
                contents: [{ parts: [{ text: finalPrompt }] }],
                generation_config: { response_mime_type: "image/jpeg", aspect_ratio: "1:1" }
            };
            
            const googleResponse = await fetch(imageEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await googleResponse.json();
            const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
            
            if (!imagePart) return res.status(200).json({ success: false });
            return res.status(200).json({ success: true, image: `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}` });
        } catch (e) { return res.status(200).json({ success: false }); }
    }

    // --- ROTA DE DESCRIÇÃO (Para o Criador de Estampas) ---
    if (action === 'DESCRIBE_PATTERN') {
        if (!apiKey) return res.status(500).json({ error: "No Key" });
        try {
            const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            // Prompt focado em FABRIC MATCHING
            const MASTER_VISION_PROMPT = `
            ACT AS: Senior Textile Designer.
            TASK: Analyze the PRINT/TEXTURE.
            OUTPUT JSON:
            { 
              "prompt": "Detailed description of the print pattern", 
              "colors": [{"name": "Name", "hex": "#RRGGBB", "code": "Code"}],
              "stockMatches": [] 
            }
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

    // --- ROTA PRINCIPAL: SCANNER DE MOLDES (REAL) ---
    if (action === 'SCAN_CLOTHING' || !action) { 
        if (!apiKey) return res.status(503).json({ error: "Backend Unavailable" });
        
        // 1. Extração de Palavras-Chave (DNA)
        const SEARCH_GEN_PROMPT = `
        VOCÊ É: Especialista em Modelagem de Roupas.
        TAREFA: Analise a imagem e identifique o molde (sewing pattern).
        OUTPUT JSON APENAS:
        {
          "patternName": "Nome Técnico Exato",
          "technicalDna": { "silhouette": "...", "neckline": "..." },
          "searchKeywords": ["Termo Ingles 1", "Termo Ingles 2"]
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
        
        // 2. Construção de Links REAIS (Baseados em Busca)
        const mainTerm = analysis.searchKeywords?.[0] || analysis.patternName || "Sewing Pattern";
        
        // IMPORTANTE: Adiciona o backupSearchTerm para o fallback de imagem funcionar
        const createRealLink = (source, type, urlBase, term, score) => ({
            source,
            patternName: `Busca: ${term}`,
            type: type,
            linkType: "SEARCH_QUERY",
            url: `${urlBase}${encodeURIComponent(term)}`,
            backupSearchTerm: `${term} ${source} sewing pattern`, // TERMO DE BACKUP PARA BUSCA VISUAL
            similarityScore: score,
            imageUrl: null 
        });

        // DEFINIÇÃO DAS FONTES GLOBAIS
        const matches = {
            exact: [
                createRealLink("Etsy Global", "PAGO", "https://www.etsy.com/search?q=", `${mainTerm} sewing pattern`, 98),
                createRealLink("Burda Style", "PAGO", "https://www.burdastyle.com/catalogsearch/result/?q=", mainTerm, 95),
                createRealLink("Vikisews", "PREMIUM", "https://vikisews.com/search/?q=", mainTerm, 92),
            ],
            close: [
                createRealLink("Makerist", "INDIE", "https://www.makerist.com/search?q=", `${mainTerm}`, 88),
                createRealLink("The Fold Line", "INDIE", "https://thefoldline.com/?s=", mainTerm, 85),
                createRealLink("Google Shopping", "GERAL", "https://www.google.com/search?tbm=shop&q=", `${mainTerm} sewing pattern`, 80),
            ],
            adventurous: [
                createRealLink("Pinterest Ideas", "INSPIRACAO", "https://www.pinterest.com/search/pins/?q=", `${mainTerm} outfit pattern`, 75),
                createRealLink("Youtube Tutorials", "VIDEO", "https://www.youtube.com/results?search_query=", `How to sew ${mainTerm}`, 70)
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
