
import { analyzeColorTrend } from './modules/departments/color.js';
import { createTextileDesign } from './modules/departments/atelier.js';
import { analyzeVisualDNA } from './modules/departments/forensics.js';
import { generateMarketLinks } from './modules/departments/market.js';
import { getLinkPreview } from './modules/scraper.js';

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
    const { action, prompt, colors, mainImageBase64, mainMimeType, targetUrl, backupSearchTerm, linkType, userReferenceImage } = req.body;
    
    // API KEY MANAGER
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY || process.env.VITE_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;
    if (!apiKey) return res.status(500).json({ error: "Missing API Key" });

    // --- ROTEAMENTO DE DEPARTAMENTOS ---

    // 1. DEPARTAMENTO DE SCRAPER (Link Preview)
    if (action === 'GET_LINK_PREVIEW') {
        const contextType = (backupSearchTerm && backupSearchTerm.includes('pattern')) ? 'SURFACE' : 'CLOTHING';
        const image = await getLinkPreview(targetUrl, backupSearchTerm, userReferenceImage, apiKey, contextType, linkType);
        return res.status(200).json({ success: true, image });
    }

    // 2. ATELIER DIGITAL (Geração de Imagem)
    if (action === 'GENERATE_PATTERN') {
        const image = await createTextileDesign(apiKey, prompt, colors);
        return res.status(200).json({ success: true, image });
    }

    // 3. ANÁLISE DE SUPERFÍCIE (Pattern Creator Tab)
    if (action === 'DESCRIBE_PATTERN') {
        // Chama Dept de Cor
        const colorData = await analyzeColorTrend(apiKey, mainImageBase64, mainMimeType, cleanJson);
        // Chama Dept Forense (Visual)
        const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType, cleanJson, 'TEXTURE');
        // Chama Dept de Mercado
        const matches = generateMarketLinks(visualData, 'TEXTURE');

        return res.status(200).json({ 
            success: true, 
            colors: colorData.colors,
            prompt: visualData.visualDescription,
            technicalSpecs: visualData.technicalSpecs,
            stockMatches: matches
        });
    }

    // 4. ANÁLISE DE ROUPA (Scanner Tab)
    if (action === 'SCAN_CLOTHING' || !action) { 
        // Chama Dept Forense (Construção)
        const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType, cleanJson, 'GARMENT');
        // Chama Dept de Mercado
        const matches = generateMarketLinks(visualData, 'GARMENT');
        
        // Formata para o frontend legado
        const matchesGrouped = {
            exact: matches.filter(m => m.similarityScore >= 93),
            close: matches.filter(m => m.similarityScore >= 92 && m.similarityScore < 93),
            adventurous: matches.filter(m => m.similarityScore < 92)
        };

        return res.status(200).json({
            patternName: visualData.visualDescription, // Nome Técnico
            technicalDna: visualData.technicalSpecs,
            matches: matchesGrouped,
            curatedCollections: [],
            recommendedResources: []
        });
    }
    
    return res.status(200).json({ success: false, error: "Ação desconhecida" });

  } catch (error) {
    console.error("Backend Orchestrator Error:", error);
    res.status(503).json({ error: error.message || "Service Unavailable" });
  }
}
