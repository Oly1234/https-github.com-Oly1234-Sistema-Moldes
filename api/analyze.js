
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
    const { action, prompt, mainImageBase64, mainMimeType, secondaryImageBase64, secondaryMimeType, excludePatterns } = req.body;
    
    // --- GESTÃO DE CHAVES DE SEGURANÇA ---
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;

    if (!apiKey) {
        return res.status(500).json({ error: "Erro de Configuração: Chave de API não encontrada." });
    }

    const genAIEndpoint = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // ==========================================================================================
    // ROTA 1: ENHANCE PROMPT (INTELIGÊNCIA DE TEXTO)
    // ==========================================================================================
    if (action === 'ENHANCE_PROMPT') {
        const endpoint = genAIEndpoint('gemini-2.5-flash');
        
        const systemPrompt = `
        ACT AS: World-Class Midjourney & Imagen 3 Prompt Engineer.
        
        TASK: Upgrade the user's simple input into a "Award-Winning Textile Design" prompt.
        INPUT: "${prompt}"
        
        RULES:
        1.  **NO CONVERSATION.** Return ONLY the prompt string.
        2.  **FORMAT:** Comma-separated descriptors (Tags).
        3.  **MANDATORY:** Define the *Medium* (e.g., Gouache, Vector, Silk Screen), the *Lighting* (e.g., Flat studio light), and *Texture* (e.g., Rough linen canvas).
        4.  **QUALITY:** Add "8k, trending on artstation, sharp focus, seamless repeating pattern".
        5.  **FORBIDDEN:** Do not use generic sentences like "A beautiful pattern". Use concrete visual tags.
        
        OUTPUT EXAMPLE:
        "Seamless pattern, tropical hibiscus flowers, watercolor technique, wet-on-wet bleed, vibrant magenta and teal, white paper texture background, 8k resolution, flat lighting, high detail"
        `;

        const payload = {
            contents: [{ parts: [{ text: systemPrompt }] }]
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        const enhancedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        return res.status(200).json({ success: true, enhancedPrompt: enhancedText || prompt });
    }

    // ==========================================================================================
    // ROTA 2: DESCRIÇÃO DE ESTAMPA (VISION TO PROMPT - REVERSE ENGINEERING)
    // ==========================================================================================
    if (action === 'DESCRIBE_PATTERN') {
        const visionEndpoint = genAIEndpoint('gemini-2.5-flash');
        
        // PROMPT DE ENGENHARIA REVERSA TÊXTIL - LEVEL EXPERT
        const VISION_PROMPT = `
          ACT AS: Senior Textile Designer & Midjourney Prompt Expert.
          TASK: Reverse-engineer the surface design of this fabric into a comma-separated prompt tags list.

          INSTRUCTIONS:
          1.  **IGNORE** the clothing silhouette, folds, shadows, wrinkles, or the person wearing it.
          2.  **FLATTEN** the design. Describe it as a 2D digital artwork file.
          3.  **EXTRACT** specific visual tags:
              *   **Technique:** (e.g. watercolor, screen print, vector lineart, batik, embroidery).
              *   **Motifs:** (Specific flower names, geometric shapes, animals).
              *   **Colors:** (Use specific names like 'cobalt blue', 'burnt orange').
              *   **Composition:** (e.g. ditsy, large scale, geometric grid).
          
          OUTPUT FORMAT:
          "Seamless pattern, [Technique], [Motif 1], [Motif 2], [Color 1], [Color 2], [Background], flat lay, 8k, high quality"

          EXAMPLE:
          "Seamless pattern, gouache painting style, large monstera leaves, pink hibiscus, emerald green background, visible brushstrokes, flat lighting, 8k resolution"
          
          RETURN ONLY THE PROMPT STRING. NO MARKDOWN.
        `;

        const visionPayload = {
            contents: [{
                parts: [
                    { text: VISION_PROMPT },
                    { inline_data: { mime_type: mainMimeType, data: mainImageBase64 } }
                ]
            }],
            generation_config: {
                temperature: 0.35, 
                max_output_tokens: 500
            }
        };

        const visionRes = await fetch(visionEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(visionPayload)
        });

        if (!visionRes.ok) {
            const errText = await visionRes.text();
            throw new Error(`Vision API Error: ${visionRes.status} - ${errText}`);
        }
        
        const visionData = await visionRes.json();
        const candidate = visionData.candidates?.[0];
        
        if (candidate?.finishReason === 'SAFETY') {
             throw new Error("A imagem contém elementos bloqueados pela segurança. Tente recortar apenas o tecido.");
        }

        const description = candidate?.content?.parts?.[0]?.text;

        if (!description) {
            throw new Error("A IA analisou a imagem mas não gerou descrição. Tente outra foto.");
        }

        return res.status(200).json({ success: true, description: description.trim() });
    }

    // ==========================================================================================
    // ROTA 3: GERAÇÃO DE ESTAMPAS (TEXT TO IMAGE - FACTORY)
    // ==========================================================================================
    if (action === 'GENERATE_PATTERN') {
        const imageEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
        
        // Reforça o prompt com gatilhos de qualidade técnica
        const finalPrompt = `Seamless repeating pattern, textile design style. ${prompt} . Flat lighting, 8k resolution, highly detailed fabric texture, no shadows, 2d vector or raster art.`;
        
        const payload = {
            contents: [{ parts: [{ text: finalPrompt }] }],
            generation_config: {
                response_mime_type: "image/jpeg",
                aspect_ratio: "1:1"
            }
        };

        const googleResponse = await fetch(imageEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!googleResponse.ok) {
            const err = await googleResponse.text();
            throw new Error(`Erro na Geração de Estampa: ${err}`);
        }

        const data = await googleResponse.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find(p => p.inline_data);
        
        if (!imagePart) {
             throw new Error("A IA recusou a geração (Safety Filter). Tente descrever de forma menos específica.");
        }

        return res.status(200).json({ 
            success: true, 
            image: `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}` 
        });
    }

    // ==========================================================================================
    // ROTA 4: ANÁLISE TÉCNICA DE ROUPAS (PADRÃO)
    // ==========================================================================================
    
    // --- PROMPT MESTRE VINGI INDUSTRIAL v5.3 ---
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
        throw new Error(`Google API Error (${googleResponse.status}): ${errorText}`);
    }

    const data = await googleResponse.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) throw new Error("A IA analisou a imagem mas não gerou texto.");

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
