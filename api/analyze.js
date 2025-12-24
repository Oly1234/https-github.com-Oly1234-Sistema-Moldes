
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
    
    // --- NOVO MOTOR DE BUSCA "WHITE HUNTER" (Google Simulation) ---
    if (action === 'FIND_WHITE_MODELS') {
        let structure = prompt;
        
        // 1. Extração Estrutural da Imagem (Visual DNA)
        if (mainImageBase64) {
            const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType || 'image/jpeg', cleanJson, 'GARMENT');
            // Removemos menções a cores e estampas, focando na peça (ex: "Vestido Midi Alça Fina")
            structure = (visualData.visualDescription || "Vestido").replace(/red|blue|green|black|pattern|print|floral|striped/gi, "").trim(); 
        }
        
        if (!structure) structure = "Vestido Feminino";

        // 2. Modificadores de Alta Qualidade (Style & Context)
        const styles = [
            "Minimalist", "Elegant", "Boho Chic", "Summer Resort", 
            "Avant-Garde Structure", "Clean Cut", "Sophisticated", 
            "Flowy Silhouette", "Architectural", "Romantic", "Modern Classic"
        ];

        const contexts = [
            "full body lookbook", "fashion editorial white background", 
            "studio shot full body", "street style fashion week", 
            "catalog photography", "runway model", "high quality photoshoot"
        ];

        const fabrics = [
            "Linen", "Silk Satin", "Cotton Poplin", "Crepe", 
            "Chiffon", "White Denim", "Knitted", "Viscose"
        ];

        // 3. Filtros Negativos Rigorosos (Google Operators)
        // Isso força o buscador a remover rostos em close, estampas e poluição visual
        const exclusionTerms = "-face close up -portrait -selfie -print -pattern -floral -stripes -polka -graphic -logo -multicolor -black -red -blue -green";

        const createModelLink = (style, context, fabric, index) => {
            // Query: Estrutura + Tecido + Cor + Estilo + Contexto + Negativos
            // Ex: "Vestido Midi Linen White Minimalist full body lookbook -print..."
            const finalQuery = `${structure} ${fabric} white ${style} ${context} solid color ${exclusionTerms}`.trim();
            const displayTitle = `${structure} ${style} (${fabric})`;
            
            return {
                source: "Google Images", // Fonte unificada
                patternName: `${displayTitle}`, 
                similarityScore: 90 + Math.random() * 10,
                type: "GLOBAL",
                linkType: 'SEARCH_QUERY',
                // URL para o usuário abrir no Google Imagens direto
                url: `https://www.google.com/search?tbm=isch&tbs=isz:l,ic:white&q=${encodeURIComponent(finalQuery)}`,
                // Backup Term para o nosso Proxy Visual (Bing TBN)
                // Removemos os operadores negativos complexos para o TBN ser mais assertivo no match visual direto
                backupSearchTerm: `${structure} ${fabric} white ${style} ${context} photography`,
                imageUrl: null
            };
        };

        const queries = [];
        let globalIndex = 0;

        // 4. Geração Combinatória (Permutação Inteligente)
        // Gera ~60 combinações únicas para maximizar a variedade visual
        for (const style of styles) {
            for (const context of contexts) {
                // Seleciona um tecido rotativo para não ficar repetitivo
                const fabric = fabrics[globalIndex % fabrics.length];
                queries.push(createModelLink(style, context, fabric, globalIndex));
                globalIndex++;
            }
        }

        // Embaralha para o usuário ver variedade logo de cara
        queries.sort(() => Math.random() - 0.5);

        return res.status(200).json({ success: true, queries: queries, detectedStructure: structure });
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
