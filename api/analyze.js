
import { analyzeClothingDna, getClothingStores } from './modules/clothing.js';
import { analyzeSurfaceDesign, getSurfaceMarketplaces } from './modules/surface.js';
import { generatePattern } from './modules/generator.js';
import { getLinkPreview } from './modules/scraper.js';

export default async function handler(req, res) {
  // Headers CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

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
    const { action, prompt, colors, mainImageBase64, mainMimeType, targetUrl, backupSearchTerm, userReferenceImage } = req.body;
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY || process.env.VITE_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;

    if (!apiKey) return res.status(500).json({ error: "Missing API Key" });

    // 1. LINK PREVIEW & CURADORIA (Bing / Scraper / Curator)
    if (action === 'GET_LINK_PREVIEW') {
        // Detecta o contexto baseado no termo de busca (heurística simples) ou passado pelo front
        // Se o termo tem "pattern" e não "texture", provavelmente é roupa.
        const contextType = (backupSearchTerm && backupSearchTerm.includes('texture')) ? 'SURFACE' : 'CLOTHING';
        
        const image = await getLinkPreview(targetUrl, backupSearchTerm, userReferenceImage, apiKey, contextType);
        
        if (image) return res.status(200).json({ success: true, image });
        return res.status(200).json({ success: false, message: "No visual found" });
    }

    // 2. GERAÇÃO DE ESTAMPA
    if (action === 'GENERATE_PATTERN') {
        try {
            const image = await generatePattern(apiKey, prompt, colors);
            return res.status(200).json({ success: true, image });
        } catch (e) {
            return res.status(200).json({ success: false, error: e.message });
        }
    }

    // 3. ANÁLISE DE SUPERFÍCIE (Patterns)
    if (action === 'DESCRIBE_PATTERN') {
        try {
            const analysis = await analyzeSurfaceDesign(apiKey, mainImageBase64, mainMimeType, cleanJson);
            const matches = getSurfaceMarketplaces(analysis);
            return res.status(200).json({ success: true, ...analysis, stockMatches: matches });
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: "Analysis Failed" });
        }
    }

    // 4. ANÁLISE DE ROUPA (Moldes)
    if (action === 'SCAN_CLOTHING' || !action) { 
        try {
            const analysis = await analyzeClothingDna(apiKey, mainImageBase64, mainMimeType, cleanJson);
            const matches = getClothingStores(analysis);
            return res.status(200).json({
                patternName: analysis.patternName,
                technicalDna: analysis.technicalDna || {}, 
                matches: matches,
                curatedCollections: [],
                recommendedResources: []
            });
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: "Clothing Analysis Failed" });
        }
    }
    
    return res.status(200).json({ success: false });

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(503).json({ error: "Service Unavailable" });
  }
}
