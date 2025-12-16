
// DEPARTAMENTO: FORENSE VISUAL (The Lens) & INTERPRETAÇÃO SEMÂNTICA
// Responsabilidade: Classificar a imagem nas categorias internas seguras e extrair DNA técnico EM INGLÊS.

export const analyzeVisualDNA = async (apiKey, imageBase64, mimeType, cleanJson, context = 'TEXTURE', userHints = '') => {
    let SYSTEM_PROMPT = '';

    if (context === 'TEXTURE') {
        // PROMPT DE CAMADA SEMÂNTICA (ISOLAMENTO DE TEXTURA)
        // Objetivo: Ignorar a pessoa/roupa e extrair APENAS a arte gráfica para recriação.
        
        const userContext = userHints ? `USER NOTES: "${userHints}".` : '';

        SYSTEM_PROMPT = `
        ACT AS: Senior Textile CAD Designer.
        
        TASK: Perform a "Mental Crop" on the image. Ignore the model, the body, the sewing, and the lighting. Focus ONLY on the 2D ARTWORK (The Print).
        
        OBJECTIVE: Describe the graphic motif for a vector reconstruction software.
        
        CRITICAL SAFETY RULES (TO AVOID GENERATION BLOCKS):
        1. NEVER describe the person, skin, face, or body parts.
        2. NEVER use words like "dress", "shirt", "worn by", "garment", "fabric fold".
        3. DESCRIBE ONLY THE GRAPHICS: Shapes, Colors, Layout, Background.
        
        SEMANTIC TRANSLATION (Map Reality to Vector Terms):
        - Real Flowers -> "Stylized botanical vector motifs"
        - Jungle/Leaves -> "Planar tropical foliage illustration"
        - Skin/Nude Colors -> "Neutral sand/beige tone background"
        - Watercolor -> "Painterly effect with defined edges"
        
        ${userContext}
        
        OUTPUT JSON (STRICTLY ENGLISH):
        {
            "semanticCategory": "Botanical / Geometric / Abstract / Ornamental",
            "visualDescription": "A pure technical description of the graphics (e.g., 'A seamless pattern featuring large red hibiscus flowers and green palm leaves on a white background. Flat vector style.').",
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
        // MANTIDO: Análise de Vestuário (Scanner de Moldes) - Contexto de Roupa é permitido aqui
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
        
        // Fallback de Segurança
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
