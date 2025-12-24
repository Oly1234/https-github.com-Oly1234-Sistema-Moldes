
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
    
    // NOVO MOTOR DE BUSCA DE MODELOS BRANCOS (ATUALIZADO & DIVERSIFICADO)
    if (action === 'FIND_WHITE_MODELS') {
        let searchTerm = prompt;
        
        // 1. Se tiver imagem, analisa o DNA primeiro para saber O QUE buscar
        if (mainImageBase64) {
            const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType || 'image/jpeg', cleanJson, 'GARMENT');
            // Ex: "Vestido Longo Chemise"
            searchTerm = visualData.visualDescription || prompt || "Vestido Feminino"; 
        }

        // Variadores visuais para garantir unicidade nas imagens (Evita duplicatas no Bing TBN)
        const visualVariations = [
            "studio lighting full body", "outdoor natural light", "catwalk runway", "street style candid",
            "minimalist lookbook", "editorial high fashion", "close up fabric detail", "back view pose",
            "side profile standing", "sitting pose elegant", "dynamic movement blur", "architectural background",
            "blonde model", "brunette model", "curly hair", "short hair chic",
            "luxury silk texture", "cotton linen texture", "summer vibe", "winter styling",
            "mannequin ghost", "flat lay photography", "hanger shot", "detail macro",
            "urban setting", "garden setting", "beach setting", "interior luxury"
        ];

        // 2. Gerador de Links Otimizado para Mockups Brancos
        const createModelLink = (source, type, urlBase, suffix, boost, index) => {
            // Seleciona um variador baseado no índice para rotacionar estilos visualmente
            const variation = visualVariations[index % visualVariations.length];
            
            return {
                source,
                patternName: `Base: ${searchTerm}`, // Nome exibido
                similarityScore: 90 + boost,
                type,
                linkType: 'SEARCH_QUERY',
                url: `${urlBase}${encodeURIComponent(`white ${searchTerm} ${suffix}`)}`,
                // CRUCIAL: O termo de backup (usado para gerar a imagem) AGORA inclui o variador visual
                // Isso força o Bing a retornar imagens diferentes para cada card.
                backupSearchTerm: `white ${searchTerm} ${suffix} ${variation} high quality photo -drawing`,
                imageUrl: null
            };
        };

        const queries = [];
        let gIndex = 0;
        
        // Grupo A: Fontes Diversas (4 variações)
        queries.push(createModelLink("Google Images", "STUDIO", "https://www.google.com/search?tbm=isch&q=", "model studio", 5, gIndex++));
        queries.push(createModelLink("Pinterest", "VIBE", "https://www.pinterest.com/search/pins/?q=", "fashion aesthetic", 5, gIndex++));
        queries.push(createModelLink("Unsplash", "FREE", "https://unsplash.com/s/photos/", "clothing model", 4, gIndex++));
        queries.push(createModelLink("Pexels", "STOCK", "https://www.pexels.com/search/", "dress fashion", 4, gIndex++));
        
        // Variações de Estilo (10)
        const styles = ["studio", "lookbook", "catwalk", "street", "mannequin", "flatlay", "back view", "detail", "editorial", "minimal"];
        styles.forEach((style) => {
            queries.push(createModelLink(`Ref. ${style.toUpperCase()}`, "STYLE", "https://www.google.com/search?tbm=isch&q=", `${style} white`, 3, gIndex++));
        });
        
        // Variações de Modificadores (5)
        const modifiers = ["isolated", "luxury", "casual", "boho", "formal"];
        modifiers.forEach((mod) => {
             queries.push(createModelLink(`Ref. ${mod.toUpperCase()}`, "TECH", "https://www.pinterest.com/search/pins/?q=", `${mod}`, 3, gIndex++));
        });

        // Preenchimento Massivo até 50 (Variando o sufixo numérico e o variador visual)
        while(queries.length < 50) {
             queries.push(createModelLink("Global Find", "MIX", "https://www.google.com/search?tbm=isch&q=", `white ${searchTerm} reference ${queries.length}`, 2, gIndex++));
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
