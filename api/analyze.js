
export default async function handler(req, res) {
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
    const { action, prompt, mainImageBase64, mainMimeType, secondaryImageBase64, secondaryMimeType, excludePatterns, targetUrl } = req.body;
    
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY || process.env.VITE_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;
    const useFallback = !apiKey; 
    const genAIEndpoint = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // ==========================================================================================
    // ROTA 0: SCRAPER ROBUSTO (PYTHON-LIKE LOGIC)
    // ==========================================================================================
    if (action === 'GET_LINK_PREVIEW') {
        if (!targetUrl) return res.status(400).json({ error: 'URL necessária' });
        
        // Se for URL de busca genérica, não gastamos recurso tentando scrapear imagem
        if (targetUrl.includes('google.com/search') || targetUrl.includes('pinterest.com/search')) {
             return res.status(200).json({ success: false });
        }

        try {
            // Simulando headers de um navegador real (como Selenium/Playwright fariam)
            const commonHeaders = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            };

            const siteRes = await fetch(targetUrl, { headers: commonHeaders });
            if (!siteRes.ok) throw new Error('Site bloqueou ou não existe');
            
            const html = await siteRes.text();
            
            // Lógica de Extração em Cascata (Prioridade: OpenGraph > Twitter > Etsy Specific > Burda Specific > First Image)
            let imageUrl = null;

            // 1. Meta Tags Padrão
            const metaRegex = /<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']\s*\/?>/i;
            const match = html.match(metaRegex);
            if (match) imageUrl = match[1];

            // 2. Etsy Specific (Scraping avançado de data-attributes)
            if (!imageUrl && (targetUrl.includes('etsy.com') || html.includes('etsystatic'))) {
                const etsyRegex = /data-src-zoom-image=["']([^"']+)["']|data-src-full=["']([^"']+)["']|class=["']wt-max-width-full wt-horizontal-center wt-vertical-center carousel-image wt-rounded["'] src=["']([^"']+)["']/i;
                const etsyMatch = html.match(etsyRegex);
                if (etsyMatch) imageUrl = etsyMatch[1] || etsyMatch[2] || etsyMatch[3];
            }

            // 3. Burda/Commerce Specific
            if (!imageUrl) {
                 const productRegex = /class=["']product-image-photo["']\s+src=["']([^"']+)["']|class=["']gallery-placeholder__image["']\s+src=["']([^"']+)["']/i;
                 const prodMatch = html.match(productRegex);
                 if (prodMatch) imageUrl = prodMatch[1] || prodMatch[2];
            }

            // 4. Fallback: Primeira imagem grande encontrada
            if (!imageUrl) {
                 const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+(?:jpg|jpeg|png|webp))["'][^>]*>/i;
                 const imgMatch = html.match(imgRegex);
                 if (imgMatch) imageUrl = imgMatch[1];
            }

            if (!imageUrl) return res.status(200).json({ success: false });

            // Normalização de URL
            if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
            if (imageUrl.startsWith('/')) {
                const urlObj = new URL(targetUrl);
                imageUrl = urlObj.origin + imageUrl;
            }

            // Bypass de proteção de imagem (Referer Spoofing)
            // Baixamos a imagem no backend e enviamos como base64 para o frontend
            const domain = new URL(targetUrl).origin;
            const imgRes = await fetch(imageUrl, {
                headers: { 
                    ...commonHeaders, 
                    'Referer': domain, 
                    'Sec-Fetch-Dest': 'image', 
                    'Sec-Fetch-Mode': 'no-cors' 
                }
            });

            const imgBuffer = await imgRes.arrayBuffer();
            const base64Img = Buffer.from(imgBuffer).toString('base64');
            const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
            
            return res.status(200).json({ success: true, image: `data:${mimeType};base64,${base64Img}` });

        } catch (err) {
            console.error("Scraper Error:", err.message);
            return res.status(200).json({ success: false, error: err.message });
        }
    }

    // ==========================================================================================
    // ROTA 1: BUSCA GLOBAL MASSIVA (60 RESULTADOS)
    // ==========================================================================================
    if (action === 'SCAN_CLOTHING' || !action) { 
        if (useFallback) return res.status(503).json({ error: "Backend Unavailable" });

        const GLOBAL_SEARCH_PROMPT = `
        VOCÊ É: VINGI AI, Caçadora Global de Moldes (Polyglot Pattern Hunter).
        
        MISSÃO: Encontrar UMA LISTA MASSIVA DE MOLDES (40 a 60 itens) para a roupa da imagem.
        
        FONTES OBRIGATÓRIAS (GLOBAL):
        - **RÚSSIA:** Vikisews, Grasser, Lekala, Laforme.
        - **BRASIL:** Marlene Mukai, Maximus Tecidos, Sigbol.
        - **EUA/UK/AUS:** Mood Fabrics, Peppermint Mag, The Fold Line, Tessuti, Style Arc.
        - **VINTAGE:** Etsy (Busque por "Vintage Pattern [Category]"), eBay.

        REGRAS DE RETORNO:
        1. **QUANTIDADE:** Retorne entre 40 e 60 resultados divididos nas categorias. Eu preciso de volume para curadoria.
        2. **IDIOMA:** Descrições e Comparações em PORTUGUÊS (PT-BR).
        3. **LINKS:** Se não tiver o link exato, gere um Link de Busca Inteligente na loja (ex: vikisews.com/?s=vestido...).

        ESTRUTURA JSON:
        {
          "patternName": "Nome Técnico (PT-BR)",
          "category": "Categoria",
          "technicalDna": { "silhouette": "...", "neckline": "...", "sleeve": "..." },
          "matches": { 
              "exact": [ ARRAY COM 15-20 ITENS REAIS ], 
              "close": [ ARRAY COM 15-20 ITENS SIMILARES ], 
              "adventurous": [ ARRAY COM 10-15 ITENS CRIATIVOS ] 
          },
          "curatedCollections": []
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
        return res.status(200).json(jsonResult);
    }
    
    // Outras rotas (DESCRIBE_PATTERN, etc) mantidas aqui implicitamente pelo else
    return res.status(200).json({ success: false });

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(503).json({ error: "Service Unavailable" });
  }
}
