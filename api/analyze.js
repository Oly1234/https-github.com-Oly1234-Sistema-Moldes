
import { analyzeColorTrend } from './modules/departments/color.js';
import { refineDesignPrompt } from './modules/departments/atelier.js'; 
import { analyzeVisualDNA } from './modules/departments/forensics.js';
import { generateMarketLinks } from './modules/departments/market.js';
import { getLinkPreview } from './modules/scraper.js';
import { generatePattern, generateTextureLayer } from './modules/generator.js'; 
import { reconstructElement, transformElement } from './modules/departments/layerLab.js'; 
import { generateHighResProductionFile } from './modules/departments/qualityControl.js';

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
    const { action, prompt, colors, mainImageBase64, mainMimeType, targetUrl, backupSearchTerm, linkType, userReferenceImage, cropBase64, commandText, selvedge, variation, technique, colorCount, layoutStyle, subLayoutStyle, artStyle, targetSize, customStyle, textureType, texturePrompt, userPrompt } = req.body;
    
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY || process.env.VITE_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;
    if (!apiKey) return res.status(500).json({ error: "Chave de API não configurada no servidor." });

    if (action === 'VOICE_COMMAND') {
        const ROUTER_PROMPT = `Map user command to view: HOME, SCANNER, CREATOR, ATELIER, LAYER_STUDIO, MOCKUP, RUNWAY, HISTORY, TECHNICAL_HUB.
        Keywords for TECHNICAL_HUB: ficha, técnica, hub, industrial, produção, especificação.`;
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: ROUTER_PROMPT + `\nCommand: ${commandText}` }] }] }) });
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return res.status(200).json({ success: true, targetView: text || 'HOME', message: "Navegando..." });
    }

    if (action === 'GET_LINK_PREVIEW') {
        const image = await getLinkPreview(targetUrl, backupSearchTerm, userReferenceImage, apiKey, 'CLOTHING', linkType);
        return res.status(200).json({ success: true, image });
    }

    if (action === 'RECONSTRUCT_ELEMENT') {
        const result = await reconstructElement(apiKey, cropBase64);
        return res.status(200).json({ success: true, ...result });
    }

    if (action === 'TRANSFORM_ELEMENT') {
        const result = await transformElement(apiKey, cropBase64, userPrompt);
        return res.status(200).json({ success: true, ...result });
    }
    
    // NOVO MOTOR DE BUSCA DE MODELOS BRANCOS (HIGH DEFINITION & PINTEREST MODE)
    if (action === 'FIND_WHITE_MODELS') {
        let searchTerm = prompt;
        
        if (mainImageBase64) {
            const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType || 'image/jpeg', cleanJson, 'GARMENT');
            searchTerm = visualData.visualDescription || prompt || "Vestido Feminino"; 
        }

        // Fontes de Alta Qualidade (Pinterest, Vogue, Street Style)
        const sources = [
            { name: "Pinterest", q: "Pinterest aesthetic white dress" },
            { name: "Vogue", q: "Vogue runway white fashion" },
            { name: "Zara", q: "Zara white clothing editorial" },
            { name: "Street Style", q: "Paris street style white outfit" },
            { name: "Revolve", q: "Revolve clothing white" },
            { name: "Net-a-Porter", q: "luxury fashion white dress" },
            { name: "Farm Rio", q: "Farm Rio white dress mockup" },
            { name: "Wedding", q: "Modern bridal white dress simple" },
            { name: "Minimal", q: "Minimalist fashion white linen" },
            { name: "Boho", q: "Boho chic white dress beach" },
            { name: "Studio", q: "Fashion studio photography white background" },
            { name: "Urban", q: "Urban outfitters white dress" },
            { name: "Linen", q: "White linen dress texture" },
            { name: "Silk", q: "White silk dress slip" },
            { name: "Cotton", q: "White cotton dress summer" }
        ];

        // Modificadores de Variação (Para evitar repetições)
        const variations = [
            "full body shot high resolution",
            "close up texture 4k",
            "back view detail",
            "walking motion blur",
            "sitting pose elegant",
            "sunlight shadow play",
            "studio lighting soft",
            "architectural background",
            "natural light outdoor",
            "isolated white background"
        ];

        const createModelLink = (sourceObj, variation, index) => {
            const finalQuery = `${sourceObj.q} ${variation} ${searchTerm}`.trim();
            return {
                source: `${sourceObj.name}`,
                patternName: `Modelo ${index + 1}: ${searchTerm}`, 
                similarityScore: 90,
                type: "GLOBAL",
                linkType: 'SEARCH_QUERY',
                // URL de busca do Google Images simulando "Large Images"
                url: `https://www.google.com/search?tbm=isch&tbs=isz:l&q=${encodeURIComponent(finalQuery)}`,
                // O termo de backup inclui "high quality" para o proxy do Bing
                backupSearchTerm: `${finalQuery} high quality photo -drawing -sketch`,
                imageUrl: null
            };
        };

        const queries = [];
        let globalIndex = 0;

        // Gera 50+ resultados combinando Fonte x Variação de forma Determinística mas Variada
        while (queries.length < 60) {
            const src = sources[globalIndex % sources.length];
            // Usa o índice global para rotacionar variações, garantindo que Zara não tenha sempre a mesma pose
            const vari = variations[(globalIndex + Math.floor(globalIndex/sources.length)) % variations.length];
            
            queries.push(createModelLink(src, vari, globalIndex));
            globalIndex++;
        }

        return res.status(200).json({ success: true, queries: queries, detectedStructure: searchTerm });
    }

    if (action === 'ANALYZE_REFERENCE_FOR_PROMPT') {
        const extractedPrompt = await refineDesignPrompt(apiKey, mainImageBase64);
        return res.status(200).json({ success: true, prompt: extractedPrompt });
    }

    if (action === 'ANALYZE_COLOR_TREND') {
        const colorData = await analyzeColorTrend(apiKey, mainImageBase64, 'image/jpeg', cleanJson, variation || 'NATURAL');
        return res.status(200).json({ success: true, colors: colorData.colors });
    }

    if (action === 'GENERATE_PATTERN') {
        const image = await generatePattern(apiKey, prompt, colors, selvedge, technique, colorCount, layoutStyle, subLayoutStyle, artStyle, targetSize, customStyle);
        return res.status(200).json({ success: true, image });
    }

    if (action === 'GENERATE_TEXTURE') {
        const textureImage = await generateTextureLayer(apiKey, textureType, texturePrompt);
        return res.status(200).json({ success: true, image: textureImage });
    }

    if (action === 'PREPARE_PRODUCTION') {
        const enhancedImage = await generateHighResProductionFile(apiKey, mainImageBase64, targetSize, technique, layoutStyle);
        return res.status(200).json({ success: true, image: enhancedImage });
    }

    if (action === 'DESCRIBE_PATTERN') {
        const colorData = await analyzeColorTrend(apiKey, mainImageBase64, mainMimeType, cleanJson, 'NATURAL');
        const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType, cleanJson, 'TEXTURE');
        const matches = generateMarketLinks(visualData, 'TEXTURE');
        return res.status(200).json({ success: true, colors: colorData.colors, prompt: visualData.visualDescription, technicalSpecs: visualData.technicalSpecs, stockMatches: matches });
    }

    if (action === 'SCAN_CLOTHING' || !action) { 
        const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType, cleanJson, 'GARMENT');
        const matches = generateMarketLinks(visualData, 'GARMENT');
        return res.status(200).json({ patternName: visualData.visualDescription, technicalDna: visualData.technicalSpecs, matches: { exact: matches, close: [], adventurous: [] } });
    }
    
    return res.status(200).json({ success: false, error: "Ação desconhecida" });

  } catch (error) {
    res.status(503).json({ error: error.message || "Erro interno no servidor." });
  }
}
