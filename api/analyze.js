
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
    const { action, prompt, colors, mainImageBase64, mainMimeType, secondaryImageBase64, secondaryMimeType, targetUrl } = req.body;
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY || process.env.VITE_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;
    
    // --- MOTOR DE SCRAPING "PYTHON-STYLE" (GET_LINK_PREVIEW) ---
    if (action === 'GET_LINK_PREVIEW') {
        if (!targetUrl) return res.status(400).json({ error: 'URL necessária' });
        
        // Evita gastar recursos tentando raspar a home do Google Search, pois não tem og:image útil
        if (targetUrl.includes('google.com/search') && !targetUrl.includes('tbm=isch')) {
             return res.status(200).json({ success: false }); 
        }

        // Simulação de Browser (Headers)
        const browserHeaders = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.google.com/',
            'Cache-Control': 'no-cache',
            'Upgrade-Insecure-Requests': '1'
        };

        const fetchHtml = async (url) => {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 12000); // 12s timeout
            const response = await fetch(url, { headers: browserHeaders, signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        };

        try {
            const html = await fetchHtml(targetUrl);
            let imageUrl = null;

            // ESTRATÉGIA 1: JSON-LD (Dados Estruturados - A mais confiável)
            // Sites modernos (Etsy, Pinterest, E-commerces) injetam dados do produto aqui.
            const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
            let match;
            while ((match = jsonLdRegex.exec(html)) !== null) {
                try {
                    const json = JSON.parse(match[1]);
                    // Procura imagem em estruturas comuns
                    const extract = (obj) => {
                        if (!obj) return null;
                        if (obj.image) return Array.isArray(obj.image) ? obj.image[0] : (typeof obj.image === 'object' ? obj.image.url : obj.image);
                        if (obj.thumbnailUrl) return obj.thumbnailUrl;
                        return null;
                    };
                    
                    // Se for lista de produtos (Página de Busca), pega o primeiro
                    if (json.itemListElement && Array.isArray(json.itemListElement)) {
                        const firstItem = json.itemListElement[0];
                        const img = extract(firstItem) || extract(firstItem.item);
                        if (img) { imageUrl = img; break; }
                    }
                    
                    // Se for produto único
                    const directImg = extract(json);
                    if (directImg) { imageUrl = directImg; break; }

                } catch (e) { continue; }
            }

            // ESTRATÉGIA 2: Open Graph & Twitter Cards (Padrão Social)
            if (!imageUrl) {
                const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
                if (ogMatch) imageUrl = ogMatch[1];
            }
            if (!imageUrl) {
                const twMatch = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
                if (twMatch) imageUrl = twMatch[1];
            }

            // ESTRATÉGIA 3: Scraping Específico por Domínio (Fallback "Na Unha")
            if (!imageUrl) {
                if (targetUrl.includes('etsy.com')) {
                    // Tenta pegar imagem do grid v2
                    const etsyGrid = html.match(/src="(https:\/\/i\.etsystatic\.com\/[^"]+il_[^"]+\.jpg)"/i);
                    if (etsyGrid) imageUrl = etsyGrid[1];
                } 
                else if (targetUrl.includes('burdastyle')) {
                    const burda = html.match(/class="product-image-photo"[^>]*src="([^"]+)"/i);
                    if (burda) imageUrl = burda[1];
                }
                else if (targetUrl.includes('pinterest')) {
                    const pin = html.match(/src="(https:\/\/i\.pinimg\.com\/[^"]+)"/i);
                    if (pin) imageUrl = pin[1];
                }
            }

            // LIMPEZA FINAL DA URL
            if (imageUrl) {
                // Remove escapes HTML
                imageUrl = imageUrl.replace(/&amp;/g, '&');
                // Corrige URLs relativas
                if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
                else if (imageUrl.startsWith('/')) {
                    const urlObj = new URL(targetUrl);
                    imageUrl = `${urlObj.protocol}//${urlObj.hostname}${imageUrl}`;
                }
                
                // Hack de Qualidade: Tenta trocar thumbnails por imagens maiores (Etsy/Shopify)
                if (imageUrl.includes('etsystatic') && imageUrl.includes('340x270')) {
                    imageUrl = imageUrl.replace('340x270', '794xN'); // Força alta resolução Etsy
                }
                
                return res.status(200).json({ success: true, image: imageUrl });
            }

            return res.status(200).json({ success: false, message: "No image found in metadata" });

        } catch (err) {
            console.error("Scraper Error:", err.message);
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
        
        const createRealLink = (source, type, urlBase, term, score) => ({
            source,
            patternName: `Busca: ${term}`,
            type: type,
            linkType: "SEARCH_QUERY",
            url: `${urlBase}${encodeURIComponent(term)}`,
            similarityScore: score,
            imageUrl: null // O Frontend vai acionar GET_LINK_PREVIEW para raspar a imagem real
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
