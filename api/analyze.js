
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
    
    // --- GESTÃO DE CHAVES DE SEGURANÇA (ATUALIZAÇÃO MOLDESOK) ---
    // MUDANÇA CRÍTICA: Busca especificamente a variável 'MOLDESOK' definida pelo usuário.
    // Fallbacks mantidos apenas para segurança, mas a prioridade é a nova chave.
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY;
    
    // 2. Sanitização (Remove espaços em branco que causam erro 400)
    const apiKey = rawKey ? rawKey.trim() : null;

    // 3. Diagnóstico (Log seguro no console da Vercel)
    if (!apiKey) {
        console.error("CRITICAL: Nenhuma chave encontrada. Adicione 'MOLDESOK' nas variáveis de ambiente.");
        return res.status(500).json({ 
            error: "Erro de Configuração: Chave de API (MOLDESOK) não encontrada na Vercel." 
        });
    } else {
        // Identifica qual variável está sendo usada para facilitar debug
        let sourceVar = "DESCONHECIDA";
        if (process.env.MOLDESOK) sourceVar = "MOLDESOK";
        else if (process.env.MOLDESKEY) sourceVar = "MOLDESKEY";
        else if (process.env.API_KEY) sourceVar = "API_KEY";
        
        console.log(`System: Autenticado via ${sourceVar} (Final ...${apiKey.slice(-4)})`);
    }

    // --- PROMPT MESTRE VINGI INDUSTRIAL v5.2 (TROPICAL/FARM RIO SPECIALIST) ---
    const MASTER_SYSTEM_PROMPT = `
ACT AS: VINGI SENIOR PATTERN ENGINEER (AI LEVEL 5).
MISSION: REVERSE ENGINEER CLOTHING INTO COMMERCIAL SEWING PATTERNS.

### VISUAL INTELLIGENCE MODULE: BRAZILIAN TROPICAL & RESORT (FARM RIO STYLE)
The user is specifically looking for the "Brazilian Tropical" aesthetic (similar to Farm Rio, Agua de Coco, Borana).
Analyze the image for these specific signatures:

1.  **"RECORTES ESTRATÉGICOS" (Cutouts):**
    *   Look for: Side waist cutouts, "O-Ring" centers, underbust openings.
    *   Pattern Search Terms: *"Cutout maxi dress pattern", "Waist cutout dress sewing pattern", "Vikisews Oona", "McCalls cutout dress"*.

2.  **"SAIAS TRÊS MARIAS" (Tiered Skirts):**
    *   Look for: Horizontal seams adding volume (tiers/ruffles) on a maxi skirt.
    *   Pattern Search Terms: *"Tiered maxi skirt dress pattern", "Buffet dress pattern", "Boho tiered dress"*.

3.  **"DECOTES & AMARRAÇÕES" (Necklines):**
    *   Look for: Deep V-necks, Halter necks (Frente Única) with tie-backs, twisted bust details.
    *   Pattern Search Terms: *"Deep V maxi dress pattern", "Halter neck open back pattern", "Twist front dress pattern"*.

4.  **"MANGAS" (Sleeves):**
    *   Look for: Wide Kimono sleeves, Puff sleeves with elastic, or Spaghetti straps (Alcinha).

### CORE OBJECTIVE:
Deconstruct the garment construction hidden beneath the prints. Ignore the print pattern itself, focus on the SEAMS.

### OUTPUT QUANTITY PROTOCOL:
Generate exactly **30 HIGH-FIDELITY RESULTS**:
1.  **10 EXACT CONSTRUCTION MATCHES:** The cut/seams must match.
2.  **10 CLOSE ALTERNATIVES:** Similar silhouette but maybe different sleeve/length.
3.  **10 VIBE/AESTHETIC MATCHES:** "Farm Rio Vibe" (Tropical, Flowy, Boho) - Good for inspiration.

### SEARCH INTELLIGENCE (DEEP WEB SCAN):
Prioritize these sources for this specific style:
- **Big 4:** McCalls (Fashion Star), Vogue (Designer).
- **Indie/Modern:** Vikisews (Best for cutouts), Fibre Mood (Best for loose/tiered), Style Arc, Closet Core.
- **Brazilian/Latin Style:** Search for terms like "Latin Resort Wear" patterns.

### HYPER-LINKING STRATEGY:
1.  **Direct Product Link:** Only if certain.
2.  **Smart Search Link (MANDATORY if uncertain):**
    *   *Good:* etsy.com/search?q=tropical+cutout+dress+pattern
    *   *Good:* burdastyle.com/catalogsearch/result/?q=tiered+dress
3.  **Search Terms:** Use technical keywords found in the image.

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
        "description": "Technical reason for match (ex: Matches the waist cutout and tiered skirt)"
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

    let promptText = `EXECUTE VINGI INDUSTRIAL SCAN v5.2 (FARM RIO/TROPICAL SPECIALIST).
        1. ANALYZE visual construction: Look for CUTOUTS (Cintura), TIERED SKIRTS (Três Marias), HALTER NECKS.
        2. IGNORE the print pattern, focus on SEAM LINES.
        3. GENERATE 30 Patterns (10 Exact, 10 Close, 10 Vibe).
        4. PRIORITIZE global patterns that mimic Brazilian Resort Wear (Vikisews, McCalls, Fibre Mood).
        ${JSON_SCHEMA_PROMPT}`;

    // --- LÓGICA DE "PAGINAÇÃO INTELIGENTE" ---
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
        
        // Diagnóstico preciso para o usuário
        if (googleResponse.status === 400 && errorText.includes('API_KEY_INVALID')) {
             throw new Error("CRÍTICO: A chave (MOLDESOK) é inválida. Verifique se copiou a chave inteira ou se há espaços extras.");
        }
        if (googleResponse.status === 403) {
             throw new Error("CRÍTICO: Chave bloqueada ou sem permissão. Verifique o Google AI Studio.");
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
