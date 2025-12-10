
import { GoogleGenAI } from "@google/genai";

// Removido 'runtime: edge' para usar o padrão Node.js Serverless (Mais compatível e seguro para SDKs)

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

Seja técnico, preciso e direto.
`;

const JSON_SCHEMA_PROMPT = `
Output valid JSON only.

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

export default async function handler(req) {
  // CORS Headers para permitir que seu frontend acesse a API
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { mainImageBase64, mainMimeType, secondaryImageBase64, secondaryMimeType } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("Server Error: GEMINI_API_KEY is not set in Vercel Environment Variables.");
      return new Response(JSON.stringify({ error: 'Configuration Error: API Key missing on Server.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const parts = [
      {
        inlineData: {
          mimeType: mainMimeType,
          data: mainImageBase64
        }
      }
    ];

    if (secondaryImageBase64 && secondaryMimeType) {
        parts.push({
            inlineData: {
                mimeType: secondaryMimeType,
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: { parts },
      config: {
        systemInstruction: MASTER_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      }
    });

    if (!response.text) {
      throw new Error("No response text from Gemini");
    }

    let cleanText = response.text.trim();
    if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '');
    }
    
    // Validação básica do JSON antes de enviar
    JSON.parse(cleanText); 

    return new Response(cleanText, {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      }
    });

  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal Server Error',
      details: error.toString()
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      }
    });
  }
}
