
import { analyzeColorTrend } from './modules/departments/color.js';
import { createTextileDesign } from './modules/departments/atelier.js';
import { analyzeVisualDNA } from './modules/departments/forensics.js';
import { generateMarketLinks } from './modules/departments/market.js';
import { getLinkPreview } from './modules/scraper.js';
import { generatePattern } from './modules/generator.js'; 
import { reconstructElement, transformElement, decomposePattern } from './modules/departments/layerLab.js'; 

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
    const { action, prompt, colors, mainImageBase64, mainMimeType, targetUrl, backupSearchTerm, linkType, userReferenceImage, textileSpecs, userHints, cropBase64 } = req.body;
    
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY || process.env.VITE_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;
    if (!apiKey) return res.status(500).json({ error: "Chave de API não configurada no servidor." });

    // --- ROTEAMENTO ---

    if (action === 'GET_LINK_PREVIEW') {
        const contextType = (backupSearchTerm && backupSearchTerm.includes('pattern')) ? 'SURFACE' : 'CLOTHING';
        const image = await getLinkPreview(targetUrl, backupSearchTerm, userReferenceImage, apiKey, contextType, linkType);
        return res.status(200).json({ success: true, image });
    }

    // --- NOVO: LAYER LAB V2 ---
    if (action === 'RECONSTRUCT_ELEMENT') {
        // "Isolar e Completar": Recebe o recorte cru, devolve o objeto inteiro vetorizado
        const result = await reconstructElement(apiKey, cropBase64);
        return res.status(200).json({ success: true, ...result });
    }

    if (action === 'TRANSFORM_ELEMENT') {
        // "Transformar": Recebe recorte + prompt do usuário
        const result = await transformElement(apiKey, cropBase64, prompt);
        return res.status(200).json({ success: true, ...result });
    }

    if (action === 'DECOMPOSE_PATTERN') {
        const result = await decomposePattern(apiKey, mainImageBase64);
        return res.status(200).json({ success: true, ...result });
    }

    if (action === 'GENERATE_PATTERN') {
        const specs = textileSpecs || { layout: 'Seamless', restoration: 'Clean lines' };
        const image = await generatePattern(apiKey, prompt, colors, specs);
        return res.status(200).json({ success: true, image });
    }

    if (action === 'DESCRIBE_PATTERN') {
        const colorData = await analyzeColorTrend(apiKey, mainImageBase64, mainMimeType, cleanJson);
        const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType, cleanJson, 'TEXTURE', userHints);
        const matches = generateMarketLinks(visualData, 'TEXTURE');

        return res.status(200).json({ 
            success: true, 
            colors: colorData.colors,
            prompt: visualData.visualDescription,
            technicalSpecs: visualData.technicalSpecs, 
            stockMatches: matches
        });
    }

    if (action === 'SCAN_CLOTHING' || !action) { 
        const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType, cleanJson, 'GARMENT');
        const matches = generateMarketLinks(visualData, 'GARMENT');
        const matchesGrouped = {
            exact: matches.filter(m => m.similarityScore >= 93),
            close: matches.filter(m => m.similarityScore >= 92 && m.similarityScore < 93),
            adventurous: matches.filter(m => m.similarityScore < 92)
        };

        return res.status(200).json({
            patternName: visualData.visualDescription,
            technicalDna: visualData.technicalSpecs,
            matches: matchesGrouped,
            curatedCollections: [],
            recommendedResources: []
        });
    }
    
    return res.status(200).json({ success: false, error: "Ação desconhecida" });

  } catch (error) {
    console.error("Backend Orchestrator Error:", error);
    res.status(503).json({ error: error.message || "Erro interno no servidor." });
  }
}
