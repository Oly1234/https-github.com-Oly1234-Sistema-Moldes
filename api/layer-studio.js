
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

    // 1. SEGMENTAÇÃO SEMÂNTICA / GUIADA POR TEXTO
    if (action === 'SEMANTIC_SEGMENTATION') {
        const systemPrompt = `Você é um especialista em visão computacional têxtil avançada.
        Sua tarefa é localizar com precisão milimétrica o objeto descrito pelo usuário ou o elemento principal clicado.
        
        INSTRUÇÕES:
        - Identifique o "Elemento Inteiro" (Ex: Flor completa incluindo pétalas e miolo).
        - Retorne as coordenadas normalizadas (0-1000) do retângulo delimitador (bbox).
        - Descreva brevemente o que compõe o elemento.`;

        const prompt = userPrompt 
            ? `Localize e segmente o seguinte: "${userPrompt}"` 
            : `O usuário clicou em (x:${contextData?.x || 0.5}, y:${contextData?.y || 0.5}). Localize o objeto completo (flor, folha, arabesco) que contém este ponto.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [
                { text: systemPrompt + "\n\n" + prompt }, 
                { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
            ] }],
            config: { 
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
        
        const outputText = response.text;
        return res.status(200).json(JSON.parse(cleanJson(outputText)));
    }

    // 2. SEPARAÇÃO INDUSTRIAL DE CORES
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

    // 3. REFINAMENTO DE PRODUÇÃO
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
