
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
    
    // NOVO MOTOR DE BUSCA DE MODELOS BRANCOS (ATUALIZADO)
    if (action === 'FIND_WHITE_MODELS') {
        let searchTerm = prompt;
        
        // 1. Se tiver imagem, analisa o DNA primeiro para saber O QUE buscar
        if (mainImageBase64) {
            const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType || 'image/jpeg', cleanJson, 'GARMENT');
            // Ex: "Vestido Longo Chemise"
            searchTerm = visualData.visualDescription || prompt || "Vestido Feminino"; 
        }

        // 2. Gerador de Links Otimizado para Mockups Brancos
        const createModelLink = (source, type, urlBase, suffix, boost) => ({
            source,
            patternName: `Base: ${searchTerm}`, // Nome exibido
            similarityScore: 90 + boost,
            type,
            linkType: 'SEARCH_QUERY',
            url: `${urlBase}${encodeURIComponent(`white ${searchTerm} ${suffix}`)}`,
            backupSearchTerm: `white ${searchTerm} ${suffix} model photography high resolution`,
            imageUrl: null
        });

        const queries = [];
        
        // Geração de 50+ Variações (Estratégia de Permutação)
        // Grupo A: Studio & Clean (Alta qualidade para mockup)
        queries.push(createModelLink("Google Images", "STUDIO", "https://www.google.com/search?tbm=isch&q=", "model studio background", 5));
        queries.push(createModelLink("Pinterest", "VIBE", "https://www.pinterest.com/search/pins/?q=", "fashion photography white dress", 5));
        queries.push(createModelLink("Unsplash", "FREE", "https://unsplash.com/s/photos/", "white clothing model", 4));
        queries.push(createModelLink("Pexels", "STOCK", "https://www.pexels.com/search/", "white dress fashion", 4));
        
        // Variações de Termos para encher o Grid (10 em 10)
        const styles = ["studio shot", "lookbook", "catwalk", "street style", "mannequin", "flat lay", "back view", "detail shot", "editorial", "minimalist"];
        const modifiers = ["isolated", "high fashion", "white fabric", "mockup ready", "clean lighting"];
        
        styles.forEach((style, i) => {
            queries.push(createModelLink("Ref. Visual " + (i+1), "STYLE", "https://www.google.com/search?tbm=isch&q=", `${style} white`, 3));
        });
        
        modifiers.forEach((mod, i) => {
             queries.push(createModelLink("Mockup Base " + (i+1), "TECH", "https://www.pinterest.com/search/pins/?q=", `${mod}`, 3));
        });

        // Preencher até 50 se necessário com variações compostas
        while(queries.length < 50) {
             queries.push(createModelLink("Global Search", "MIX", "https://www.google.com/search?tbm=isch&q=", `white ${searchTerm} fashion reference ${queries.length}`, 2));
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
