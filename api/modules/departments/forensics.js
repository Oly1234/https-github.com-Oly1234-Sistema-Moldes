
// DEPARTAMENTO: FORENSE VISUAL (The Lens) & INTERPRETAÇÃO SEMÂNTICA
// Responsabilidade: Classificar a imagem nas categorias internas seguras e extrair DNA técnico EM INGLÊS.

export const analyzeVisualDNA = async (apiKey, imageBase64, mimeType, cleanJson, context = 'TEXTURE', userHints = '') => {
    let SYSTEM_PROMPT = '';

    if (context === 'TEXTURE') {
        // PROMPT DE CAMADA SEMÂNTICA (ISOLAMENTO DE TEXTURA)
        // Objetivo: Ignorar a pessoa/roupa e extrair APENAS a arte gráfica.
        
        const userContext = userHints ? `USER NOTES: "${userHints}".` : '';

        SYSTEM_PROMPT = `
        ACT AS: Industrial Surface Designer (CAD Specialist).
        
        TASK: Extract the graphic DNA of this image for reproduction.
        
        CRITICAL SAFETY RULES:
        1. IGNORE any human models, body parts, skin tone, or garment silhouettes.
        2. FOCUS ONLY on the artwork/print (motifs, geometry, rhythm).
        3. OUTPUT LANGUAGE: English (Technical Terms).
        4. SANITIZATION: Do NOT use words like "skin", "nude", "body", "girl", "face". Use "neutral background", "organic shape" instead.
        
        SEMANTIC MAP:
        - Real Flowers -> "Stylized botanical vector motifs"
        - Jungle/Leaves -> "Planar tropical foliage illustration"
        - Skin/Nude Colors -> "Neutral beige/sand tone background"
        - Complex Art -> "Clean geometric composition"
        
        ${userContext}
        
        OUTPUT JSON:
        {
            "semanticCategory": "Botanical / Geometric / Abstract / Ornamental",
            "visualDescription": "A pure technical description of the graphics. Keep it structural and color-focused. (e.g., 'Seamless pattern with large red hibiscus flowers and green leaves on white background. Flat vector style.')",
            "printLayout": "All-over",
            "searchKeywords": [
                "Seamless Pattern",
                "Vector Illustration",
                "Digital Print"
            ],
            "technicalSpecs": { 
                "technique": "Vector/Flat", 
                "motifs": ["Primary Motif", "Secondary Motif"], 
                "complexity": "High Definition",
                "vibe": "Industrial Sophisticated",
                "layout": "Continuous Repeat",
                "restorationInstructions": "Reconstruct as flat 2D vector art. Remove shadows and folds."
            }
        }
        `;
    } else {
        // MANTIDO: Análise de Vestuário (Scanner de Moldes)
        SYSTEM_PROMPT = `
        ACT AS: Master Pattern Cutter (Portuguese Speaker).
        TASK: Analyze the garment structure for sewing patterns.
        
        OUTPUT JSON (Values in PT-BR, except keywords):
        {
            "visualDescription": "Nome Técnico da Peça (PT-BR)",
            "searchKeywords": [
                "English Search Term 1",
                "English Search Term 2",
                "English Search Term 3",
                "English Search Term 4"
            ],
            "technicalSpecs": { 
                "silhouette": "Silhueta (PT-BR)", 
                "neckline": "Decote (PT-BR)", 
                "details": "Detalhes (PT-BR)",
                "fabric": "Sugestão de Tecido (PT-BR)"
            }
        }
        `;
    }

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: SYSTEM_PROMPT }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generation_config: { response_mime_type: "application/json" }
    };

    try {
        const response = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) throw new Error("Sem resposta visual.");
        
        const result = JSON.parse(cleanJson(text));
        
        // Fallback de Segurança para Descrição Vazia
        if (!result.visualDescription) {
            result.visualDescription = "Geometric vector pattern with stylized motifs in high contrast.";
        }
        
        return result;

    } catch (e) {
        console.error("Forensics Dept Error:", e);
        return {
            visualDescription: "Technical vector textile pattern",
            printLayout: "Corrida",
            searchKeywords: ["Textile Pattern", "Vector Art"],
            technicalSpecs: { silhouette: "N/A", layout: "Corrida", restorationInstructions: "Standard vector cleanup" }
        };
    }
};
