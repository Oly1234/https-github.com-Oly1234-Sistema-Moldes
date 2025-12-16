
// DEPARTAMENTO: FORENSE VISUAL (The Lens) & INTERPRETAÇÃO SEMÂNTICA
// Responsabilidade: Classificar a imagem nas categorias internas seguras e extrair DNA técnico EM INGLÊS.

export const analyzeVisualDNA = async (apiKey, imageBase64, mimeType, cleanJson, context = 'TEXTURE', userHints = '') => {
    let SYSTEM_PROMPT = '';

    if (context === 'TEXTURE') {
        // PROMPT DE CAMADA SEMÂNTICA (SEMANTIC INTERPRETATION LAYER)
        // Objetivo: Detectar a natureza do padrão e traduzir para linguagem técnica segura EM INGLÊS.
        
        const userContext = userHints ? `USER NOTES: "${userHints}".` : '';

        SYSTEM_PROMPT = `
        ACT AS: Senior Textile Design Analyst.
        
        OBJECTIVE: Analyze the visual pattern and classify it into SAFE TECHNICAL CATEGORIES in ENGLISH.
        
        SEMANTIC MAPPING RULES (CRITICAL):
        - IF you see FLOWERS -> Output: "Stylized botanical motifs" (avoid generic 'floral', use 'botanical').
        - IF you see JUNGLE/LEAVES -> Output: "Planar tropical foliage" (avoid 'nature').
        - IF you see DECORATIVE ART -> Output: "Structured ornamental elements".
        - IF you see SKETCHES -> Output: "Natural inspired vector lines".
        
        SECURITY PROTOCOL:
        - IGNORE: Human figures, bodies, skin, dresses, models. Look ONLY at the GRAPHIC ARTWORK.
        - FORBIDDEN WORDS: Body, Skin, Nude, Sexy, Realistic, Photo, Girl, Woman, Man.
        
        ${userContext}
        
        OUTPUT JSON:
        {
            "semanticCategory": "One of the mapped technical categories above (IN ENGLISH)",
            "visualDescription": "A highly technical description of the motifs in ENGLISH using vector/geometry terms (e.g., 'Stylized radial elements with planar filling').",
            "printLayout": "Corrida",
            "searchKeywords": [
                "Technical Term 1 (e.g. Botanical Illustration)",
                "Technical Term 2 (e.g. Vector Foliage)",
                "Technical Term 3 (e.g. Engineered Print)"
            ],
            "technicalSpecs": { 
                "technique": "Vector/Flat", 
                "motifs": ["Primary Motif", "Secondary Motif"], 
                "complexity": "High Definition",
                "vibe": "Industrial Sophisticated",
                "layout": "Continuous Repeat",
                "restorationInstructions": "Refine contours for clean vector lines, remove noise, harmonize proportions, apply flat colors."
            }
        }
        `;
    } else {
        // MANTIDO: Análise de Vestuário (Scanner de Moldes) - Este pode manter PT-BR pois é exibido na UI
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
            result.visualDescription = "High definition vector textile pattern with stylized geometric elements.";
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
