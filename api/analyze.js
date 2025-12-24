
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
    
    // NOVO MOTOR DE BUSCA DE MODELOS BRANCOS (GLOBAL DIVERSITY ENGINE v2)
    if (action === 'FIND_WHITE_MODELS') {
        let searchTerm = prompt;
        
        // 1. Se tiver imagem, analisa o DNA primeiro para saber O QUE buscar
        if (mainImageBase64) {
            const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType || 'image/jpeg', cleanJson, 'GARMENT');
            // Ex: "Vestido Longo Chemise"
            searchTerm = visualData.visualDescription || prompt || "Vestido Feminino"; 
        }

        // Variadores de CONTEXTO (Onde a foto foi tirada)
        const contexts = [
            "studio white background", "street style paris", "runway fashion week", "beach sunlight", 
            "urban concrete wall", "luxury hotel interior", "minimalist loft", "garden outdoor",
            "red carpet event", "casual coffee shop", "backstage fashion", "editorial magazine shoot"
        ];

        // Variadores de FONTE/ESTILO (Marcas, Revistas e Estilos) - Força diversidade de "mão" fotográfica
        const sources = [
            "Vogue editorial", "Zara catalog", "Revolve clothing", "Net-a-Porter style", 
            "Pinterest aesthetic", "Instagram influencer", "H&M studio", "Shein lookbook", 
            "Mango fashion", "ASOS design", "Elle magazine", "Harper's Bazaar",
            "Reformation style", "Farm Rio vibe", "Massimo Dutti", "Anthropologie",
            "Shutterstock photo", "Getty Images editorial", "Unsplash portrait", "Pexels fashion"
        ];

        // Variadores de DETALHE VISUAL (Para evitar a mesma pose)
        const details = [
            "full body shot", "close up detail", "walking motion", "sitting pose", 
            "back view", "side profile", "laughing candid", "serious model pose",
            "holding bag", "sunglasses", "architectural lighting", "shadow play"
        ];

        // 2. Gerador de Links Otimizado
        const createModelLink = (sourceLabel, type, urlBase, visualQuery, index) => {
            return {
                source: sourceLabel,
                patternName: `Base: ${searchTerm}`, 
                similarityScore: 90,
                type,
                linkType: 'SEARCH_QUERY',
                url: `${urlBase}${encodeURIComponent(visualQuery)}`,
                // O termo de backup é o que realmente busca a imagem no Bing Proxy
                backupSearchTerm: visualQuery + " high resolution -drawing -sketch",
                imageUrl: null
            };
        };

        const queries = [];
        let globalIndex = 0;

        // ESTRATÉGIA DE PERMUTAÇÃO ALEATÓRIA
        // Gera 50+ combinações únicas
        while (queries.length < 55) {
            // Seleciona aleatoriamente um de cada categoria
            const ctx = contexts[globalIndex % contexts.length];
            const src = sources[globalIndex % sources.length];
            const dtl = details[globalIndex % details.length];
            
            // Constrói uma query visual rica
            // Ex: "White Dress Vogue editorial studio white background full body shot"
            const uniqueQuery = `white ${searchTerm} ${src} ${ctx} ${dtl}`;
            
            // Define o rótulo da fonte (ex: "Vogue / Studio")
            const sourceLabel = `${src.split(' ')[0]} • ${ctx.split(' ')[0]}`;
            
            queries.push(createModelLink(
                sourceLabel,
                "GLOBAL",
                "https://www.google.com/search?tbm=isch&q=",
                uniqueQuery,
                globalIndex
            ));
            
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
