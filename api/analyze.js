
export default async function handler(req, res) {
  // 1. Configuração Manual de CORS (Crucial para o Frontend acessar o Backend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 2. Responder rápido a pre-flight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. Bloquear métodos não permitidos
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    // 4. Ler Corpo da Requisição (Vercel já faz o parse se for JSON)
    const { mainImageBase64, mainMimeType, secondaryImageBase64, secondaryMimeType } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("CRITICAL: GEMINI_API_KEY não encontrada nas variáveis de ambiente.");
      res.status(500).json({ error: 'Server Config Error: API Key missing.' });
      return;
    }

    // 5. Definição dos Prompts (Injetados diretamente para evitar dependências)
    const MASTER_SYSTEM_PROMPT = `
Você é o Analista Técnico Sênior VINGI. Sua missão é interpretar a imagem da peça de roupa e encontrar os moldes de costura (sewing patterns) mais compatíveis na internet.

### REGRAS CRUCIAIS DE BUSCA:
1. **FOCO NO LINK CORRETO:** O mais importante é que o usuário caia em uma página funcional.
   * Se for um molde específico, use o link do produto.
   * Se não tiver certeza absoluta, crie um **LINK DE BUSCA INTERNA** da loja (ex: etsy.com/search?q=...). Isso evita erros 404 e é mais útil.
2. **DIVERSIDADE:** Busque em Etsy, Burda Style, Mood Fabrics, The Fold Line, Makerist, Simplicity, Vogue Patterns.
3. **PRECISÃO TÉCNICA:** Identifique o DNA da peça (ex: "Raglan Sleeve", "Empire Waist") e use esses termos para encontrar os moldes.
4. **NÃO INVENTE:** Se não achar o molde exato, ache um "Similar Style" e marque como tal. Não crie URLs falsas.
5. **IMAGEM:** O Frontend usará o LOGO da marca. Não se preocupe em extrair URLs de imagens complexas, foque na qualidade do link do molde.

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

    // 6. Construção da Requisição REST Manual (Sem SDK)
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
        2. Retorne 50 MOLDES REAIS usando LINKS DE BUSCA SEGURA (ex: search?q=...).
        3. NÃO INVENTE LINKS DE PRODUTOS. Use o formato de busca da loja.
        4. Diversifique: Mood Fabrics, Etsy, Burda, Simplicity.
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

    // 7. Chamada Fetch para o Google (Server-to-Server)
    const googleResponse = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!googleResponse.ok) {
        const errorText = await googleResponse.text();
        console.error("Gemini API Error:", errorText);
        throw new Error(`Google API Error (${googleResponse.status}): ${errorText}`);
    }

    const data = await googleResponse.json();
    
    // 8. Extração e Limpeza da Resposta
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
        throw new Error("A IA não retornou texto.");
    }

    let cleanText = generatedText.trim();
    if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '');
    }

    // 9. Validação do JSON
    const jsonResult = JSON.parse(cleanText);

    // 10. Sucesso
    res.status(200).json(jsonResult);

  } catch (error) {
    console.error("Backend Handler Error:", error);
    res.status(500).json({ 
        error: error.message || 'Erro Interno do Servidor', 
        details: error.toString() 
    });
  }
}
