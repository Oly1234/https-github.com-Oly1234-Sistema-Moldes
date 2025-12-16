
import { analyzeColorTrend } from './modules/departments/color.js';
import { refineDesignPrompt } from './modules/departments/atelier.js'; 
import { analyzeVisualDNA } from './modules/departments/forensics.js';
import { generateMarketLinks } from './modules/departments/market.js';
import { getLinkPreview } from './modules/scraper.js';
import { generatePattern } from './modules/generator.js'; 
import { reconstructElement } from './modules/departments/layerLab.js'; 

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
    const { action, prompt, colors, mainImageBase64, mainMimeType, targetUrl, backupSearchTerm, linkType, userReferenceImage, cropBase64, commandText, selvedge, variation, technique, colorCount, layoutStyle } = req.body;
    
    let rawKey = process.env.MOLDESOK || process.env.MOLDESKEY || process.env.API_KEY || process.env.VITE_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : null;
    if (!apiKey) return res.status(500).json({ error: "Chave de API não configurada no servidor." });

    // --- ROTEAMENTO ---

    if (action === 'VOICE_COMMAND') {
        const ROUTER_PROMPT = `
        ACT AS: Vingi OS Navigation System.
        
        VALID VIEWS (STRICT LIST):
        - "HOME" (Dashboard, Início)
        - "SCANNER" (Caçador de Moldes, Scanner, Engenharia Reversa, Foto da roupa)
        - "CREATOR" (Radar Global, Buscador de Estampas, Textura)
        - "ATELIER" (Estúdio de Criação, Gerar Estampa, Criar, Pattern Generator)
        - "LAYER_STUDIO" (Lab de Imagem, Layer, Editar, Remover Fundo, Photoshop)
        - "MOCKUP" (Aplicação Técnica, Encaixe, Molde 2D)
        - "RUNWAY" (Provador Mágico, Modelo 3D, Desfile, Simulação)
        - "HISTORY" (Histórico, Meus Projetos)

        USER COMMAND: "${commandText}"

        TASK: Map the user command to the closest VALID VIEW.
        OUTPUT JSON: { "targetView": "ONE_OF_THE_VALID_VIEWS", "message": "Short confirmation in PT-BR (e.g. 'Abrindo Scanner...')" }
        `;
        
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: ROUTER_PROMPT }] }] }) });
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const result = JSON.parse(cleanJson(text));
        return res.status(200).json({ success: true, ...result });
    }

    if (action === 'GET_LINK_PREVIEW') {
        const contextType = (backupSearchTerm && backupSearchTerm.includes('pattern')) ? 'SURFACE' : 'CLOTHING';
        const image = await getLinkPreview(targetUrl, backupSearchTerm, userReferenceImage, apiKey, contextType, linkType);
        return res.status(200).json({ success: true, image });
    }

    if (action === 'RECONSTRUCT_ELEMENT') {
        const result = await reconstructElement(apiKey, cropBase64);
        return res.status(200).json({ success: true, ...result });
    }
    
    // --- MÓDULO: REALISM STUDIO (CONTRAST HUNTER ENGINE) ---
    if (action === 'FIND_WHITE_MODELS') {
        let finalPrompt = prompt;
        
        // 1. Visão Computacional para Estrutura (Se imagem for enviada)
        if (mainImageBase64) {
            const DESCRIBE_PROMPT = `Describe ONLY the garment type, cut, length and specific details (e.g. puff sleeves, maxi, slip dress). Ignore colors/patterns.`;
            const descEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const descPayload = {
                contents: [{ parts: [{ text: DESCRIBE_PROMPT }, { inline_data: { mime_type: mainMimeType || 'image/jpeg', data: mainImageBase64 } }] }]
            };
            const descRes = await fetch(descEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(descPayload) });
            const descData = await descRes.json();
            const descText = descData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (descText) finalPrompt = descText;
        }

        // 2. Geração de Queries "Contrast Hunter 3.0 - Edge Detection Optimized"
        // Lógica aprimorada: Solicita iluminação de borda (Rim Light) e fundos sólidos escuros.
        const MOCKUP_PROMPT = `
        CONTEXT: We need images of models wearing PLAIN WHITE versions of a specific garment. 
        GOAL: These images will be used for AI pattern mapping, so the BOUNDARIES of the white garment must be RAZOR SHARP against the background.
        
        GARMENT: "${finalPrompt}"
        
        TASK: Generate 8 HIGHLY TECHNICAL search queries to find the perfect base image.
        
        CRITICAL RULES FOR "EASY MASKING":
        1. **CONTRAST:** White Garment vs. DARK/SOLID Background (Grey, Black, Blue). NO WHITE BACKGROUNDS.
        2. **LIGHTING:** Studio lighting, hard light, "Rim Lighting" (to separate edges), no soft blur.
        3. **MODEL:** Distinct skin tone contrast against the white cloth.
        4. **VIEW:** Full view or clear torso view, minimal hand obstruction over the fabric.
        
        OUTPUT JSON: { "queries": ["string"] }
        
        Example Queries:
        - "white silk slip dress on model dark studio background hard rim lighting"
        - "plain white t-shirt fashion photography black background sharp focus"
        - "white linen maxi dress editorial shot dark grey backdrop contrast"
        - "white couture gown studio lighting solid dark background ghost mannequin style"
        `;
        
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: MOCKUP_PROMPT }] }] }) });
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const result = JSON.parse(cleanJson(text));
        
        const queries = result.queries || [];
        
        return res.status(200).json({ success: true, queries: queries, detectedStructure: finalPrompt });
    }

    // --- ATELIER DE ESTAMPARIA ---
    
    if (action === 'ANALYZE_REFERENCE_FOR_PROMPT') {
        const extractedPrompt = await refineDesignPrompt(apiKey, mainImageBase64);
        return res.status(200).json({ success: true, prompt: extractedPrompt });
    }

    if (action === 'ANALYZE_COLOR_TREND') {
        const colorData = await analyzeColorTrend(apiKey, mainImageBase64, 'image/jpeg', cleanJson, variation || 'NATURAL');
        return res.status(200).json({ success: true, colors: colorData.colors });
    }

    if (action === 'GENERATE_PATTERN') {
        try {
            const image = await generatePattern(apiKey, prompt, colors, selvedge, technique, colorCount, layoutStyle);
            return res.status(200).json({ success: true, image });
        } catch (genError) {
            console.error("Generation Failed:", genError);
            return res.status(200).json({ success: false, error: genError.message || "Erro na geração." });
        }
    }

    // --- FIM ATELIER ---

    if (action === 'DESCRIBE_PATTERN') {
        const colorData = await analyzeColorTrend(apiKey, mainImageBase64, mainMimeType, cleanJson, 'NATURAL');
        const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType, cleanJson, 'TEXTURE');
        const matches = generateMarketLinks(visualData, 'TEXTURE');
        return res.status(200).json({ success: true, colors: colorData.colors, prompt: visualData.visualDescription, technicalSpecs: visualData.technicalSpecs, stockMatches: matches });
    }

    if (action === 'SCAN_CLOTHING' || !action) { 
        const visualData = await analyzeVisualDNA(apiKey, mainImageBase64, mainMimeType, cleanJson, 'GARMENT');
        const matches = generateMarketLinks(visualData, 'GARMENT');
        const matchesGrouped = { exact: matches.filter(m => m.similarityScore >= 93), close: matches.filter(m => m.similarityScore >= 92 && m.similarityScore < 93), adventurous: matches.filter(m => m.similarityScore < 92) };
        return res.status(200).json({ patternName: visualData.visualDescription, technicalDna: visualData.technicalSpecs, matches: matchesGrouped, curatedCollections: [], recommendedResources: [] });
    }
    
    return res.status(200).json({ success: false, error: "Ação desconhecida" });

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(503).json({ error: error.message || "Erro interno no servidor." });
  }
}
