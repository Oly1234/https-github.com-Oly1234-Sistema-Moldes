
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

  try {
    const { mainImageBase64, mainMimeType, secondaryImageBase64, secondaryMimeType, excludePatterns } = req.body;
    
    // --- GESTÃO DE CHAVES DE SEGURANÇA (INDUSTRIAL V5) ---
    // 1. Busca a chave
    let rawKey = process.env.API_KEY || process.env.MOLDESKEY;
    
    // 2. Sanitização: Remove espaços em branco que causam erro 'API_KEY_INVALID'
    const apiKey = rawKey ? rawKey.trim() : null;

    // 3. Diagnóstico de Chave (Sem expor o segredo)
    if (!apiKey) {
        console.error("CRITICAL: API Key is missing in Environment Variables.");
        return res.status(500).json({ 
            error: "Erro de Configuração: API Key não encontrada. Adicione 'API_KEY' na Vercel e faça REDEPLOY." 
        });
    } else {
        console.log(`System: Usando chave terminada em ...${apiKey.slice(-4)}`);
    }

    // --- PROMPT MESTRE VINGI INDUSTRIAL v5.1 (FARM RIO/RESORT UPDATE) ---
    const MASTER_SYSTEM_PROMPT = `
ACT AS: VINGI SENIOR PATTERN ENGINEER (AI LEVEL 5).
MISSION: REVERSE ENGINEER CLOTHING INTO COMMERCIAL SEWING PATTERNS.

### SPECIALIZED KNOWLEDGE BASE (BRAZILIAN RESORT & FARM RIO STYLE):
The user explicitly searches for styles similar to **FARM RIO**, **ANTIX**, and **AGILITÀ**.
You must strictly identify and prioritize these construction details:
1.  **"Recortes" (Cutouts):** Side waist cutouts, underbust keyholes, bodice separations with O-rings or knots. Search terms: *"Cutout maxi dress pattern", "Midriff baring dress sewing pattern"*.
2.  **"Frente Única" (Halter/Strappy):** High neck halters, spaghetti straps, criss-cross back details. Search terms: *"Halter neck maxi dress pattern", "Open back resort dress"*.
3.  **"Mangas Amplas" (Statement Sleeves):** Wide Kimono sleeves, Butterfly sleeves, Puff sleeves with elastic cuffs. Search terms: *"Wide sleeve boho dress pattern", "Kimono sleeve maxi pattern"*.
4.  **"Fluidez" (Flow & Tiered):** Tiered skirts ("Três Marias"), gathered waists, voluminous viscose drape. Search terms: *"Tiered maxi dress pattern", "Buffet dress pattern", "Boho chic sewing pattern"*.
5.  **"Um Ombro Só" (Asymmetrical):** One-shoulder bodices. Search terms: *"One shoulder maxi dress pattern", "Asymmetrical greek dress pattern"*.

### CORE OBJECTIVE:
Analyze the input image(s) as a textile engineer. Deconstruct the garment into its construction methods and find the EXACT sewing patterns available online to recreate it.

### OUTPUT QUANTITY PROTOCOL:
Generate exactly **30 HIGH-FIDELITY RESULTS** structured as:
1.  **10 EXACT MATCHES:** The official pattern or a 99% visual clone (Prioritize exact construction matches).
2.  **10 CLOSE ALTERNATIVES:** Same silhouette, minor detail variations (e.g., different pocket, cuff).
3.  **10 VIBE/AESTHETIC MATCHES:** Captures the "Farm Rio/Boho" mood (good for broad inspiration).

### SEARCH INTELLIGENCE (DEEP WEB SCAN):
You must simulate a search across these specific databases:
- **Commercial Giants:** Vogue (Very good for designer lookalikes), McCalls (Fashion Star collection), Butterick, Simplicity.
- **Modern & Boho:** Fibre Mood (Excellent for loose fits), Vikisews (Excellent for modern cutouts), Style Arc, Closet Core, Tessuti.
- **Vintage Archives:** Lady Marlowe, Mrs. Depew, Etsy Vintage (for the 70s vibe often found in Farm styles).

### HYPER-LINKING STRATEGY (CRITICAL):
The user hates 404 errors. You must be strategic:
1.  **Direct Product Link:** Use ONLY if you are 95% sure it exists.
2.  **Smart Search Link (PREFERRED):** Construct a search URL that lands on a results page.
    *   *Bad:* site.com/products/unknown-id
    *   *Good:* etsy.com/search?q=cutout+maxi+dress+pattern
    *   *Good:* burdastyle.com/catalogsearch/result/?q=halter+neck+dress
3.  **Search Terms:** Use technical keywords found in the image (e.g., "Godet Skirt", "Raglan Sleeve", "Mandarin Collar").

### JSON DATA STRUCTURE:
Return strictly valid JSON.
`;

    const JSON_SCHEMA_PROMPT = `
RESPONSE FORMAT (JSON ONLY):
{
  "patternName": "Name of the garment style (ex: The Sapporo Coat)",
  "category": "Broad Category (ex: Outerwear)",
  "technicalDna": { 
    "silhouette": "Technical shape description (ex: A-Line with Side Cutouts)", 
    "neckline": "Neckline analysis (ex: Halter with keyhole)", 
    "sleeve": "Sleeve construction (ex: Wide Kimono)", 
    "fabricStructure": "Drape and weight analysis (ex: Fluid Viscose)"
  },
  "matches": {
    "exact": [
      { 
        "source": "Brand Name", 
        "patternName": "Pattern Name/Number", 
        "similarityScore": 99, 
        "type": "PAGO/GRATIS/INDIE", 
        "url": "VALID_URL_OR_SMART_SEARCH", 
        "imageUrl": "OPTIONAL_IMAGE_URL",
        "description": "Why is this an exact match?"
      }
    ],
    "close": [ { ... } ],
    "adventurous": [ { ... } ]
  },
  "curatedCollections": [
      {
          "sourceName": "Etsy/Burda/Etc",
          "title": "Collection Title",
          "itemCount": "15+",
          "searchUrl": "SMART_SEARCH_URL",
          "description": "Short reasoning",
          "icon": "SHOPPING"
      }
  ]
}
`;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const parts = [
        {
            inline_data: {
                mime_type: mainMimeType,
                data: mainImageBase64
            }
        }
    ];

    if (secondaryImageBase64 && secondaryMimeType) {
        parts.push({
            inline_data: {
                mime_type: secondaryMimeType,
                data: secondaryImageBase64
            }
        });
    }

    let promptText = `EXECUTE VINGI INDUSTRIAL SCAN v5.1 (RESORT/FARM EDITION).
        1. ANALYZE visual construction (Look for Cutouts, Halters, Tiered Skirts).
        2. GENERATE 30 Patterns (10 Exact, 10 Close, 10 Vibe).
        3. PRIORITIZE available PDF patterns from global indie designers like Vikisews, Fibre Mood, and Big 4.
        ${JSON_SCHEMA_PROMPT}`;

    // --- LÓGICA DE "PAGINAÇÃO INTELIGENTE" ---
    if (excludePatterns && Array.isArray(excludePatterns) && excludePatterns.length > 0) {
        const ignoredList = excludePatterns.join(', ');
        promptText += `\n\nEXCLUSION FILTER ACTIVE:
        User has already seen: [${ignoredList}].
        DO NOT return these specific patterns again.
        FIND NEW ALTERNATIVES. Dig deeper into less common brands (e.g., Marfy, Lekala, Grasser).`;
    }

    parts.push({ text: promptText });

    const payload = {
        contents: [{ parts: parts }],
        system_instruction: {
            parts: [{ text: MASTER_SYSTEM_PROMPT }]
        },
        generation_config: {
            response_mime_type: "application/json"
        }
    };

    const googleResponse = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!googleResponse.ok) {
        const errorText = await googleResponse.text();
        console.error("Gemini API Error Status:", googleResponse.status);
        console.error("Gemini API Error Details:", errorText);
        
        // Diagnóstico preciso para o usuário
        if (googleResponse.status === 400 && errorText.includes('API_KEY_INVALID')) {
             throw new Error("CRÍTICO: A API Key na Vercel é inválida ou foi deletada. Gere uma nova no Google AI Studio.");
        }
        if (googleResponse.status === 403) {
             throw new Error("CRÍTICO: Chave bloqueada ou expirada. Verifique o Google AI Studio.");
        }
        if (googleResponse.status === 429) {
             throw new Error("Tráfego intenso. Aguarde 30 segundos e tente novamente.");
        }

        throw new Error(`Google API Error (${googleResponse.status})`);
    }

    const data = await googleResponse.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
        throw new Error("A IA analisou a imagem mas não gerou texto. Tente uma foto com melhor iluminação.");
    }

    let cleanText = generatedText.trim();
    if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '');
    }

    const jsonResult = JSON.parse(cleanText);
    res.status(200).json(jsonResult);

  } catch (error) {
    console.error("Backend Handler Error:", error);
    res.status(500).json({ 
        error: error.message || 'Erro Interno do Servidor', 
        details: error.toString() 
    });
  }
}
