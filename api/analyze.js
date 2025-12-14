
import { analyzeColorTrend } from './modules/departments/color.js';
import { createTextileDesign } from './modules/departments/atelier.js';
import { analyzeVisualDNA } from './modules/departments/forensics.js';
import { generateMarketLinks } from './modules/departments/market.js';
import { getLinkPreview } from './modules/scraper.js';
import { generatePattern } from './modules/generator.js'; // Importando o novo generator corrigido

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
    const { action, prompt, colors, mainImageBase64, mainMimeType, targetUrl, backupSearchTerm, linkType, userReferenceImage, textileSpecs, userHints } = req.body;
    
    // API KEY MANAGER (Prioridade: ENV Var > VITE Var)
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY || process.env.VITE_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;
    if (!apiKey) return res.status(500).json({ error: "Chave de API não configurada no servidor." });

    // --- ROTEAMENTO ESTRITO POR ABA (DEPARTAMENTOS) ---

    // 1. UTILITÁRIO GERAL (Imagem de Preview dos Links)
    if (action === 'GET_LINK_PREVIEW') {
        const contextType = (backupSearchTerm && backupSearchTerm.includes('pattern')) ? 'SURFACE' : 'CLOTHING';
        const image = await getLinkPreview(targetUrl, backupSearchTerm, userReferenceImage, apiKey, contextType, linkType);
        return res.status(200).json({ success: true, image });
    }

    // 2. ABA CRIADOR (Atelier + Forense de Superfície)
    if (action === 'GENERATE_PATTERN') {
        // Dept: Atelier (Geração de Imagem com Restauração)
        // Se textileSpecs foi enviado pelo frontend, usamos ele.
        // Caso contrário, mantemos compatibilidade (fallback básico).
        const specs = textileSpecs || { layout: 'Seamless', restoration: 'Clean lines' };
        
        const image = await generatePattern(apiKey, prompt, colors, specs);
        return res.status(200).json({ success: true, image });
    }

    if (action === 'DESCRIBE_PATTERN') {
        // Dept: Colorimetria + Forense (Modo Textura) + Mercado (Modo Textura)
        const colorData = await analyzeColorTrend(apiKey, mainImageBase64, mainMimeType, cleanJson);
        
        // Passa as userHints para a análise forense
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

    // 3. ABA SCANNER (Forense de Roupa + Mercado de Moldes)
    if (action === 'SCAN_CLOTHING' || !action) { 
        // Dept: Forense (Modo Desmembramento de Roupa)
        const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType, cleanJson, 'GARMENT');
        
        // Dept: Mercado (Usa os termos ricos para criar links variados)
        const matches = generateMarketLinks(visualData, 'GARMENT');
        
        // Agrupamento para UI
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
