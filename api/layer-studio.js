
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

    // 1. SEPARAÇÃO INDUSTRIAL DE CORES
    if (action === 'COLOR_SEPARATION') {
        const prompt = `Analyze this textile print for industrial color separation.
        Group colors by: BACKGROUND, PRIMARY MOTIFS, SECONDARY MOTIFS, DETAILS.
        Provide Pantone TCX suggestions for each.
        Output JSON: { "groups": [ { "type": "BACKGROUND", "colors": [ {"hex": "#...", "name": "...", "pantone": "..."} ] } ] }`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/png', data: imageBase64 } }] }],
            config: { responseMimeType: "application/json" }
        });
        return res.status(200).json(JSON.parse(cleanJson(response.text)));
    }

    // 2. ANÁLISE DE PINCEL CONTEXTUAL
    if (action === 'SMART_BRUSH_PROPOSAL') {
        const prompt = `The user is painting over an area in this print. 
        Context: ${userPrompt || 'Suggest variation'}.
        Analyze the surrounding style, scale, and colors.
        Propose 3 variations for this element that maintain the print's identity.
        Output JSON: { "proposals": ["proposal 1", "proposal 2", "proposal 3"] }`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/png', data: imageBase64 } }] }],
            config: { responseMimeType: "application/json" }
        });
        return res.status(200).json(JSON.parse(cleanJson(response.text)));
    }

    // 3. REFINAMENTO DE PRODUÇÃO (EXPORTAÇÃO FINAL)
    if (action === 'EXPORT_PRODUCTION') {
        const prodPrompt = `Industrial Refinement for Production:
        - Harmonize edges and textures.
        - Normalize color groups for digital or screen printing.
        - Output a high-fidelity textile asset.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [{ parts: [{ text: prodPrompt }, { inlineData: { mimeType: 'image/png', data: imageBase64 } }] }]
        });
        
        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imagePart) {
            return res.status(200).json({ success: true, image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}` });
        }
    }

    return res.status(200).json({ success: true, message: "Endpoint Layer Studio Pro Ativo" });

  } catch (error) {
    res.status(503).json({ error: error.message });
  }
}
