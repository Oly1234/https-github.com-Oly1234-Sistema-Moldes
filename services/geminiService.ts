
import { GoogleGenAI, Part } from "@google/genai";
import { MASTER_SYSTEM_PROMPT } from "../constants";
import { PatternAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
        text: `GERAR ACERVO MASSIVO (50+ MOLDES).
        1. Analise a imagem.
        2. Retorne 50 a 60 resultados.
        3. DIVERSIFIQUE: Use The Fold Line, Makerist, Burda, Vogue, Mood, Marlene Mukai.
        4. MENOS ETSY (Max 20%).
        5. USE APENAS LINKS DE BUSCA (/search?q=) OU LINKS DE COLEÇÃO SEGURA. 
        6. PRIORIZE MOOD FABRICS (SEWCIETY) PARA GRATUITOS.
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
        throw new Error("Erro de processamento (JSON inválido). A resposta foi muito longa ou cortada. Tente novamente.");
    }
    throw error;
  }
};
