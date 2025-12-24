
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

    // --- ROTEAMENTO ---

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
    
    // NOVO MOTOR DE BUSCA DE MODELOS BRANCOS (MARKETPLACE SIMULATION v3)
    if (action === 'FIND_WHITE_MODELS') {
        let searchTerm = prompt;
        
        // 1. Se tiver imagem, analisa o DNA primeiro
        if (mainImageBase64) {
            const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType || 'image/jpeg', cleanJson, 'GARMENT');
            searchTerm = visualData.visualDescription || prompt || "Vestido Feminino"; 
        }

        // 2. Estratégia de "Marcas Virtuais" e Contextos (Copiando lógica do Scanner)
        // Isso força o buscador a tratar cada query como uma entidade diferente.
        const marketSources = [
            { name: "Zara Style", query: "Zara white dress lookbook" },
            { name: "H&M Studio", query: "H&M white clothing studio" },
            { name: "Vogue Editorial", query: "Vogue fashion photography white dress" },
            { name: "Street Style", query: "Paris fashion week street style white" },
            { name: "Revolve", query: "Revolve clothing white dress model" },
            { name: "Net-a-Porter", query: "luxury fashion e-commerce white dress" },
            { name: "Mango", query: "Mango fashion campaign white" },
            { name: "Farm Rio Vibe", query: "Farm Rio white dress mockup" },
            { name: "Minimalist", query: "COS stores minimalist white fashion" },
            { name: "Boho Chic", query: "Free People white dress boho" },
            { name: "Bridal Modern", query: "Modern bridal white dress simple" },
            { name: "Runway", query: "Runway fashion show white collection" },
            { name: "Photoshoot", query: "Professional model photoshoot white background" },
            { name: "Urban", query: "Urban fashion white outfit concrete" },
            { name: "Beach", query: "Beachwear white dress sunset" },
            { name: "Linen", query: "Linen white clothing texture" },
            { name: "Silk", query: "Silk white dress luxury" },
            { name: "Cotton", query: "Cotton white dress casual" },
            { name: "Pinterest", query: "Pinterest aesthetic white outfit" },
            { name: "Instagram", query: "Instagram fashion influencer white" }
        ];

        const poses = ["standing", "sitting", "walking", "back view", "detail shot", "full body"];

        const createModelLink = (sourceObj, pose, index) => {
            const finalQuery = `${sourceObj.query} ${pose} ${searchTerm}`;
            return {
                source: `${sourceObj.name} • ${pose}`, // Nome Visual
                patternName: `Base: ${searchTerm}`, 
                similarityScore: 90,
                type: "GLOBAL",
                linkType: 'SEARCH_QUERY',
                url: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(finalQuery)}`,
                // O termo de backup é o segredo: ele varia drasticamente para cada card
                backupSearchTerm: `${finalQuery} high resolution photo -drawing`,
                imageUrl: null
            };
        };

        const queries = [];
        let globalIndex = 0;

        // Gera 60 resultados únicos combinando Fontes x Poses
        while (queries.length < 60) {
            const source = marketSources[globalIndex % marketSources.length];
            const pose = poses[Math.floor(globalIndex / marketSources.length) % poses.length] || "model";
            
            queries.push(createModelLink(source, pose, globalIndex));
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
        // Agora passamos o layoutStyle para garantir aspect ratio correto (ex: Pareô)
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
