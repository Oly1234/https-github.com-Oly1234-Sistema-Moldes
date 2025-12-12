
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
    
    // --- GESTÃO DE CHAVES DE SEGURANÇA ---
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;

    if (!apiKey) {
        console.error("CRITICAL: Nenhuma chave encontrada.");
        return res.status(500).json({ 
            error: "Erro de Configuração: Chave de API não encontrada." 
        });
    } else {
        let sourceVar = "DESCONHECIDA";
        if (process.env.MOLDESOK) sourceVar = "MOLDESOK";
        else if (process.env.MOLDESKEY) sourceVar = "MOLDESKEY";
        else if (process.env.API_KEY) sourceVar = "API_KEY";
        console.log(`System: Autenticado via ${sourceVar} (Final ...${apiKey.slice(-4)})`);
    }

    // --- PROMPT MESTRE VINGI INDUSTRIAL v5.3 (GLOBAL SEARCH PROTOCOL) ---
    const MASTER_SYSTEM_PROMPT = `
ACT AS: VINGI SENIOR PATTERN ENGINEER (AI LEVEL 5).
MISSION: REVERSE ENGINEER CLOTHING INTO COMMERCIAL SEWING PATTERNS GLOBALLY.

### GLOBAL SEARCH STRATEGY (MULTI-LANGUAGE PROTOCOL):
To find the best patterns, you MUST translate technical terms to **ENGLISH** when searching international databases, while keeping **PORTUGUESE** terms for Brazilian specific sources.

### SOURCE PRIORITY & SPECIALIZATION:

1. **BRAZILIAN MASTERS (PT-BR Searches):**
   *   **Marlene Mukai:** MANDATORY for fundamental modeling in Brazil. Search: *"Marlene Mukai [vestido/molde]"*.
   *   **Youtube Channels:** "Minha Mãe Costura", "Alana Santos", "A Casa da Costura".

2. **INTERNATIONAL HIGH-FASHION (EN Searches):**
   *   **Vikisews:** HIGHEST PRIORITY for modern cutouts, corsetry, and fitted designs (perfect for the "cutout" look).
   *   **Mood Fabrics (The Sewciety):** Excellent for free, high-fashion inspired patterns.
   *   **Etsy:** Use specific English keywords (Boho, Resort, Linen).

3. **THE "BIG 4" & INDIE (EN Searches):**
   *   **Vogue/McCalls:** For "Designer" lookalikes and complex drapes.
   *   **Fibre Mood:** For loose, tiered, "Farm Rio" style volumes.
   *   **Style Arc:** For reliable industry-standard blocks.

### KEYWORD TRANSLATION MATRIX (APPLY STRICTLY):
Analyze the image and apply these search terms based on the features found:

*   **IF "Três Marias" / "Babados":**
    *   Search EN: *"Tiered maxi dress pattern", "Buffet dress pattern", "Boho gathered dress"*.
*   **IF "Frente Única" / "Lenço":**
    *   Search EN: *"Halter neck dress pattern", "Handkerchief hem pattern", "Open back resort dress"*.
*   **IF "Recortes" / "Vazado na Cintura":**
    *   Search EN: *"Cut out waist dress pattern", "Midriff baring pattern", "O-ring dress pattern"*.
*   **IF "Manga Bufante":**
    *   Search EN: *"Puff sleeve", "Bishop sleeve", "Balloon sleeve"*.
*   **IF "Um ombro só":**
    *   Search EN: *"One shoulder maxi dress pattern", "Asymmetrical greek dress pattern"*.
*   **IF "Macaquinho":**
    *   Search EN: *"Romper pattern", "Playsuit pattern", "Plunge neckline romper"*.

### VISUAL INTELLIGENCE (FARM RIO / TROPICAL STYLE):
The user loves the "Farm Rio" aesthetic (Antix, Borana, Agilità).
*   Ignore the prints (tropical/floral).
*   Focus on the **STRUCTURE**: deep V-necks, flowy viscose behavior, elastic waists, strategic skin exposure.

### OUTPUT QUANTITY PROTOCOL (BATCH OPTIMIZATION):
Generate exactly **45 HIGH-FIDELITY RESULTS** in a single run to optimize API usage:
1.  **15 EXACT MATCHES:** Prioritize **Vikisews** (modern) and **McCalls** (classic).
2.  **15 CLOSE ALTERNATIVES:** Prioritize **Marlene Mukai** (free/technical) and **Mood Fabrics**.
3.  **15 VIBE/AESTHETIC MATCHES:** **Etsy** and Indie designers (Farm Rio vibe).

### HYPER-LINKING STRATEGY:
1.  **Direct Product Link:** Only if certain.
2.  **Smart Search Link (MANDATORY):**
    *   *Vikisews:* vikisews.com/patterns/dresses/?search=cutout
    *   *Marlene Mukai:* marlenemukai.com.br/?s=vestido+longo
    *   *Etsy:* etsy.com/search?q=tiered+maxi+dress+pattern
3.  **Search Terms:** Use the ENGLISH technical terms for international sites.

### JSON DATA STRUCTURE:
Return strictly valid JSON.
`;

    const JSON_SCHEMA_PROMPT = `
RESPONSE FORMAT (JSON ONLY):
{
  "patternName": "Name of the garment style (ex: The Tropical Cutout Maxi)",
  "category": "Broad Category (ex: Resort Wear)",
  "technicalDna": { 
    "silhouette": "Technical shape (ex: A-Line with Side Cutouts)", 
    "neckline": "Neckline (ex: Deep V Halter)", 
    "sleeve": "Sleeve (ex: Kimono or Sleeveless)", 
    "fabricStructure": "Fabric (ex: Viscose/Linen Blend)"
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
        "description": "Why? (ex: 'Vikisews Oona matches the waist cutout perfectly')"
      }
    ],
    "close": [ { ... } ],
    "adventurous": [ { ... } ]
  },
  "curatedCollections": [
      {
          "sourceName": "Marlene Mukai / Vikisews / Etc",
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

    let promptText = `EXECUTE VINGI GLOBAL SCAN v5.4 (BATCH OPTIMIZED).
        1. ANALYZE visual construction (Cutouts, Tiers, Asymmetry).
        2. TRANSLATE features to English Keywords (e.g., 'Três Marias' -> 'Tiered Skirt').
        3. SEARCH GLOBALLY: Vikisews, Mood Fabrics, McCalls, Etsy, and LOCALLY: Marlene Mukai.
        4. GENERATE 45 Patterns (15 Exact, 15 Close, 15 Vibe).
        ${JSON_SCHEMA_PROMPT}`;

    // --- LÓGICA DE EXCLUSÃO (MANTIDA POR PRECAUÇÃO, MAS MENOS USADA COM BATCHING) ---
    if (excludePatterns && Array.isArray(excludePatterns) && excludePatterns.length > 0) {
        const ignoredList = excludePatterns.join(', ');
        promptText += `\n\nEXCLUSION FILTER ACTIVE:
        User has already seen: [${ignoredList}].
        DO NOT return these specific patterns again.
        FIND NEW ALTERNATIVES. Dig deeper into Etsy Vintage or Indie Designers.`;
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
        
        if (googleResponse.status === 400 && errorText.includes('API_KEY_INVALID')) {
             throw new Error("CRÍTICO: A chave (MOLDESOK) é inválida.");
        }
        if (googleResponse.status === 403) {
             throw new Error("CRÍTICO: Chave bloqueada.");
        }
        if (googleResponse.status === 429) {
             throw new Error("Tráfego intenso. Aguarde 30 segundos.");
        }

        throw new Error(`Google API Error (${googleResponse.status})`);
    }

    const data = await googleResponse.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
        throw new Error("A IA analisou a imagem mas não gerou texto.");
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
