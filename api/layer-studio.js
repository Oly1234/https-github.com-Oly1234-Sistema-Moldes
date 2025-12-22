
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  const cleanJson = (text) => {
      if (!text) return null;
      let cleaned = text.replace(/```json/g, '').replace(/```/g, '');
      const first = cleaned.indexOf('{');
      const last = cleaned.lastIndexOf('}');
      if (first !== -1 && last !== -1) { cleaned = cleaned.substring(first, last + 1); }
      return cleaned;
  };

  try {
    const { action, imageBase64, userPrompt, contextData } = req.body;
    let apiKey = process.env.API_KEY;
    const ai = new GoogleGenAI({ apiKey });

    // 1. MOTOR DE SEGMENTAÇÃO SEMÂNTICA ZERO-SHOT (VINGI SAM-X)
    if (action === 'SEMANTIC_SEGMENTATION') {
        const systemInstruction = `Você é o VINGI NEURAL SEGMENTER (Baseado em SAM-X e Vision-Language Models).
        Sua missão é realizar a "Conclusão Semântica" de objetos a partir de entradas esparsas do usuário.
        
        PRINCÍPIOS DE OPERAÇÃO:
        1. COMPLETUDE DO OBJETO (Zero-Shot): Se o usuário pintar ou clicar em uma parte, identifique o objeto INTEIRO (ex: uma pétala -> a flor completa; um rosto -> a pessoa inteira).
        2. EXPANSÃO DE BUSCA: Garante que o retângulo delimitador (bbox) englobe 100% do objeto, expandindo as bordas em 5% para segurança de recorte.
        3. DIFERENCIAÇÃO FUNDO/FIGURA: Isole o elemento principal ignorando sombras projetadas, dobras de tecido ou ruídos de impressão.
        4. UNIVERSALIDADE: Funcione com qualquer categoria (botânica, humana, geométrica, arquitetônica).
        
        FORMATO DE SAÍDA (JSON):
        {
          "objectName": "nome técnico do elemento",
          "bbox": {"ymin": 0, "xmin": 0, "ymax": 1000, "xmax": 1000},
          "analysis": "descrição curta do que foi identificado e o porquê da expansão"
        }`;

        const prompt = contextData?.bbox 
            ? `O usuário marcou uma área aproximada em: ${JSON.stringify(contextData.bbox)}. Realize a SEGMENTAÇÃO SEMÂNTICA COMPLETA deste objeto. Expanda a busca para garantir que o elemento inteiro seja capturado.`
            : `Ponto de interesse: (x:${contextData?.x || 0.5}, y:${contextData?.y || 0.5}). Identifique e retorne o BBox do objeto completo que contém este ponto.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [
                { text: prompt }, 
                { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
            ] }],
            config: { 
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        objectName: { type: Type.STRING },
                        bbox: {
                            type: Type.OBJECT,
                            properties: {
                                ymin: { type: Type.NUMBER },
                                xmin: { type: Type.NUMBER },
                                ymax: { type: Type.NUMBER },
                                xmax: { type: Type.NUMBER }
                            },
                            required: ["ymin", "xmin", "ymax", "xmax"]
                        },
                        analysis: { type: Type.STRING }
                    },
                    required: ["objectName", "bbox"]
                }
            }
        });
        
        return res.status(200).json(JSON.parse(cleanJson(response.text)));
    }

    // 2. SEPARAÇÃO INDUSTRIAL DE CORES (Mantido)
    if (action === 'COLOR_SEPARATION') {
        const prompt = `Analyze this textile print for industrial color separation.
        Group colors by: BACKGROUND, PRIMARY MOTIFS, SECONDARY MOTIFS, DETAILS.
        Provide Pantone TCX suggestions for each.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }] }],
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        groups: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING },
                                    colors: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                hex: { type: Type.STRING },
                                                name: { type: Type.STRING },
                                                pantone: { type: Type.STRING }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        return res.status(200).json(JSON.parse(cleanJson(response.text)));
    }

    // 3. REFINAMENTO DE PRODUÇÃO (Mantido)
    if (action === 'EXPORT_PRODUCTION') {
        const prodPrompt = `Industrial Refinement for Production:
        - Harmonize edges and textures.
        - Normalize color groups for digital or screen printing.
        - Output a high-fidelity textile asset.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: prodPrompt }, { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }] }]
        });
        
        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imagePart) {
            return res.status(200).json({ success: true, image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}` });
        }
    }

    return res.status(200).json({ success: true, message: "Endpoint Layer Studio Pro Ativo" });

  } catch (error) {
    console.error("API Studio Error:", error);
    res.status(503).json({ error: error.message });
  }
}
