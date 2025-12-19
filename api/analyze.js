
import { analyzeColorTrend } from './modules/departments/color.js';
import { refineDesignPrompt } from './modules/departments/atelier.js'; 
import { analyzeVisualDNA } from './modules/departments/forensics.js';
import { generateMarketLinks } from './modules/departments/market.js';
import { getLinkPreview } from './modules/scraper.js';
import { generatePattern, generateTextureLayer } from './modules/generator.js'; 
import { reconstructElement, transformElement } from './modules/departments/layerLab.js'; 
import { generateHighResProductionFile } from './modules/departments/qualityControl.js';

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
    const { action, prompt, colors, mainImageBase64, mainMimeType, targetUrl, backupSearchTerm, linkType, commandText, technique, layoutStyle, subLayoutStyle, artStyle, customStyle, targetSize, colorCount, textureType, texturePrompt, variation } = req.body;
    
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY || process.env.VITE_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;
    if (!apiKey) return res.status(500).json({ error: "Chave de API não configurada." });

    // --- PROVADOR MÁGICO (RUNWAY) ---
    if (action === 'FIND_WHITE_MODELS') {
        const reference = prompt || "Vestido";
        const MOCKUP_PROMPT = `Generate 55 unique image search queries for a model wearing a SOLID PLAIN WHITE ${reference}. 
        CRITICAL: Focus on professional studio photography with HIGH CONTRAST backgrounds (dark grey, deep blue, vivid colored walls, outdoor nature) to make the white garment easy to segment. 
        Output JSON ONLY: { "queries": ["query 1", "query 2", ...] }`;

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ contents: [{ parts: [{ text: MOCKUP_PROMPT }] }], generationConfig: { response_mime_type: "application/json" } }) 
        });
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = JSON.parse(cleanJson(text));
        return res.status(200).json({ success: true, queries: parsed.queries, detectedStructure: reference });
    }

    // --- ATELIER AI: GERAÇÃO ---
    if (action === 'GENERATE_PATTERN') {
        const imageUrl = await generatePattern(apiKey, prompt, colors, null, technique, colorCount, layoutStyle, subLayoutStyle, artStyle, targetSize, customStyle);
        return res.status(200).json({ success: true, image: imageUrl });
    }

    if (action === 'ANALYZE_COLOR_TREND') {
        const colorData = await analyzeColorTrend(apiKey, mainImageBase64, mainMimeType, cleanJson, variation || 'NATURAL');
        return res.status(200).json({ success: true, colors: colorData.colors });
    }

    if (action === 'GENERATE_TEXTURE') {
        const textureUrl = await generateTextureLayer(apiKey, textureType, texturePrompt);
        return res.status(200).json({ success: true, image: textureUrl });
    }

    if (action === 'PREPARE_PRODUCTION') {
        const hdImage = await generateHighResProductionFile(apiKey, mainImageBase64, targetSize, technique);
        return res.status(200).json({ success: true, image: hdImage });
    }

    // --- RADAR DE ESTAMPAS ---
    if (action === 'DESCRIBE_PATTERN') {
        const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType, cleanJson, 'TEXTURE');
        const stockMatches = generateMarketLinks(visualData, 'TEXTURE');
        return res.status(200).json({ 
            success: true, 
            prompt: visualData.visualDescription, 
            colors: [], // Cores são tratadas em chamada separada no front
            stockMatches: stockMatches,
            technicalSpecs: visualData.technicalSpecs 
        });
    }

    // --- AGENTE DE VOZ ---
    if (action === 'VOICE_COMMAND') {
        const VOICE_SYSTEM = `Analyze voice command: "${commandText}". Identify target module.
        Values: HOME, SCANNER, HISTORY, MOCKUP, CREATOR, ATELIER, LAYER_STUDIO, RUNWAY.
        Output JSON: { "targetView": "VALUE", "message": "Feedback for user" }`;
        
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ contents: [{ parts: [{ text: VOICE_SYSTEM }] }], generationConfig: { response_mime_type: "application/json" } }) 
        });
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return res.status(200).json({ success: true, ...JSON.parse(cleanJson(text)) });
    }

    // --- SCRAPER & PREVIEW ---
    if (action === 'GET_LINK_PREVIEW') {
        const image = await getLinkPreview(targetUrl, backupSearchTerm, null, apiKey, 'CLOTHING', linkType);
        return res.status(200).json({ success: true, image });
    }

    if (action === 'ANALYZE_REFERENCE_FOR_PROMPT') {
        const extractedPrompt = await refineDesignPrompt(apiKey, mainImageBase64);
        return res.status(200).json({ success: true, prompt: extractedPrompt });
    }

    // --- SCANNER DE MOLDES (PADRÃO) ---
    if (action === 'SCAN_CLOTHING' || !action) { 
        const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType, cleanJson, 'GARMENT');
        const matches = generateMarketLinks(visualData, 'GARMENT');
        return res.status(200).json({ 
            patternName: visualData.visualDescription, 
            technicalDna: visualData.technicalSpecs, 
            matches: { exact: matches, close: [], adventurous: [] } 
        });
    }
    
    return res.status(200).json({ success: false, error: "Ação desconhecida" });

  } catch (error) {
    res.status(503).json({ error: error.message });
  }
}
