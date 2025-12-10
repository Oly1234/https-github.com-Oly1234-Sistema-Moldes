import { GoogleGenAI, Part } from "@google/genai";
import { MASTER_SYSTEM_PROMPT } from "../constants";
import { PatternAnalysisResult } from "../types";

// Removed Stealth Key System to comply with security guidelines:
// The API key must be obtained exclusively from process.env.API_KEY.

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
  
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
     throw new Error("API Key not found in process.env.API_KEY");
  }

  // Inicializa a IA usando diretamente a chave de ambiente
  const ai = new GoogleGenAI({ apiKey });

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
    
    const result = JSON.parse(cleanText) as PatternAnalysisResult;
    return result;

  } catch (error: any) {
    console.error("Error analyzing image:", error);

    // TRATAMENTO DE ERROS REAIS
    if (error.message?.includes('403') || error.message?.includes('API key')) {
        throw new Error("ERRO DE SEGURANÇA (403): Chave API inválida ou bloqueada.");
    }
    
    if (error.message?.includes('503') || error.message?.includes('Overloaded')) {
        throw new Error("Servidores do Gemini sobrecarregados. Tente novamente em alguns segundos.");
    }

    if (error instanceof SyntaxError) {
        throw new Error("Erro de processamento (JSON inválido). A IA falhou em estruturar os dados. Tente novamente.");
    }
    throw error;
  }
};