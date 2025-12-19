
import { GoogleGenAI } from "@google/genai";

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
    const { action, imageBase64, userPrompt, layersInfo } = req.body;
    let apiKey = process.env.API_KEY;
    const ai = new GoogleGenAI({ apiKey });

    // ANALISAR SEMÂNTICA DOS ELEMENTOS (Identificar o que é o que para renomear camadas)
    if (action === 'ANALYZE_ELEMENTS') {
        const prompt = "Analyze this image and list the distinct visual elements (e.g., 'Red Flower', 'Background Texture', 'Green Leaves'). Output JSON ONLY: { 'elements': [{'id': 1, 'name': '...'}, ...] }";
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/png', data: imageBase64 } }] }],
            config: { responseMimeType: "application/json" }
        });
        return res.status(200).json(JSON.parse(cleanJson(response.text)));
    }

    // MODO PRODUÇÃO (REFINAMENTO FINAL - OPCEIONAL)
    if (action === 'EXPORT_PRODUCTION') {
        const productionPrompt = `Refine this textile pattern layer. 
        - Clean noise and artifacts.
        - Sharpen edges for production.
        - Ensure texture consistency.
        Target: Industrial Textile Quality. Original Style: ${userPrompt || 'Direct'}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp', // Usando modelo flash para refinamento rápido
            contents: [{ parts: [{ text: productionPrompt }, { inlineData: { mimeType: 'image/png', data: imageBase64 } }] }]
        });
        
        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imagePart) {
            return res.status(200).json({ success: true, image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}` });
        }
        return res.status(500).json({ error: "Falha ao gerar arquivo de produção." });
    }

    return res.status(200).json({ success: true, message: "Endpoint Layer Studio Ativo" });

  } catch (error) {
    res.status(503).json({ error: error.message });
  }
}
