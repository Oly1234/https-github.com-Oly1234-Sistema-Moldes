import { GoogleGenAI, Part } from "@google/genai";
import { MASTER_SYSTEM_PROMPT } from "../constants";
import { PatternAnalysisResult } from "../types";

// VALIDAÇÃO CRÍTICA DE API KEY PARA EVITAR TELA BRANCA
const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("CRITICAL ERROR: API_KEY is missing from environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy_key_to_prevent_init_crash' });

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

export const analyzeClothingImage = async (
  mainImageBase64: string, 
  mainMimeType: string,
  secondaryImageBase64?: string | null,
  secondaryMimeType?: string | null
): Promise<PatternAnalysisResult> => {
  
  if (!apiKey) {
    throw new Error("CHAVE DE API NÃO CONFIGURADA. O sistema não pode se conectar ao cérebro da IA. Verifique as configurações do Vercel.");
  }

  try {
    const parts: Part[] = [
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
        1. Interprete a imagem e extraia o DNA TÊXTIL.
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
        // responseMimeType ensures valid JSON output and helps prevent truncation issues by prioritizing structure
        responseMimeType: "application/json",
      }
    });

    if (!response.text) {
      throw new Error("No response text from Gemini");
    }

    let cleanText = response.text.trim();
    
    // Remove markdown code blocks if present (even with mimeType, sometimes they appear)
    if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '');
    }
    
    const result = JSON.parse(cleanText) as PatternAnalysisResult;
    return result;

  } catch (error) {
    console.error("Error analyzing image:", error);
    if (error instanceof SyntaxError) {
        throw new Error("Erro de processamento (JSON inválido). A resposta da IA foi corrompida. Tente novamente com uma foto mais clara.");
    }
    throw error;
  }
};