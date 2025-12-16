
import { analyzeColorTrend } from './modules/departments/color.js';
import { refineDesignPrompt } from './modules/departments/atelier.js'; // Agora faz Vision Analysis
import { analyzeVisualDNA } from './modules/departments/forensics.js';
import { generateMarketLinks } from './modules/departments/market.js';
import { getLinkPreview } from './modules/scraper.js';
import { generatePattern } from './modules/generator.js'; 
import { reconstructElement, transformElement, decomposePattern } from './modules/departments/layerLab.js'; 
import { enhancePatternQuality } from './modules/departments/qualityControl.js'; 

export default async function handler(req, res) {
  // Configuração CORS
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
    const { action, prompt, colors, mainImageBase64, mainMimeType, targetUrl, backupSearchTerm, linkType, userReferenceImage, textileSpecs, userHints, cropBase64, commandText } = req.body;
    
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY || process.env.VITE_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;
    if (!apiKey) return res.status(500).json({ error: "Chave de API não configurada no servidor." });

    // --- ROTEAMENTO ---

    if (action === 'VOICE_COMMAND') {
        const ROUTER_PROMPT = `
        ACT AS: Vingi OS Navigation System.
        USER SAID: "${commandText}"
        OUTPUT JSON: { "targetView": "MODULE_NAME", "message": "Context message" }
        `;
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: ROUTER_PROMPT }] }] }) });
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const result = JSON.parse(cleanJson(text));
        return res.status(200).json({ success: true, ...result });
    }

    if (action === 'GET_LINK_PREVIEW') {
        const contextType = (backupSearchTerm && backupSearchTerm.includes('pattern')) ? 'SURFACE' : 'CLOTHING';
        const image = await getLinkPreview(targetUrl, backupSearchTerm, userReferenceImage, apiKey, contextType, linkType);
        return res.status(200).json({ success: true, image });
    }

    if (action === 'RECONSTRUCT_ELEMENT') {
        const result = await reconstructElement(apiKey, cropBase64);
        return res.status(200).json({ success: true, ...result });
    }

    // --- GERAÇÃO DE ESTAMPAS (SIMPLIFICADO) ---
    
    // 1. ANÁLISE DE REFERÊNCIA (Imagem -> Prompt)
    if (action === 'ANALYZE_REFERENCE_FOR_PROMPT') {
        // Usa a função atualizada em atelier.js que imita 'analyzePatternFromImage'
        const extractedPrompt = await refineDesignPrompt(apiKey, mainImageBase64);
        // Extrai cores também para ajudar
        const colorData = await analyzeColorTrend(apiKey, mainImageBase64, 'image/jpeg', cleanJson);
        
        return res.status(200).json({ 
            success: true, 
            prompt: extractedPrompt,
            colors: colorData.colors 
        });
    }

    // 2. GERAÇÃO (Prompt -> Imagem)
    if (action === 'GENERATE_PATTERN') {
        try {
            const image = await generatePattern(apiKey, prompt, colors);
            return res.status(200).json({ success: true, image });
        } catch (genError) {
            console.error("Generation Failed:", genError);
            return res.status(200).json({ success: false, error: genError.message || "Erro na geração." });
        }
    }

    // --- FIM GERAÇÃO ---

    if (action === 'DESCRIBE_PATTERN') {
        const colorData = await analyzeColorTrend(apiKey, mainImageBase64, mainMimeType, cleanJson, (userHints && userHints.includes('VARIATION') ? userHints.split(':')[1].trim() : 'NATURAL'));
        const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType, cleanJson, 'TEXTURE', userHints);
        const matches = generateMarketLinks(visualData, 'TEXTURE');
        return res.status(200).json({ success: true, colors: colorData.colors, prompt: visualData.visualDescription, technicalSpecs: visualData.technicalSpecs, stockMatches: matches });
    }

    if (action === 'SCAN_CLOTHING' || !action) { 
        const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType, cleanJson, 'GARMENT');
        const matches = generateMarketLinks(visualData, 'GARMENT');
        const matchesGrouped = { exact: matches.filter(m => m.similarityScore >= 93), close: matches.filter(m => m.similarityScore >= 92 && m.similarityScore < 93), adventurous: matches.filter(m => m.similarityScore < 92) };
        return res.status(200).json({ patternName: visualData.visualDescription, technicalDna: visualData.technicalSpecs, matches: matchesGrouped, curatedCollections: [], recommendedResources: [] });
    }
    
    return res.status(200).json({ success: false, error: "Ação desconhecida" });

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(503).json({ error: error.message || "Erro interno no servidor." });
  }
}