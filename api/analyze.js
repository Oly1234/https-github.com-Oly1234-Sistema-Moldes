
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
    const { mainImageBase64, mainMimeType, secondaryImageBase64, secondaryMimeType } = req.body;
    
    // --- GESTÃO DE CHAVES ---
    // Atualizado para buscar a nova variável: MOLDESKEY
    
    let apiKey = null;
    const envKey = process.env.MOLDESKEY;
    
    if (envKey) {
        // Limpeza de segurança (remove aspas ou espaços que podem vir do copy-paste)
        const cleanKey = envKey.replace(/['"\s]/g, '');
        if (cleanKey.length > 20) {
            apiKey = cleanKey;
            // Log de Segurança (Mostra apenas o início para debug na Vercel)
            console.log(`System: Usando Chave MOLDESKEY iniciando em ${cleanKey.substring(0, 4)}...`);
        }
    }

    if (!apiKey) {
        console.error("System Error: MOLDESKEY não encontrada ou inválida nas variáveis de ambiente.");
        return res.status(500).json({ error: "Configuração de Servidor: Variável MOLDESKEY não encontrada na Vercel. Verifique as configurações." });
    }

    const MASTER_SYSTEM_PROMPT = `
Você é o Analista Técnico Sênior VINGI. Sua missão é interpretar a imagem da peça de roupa e encontrar os moldes de costura (sewing patterns) mais compatíveis na internet.

### REGRAS CRUCIAIS DE BUSCA:
1. **FOCO NO LINK CORRETO:** O mais importante é que o usuário caia em uma página funcional.
   * Se for um molde específico, use o link do produto.
   * Se não tiver certeza absoluta, crie um **LINK DE BUSCA INTERNA** da loja (ex: etsy.com/search?q=...). Isso evita erros 404 e é mais útil.
2. **DIVERSIDADE:** Busque em Etsy, Burda Style, Mood Fabrics, The Fold Line, Makerist, Simplicity, Vogue Patterns.
3. **PRECISÃO TÉCNICA:** Identifique o DNA da peça (ex: "Raglan Sleeve", "Empire Waist") e use esses termos para encontrar os moldes.
4. **IMAGEM:** O Frontend usará o LOGO da marca se a imagem falhar, mas tente ser preciso nos metadados.

### ESTRUTURA DE DADOS:
Classifique cada resultado encontrado em:
* **EXACT:** O molde é visualmente idêntico.
* **CLOSE:** Mesma estrutura, detalhes diferentes.
* **ADVENTUROUS:** Vibe similar, mas construção diferente.
`;

    const JSON_SCHEMA_PROMPT = `
Responda APENAS com JSON válido.

{
  "patternName": "string",
  "category": "string",
  "technicalDna": { 
    "silhouette": "string", 
    "neckline": "string", 
    "sleeve": "string", 
    "fabricStructure": "string"
  },
  "matches": {
    "exact": [
      { 
        "source": "string", 
        "patternName": "string", 
        "similarityScore": 99, 
        "type": "PAGO/GRATIS", 
        "url": "string", 
        "imageUrl": "string",
        "description": "string"
      }
    ],
    "close": [],
    "adventurous": []
  },
  "curatedCollections": [
      {
          "sourceName": "string",
          "title": "string",
          "itemCount": "string",
          "searchUrl": "string",
          "description": "string",
          "icon": "SHOPPING"
      }
  ],
  "recommendedResources": [
    {
      "name": "string",
      "type": "PURCHASE", 
      "url": "string",
      "description": "string"
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

    parts.push({
        text: `VOCÊ É O ANALISTA TÉCNICO VINGI.
        1. Interprete a imagem e extraia do DNA TÊXTIL.
        2. Retorne UMA LISTA CURADA COM OS MELHORES MOLDES REAIS usando LINKS DE BUSCA SEGURA (ex: search?q=...).
        3. NÃO INVENTE LINKS DE PRODUTOS. Use o formato de busca da loja.
        4. Priorize qualidade sobre quantidade.
        ${JSON_SCHEMA_PROMPT}`
    });

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
             throw new Error("Erro de Autenticação com o Google: A Chave API configurada na Vercel (MOLDESKEY) é inválida ou foi rejeitada.");
        }
        if (googleResponse.status === 403) {
             throw new Error("Chave de API Bloqueada pelo Google. Gere uma nova chave no AI Studio.");
        }

        throw new Error(`Google API Error (${googleResponse.status})`);
    }

    const data = await googleResponse.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
        throw new Error("A IA não retornou texto.");
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
