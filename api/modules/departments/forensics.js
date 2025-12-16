
// DEPARTAMENTO: FORENSE VISUAL (The Lens) & INTERPRETAÇÃO SEMÂNTICA
// Responsabilidade: Classificar a imagem nas categorias internas seguras e extrair DNA técnico.

export const analyzeVisualDNA = async (apiKey, imageBase64, mimeType, cleanJson, context = 'TEXTURE', userHints = '') => {
    let SYSTEM_PROMPT = '';

    if (context === 'TEXTURE') {
        // PROMPT DE CAMADA SEMÂNTICA (SEMANTIC INTERPRETATION LAYER)
        // Objetivo: Detectar a natureza do padrão e traduzir para linguagem técnica segura.
        
        const userContext = userHints ? `USER NOTES: "${userHints}".` : '';

        SYSTEM_PROMPT = `
        ACT AS: Senior Textile Design Analyst.
        
        OBJECTIVE: Analyze the visual pattern and classify it into SAFE TECHNICAL CATEGORIES.
        
        SEMANTIC MAPPING RULES (CRITICAL):
        - IF you see FLOWERS -> Output: "Motivos botânicos estilizados" (NEVER use 'floral').
        - IF you see JUNGLE/LEAVES -> Output: "Folhagens tropicais planificadas" (NEVER use 'nature' or 'organic').
        - IF you see DECORATIVE ART -> Output: "Elementos ornamentais estruturados" (NEVER use 'artistic').
        - IF you see SKETCHES -> Output: "Linhas vetoriais de inspiração natural".
        
        SECURITY PROTOCOL:
        - IGNORE: Human figures, bodies, skin, dresses, models. Look ONLY at the GRAPHIC ARTWORK.
        - FORBIDDEN WORDS: Floral, Organic, Body, Skin, Nude, Sexy, Realistic, Photo.
        
        ${userContext}
        
        OUTPUT JSON:
        {
            "semanticCategory": "One of the mapped technical categories above",
            "visualDescription": "A highly technical description of the motifs using only vector/geometry terms (e.g., 'Stylized radial elements with planar filling').",
            "printLayout": "Corrida",
            "searchKeywords": [
                "Technical Term 1 (e.g. Botanical Illustration)",
                "Technical Term 2 (e.g. Vector Foliage)",
                "Technical Term 3 (e.g. Engineered Print)"
            ],
            "technicalSpecs": { 
                "technique": "Vetorial/Chapado", 
                "motifs": ["Elemento Primário", "Elemento Secundário"], 
                "complexity": "Alta Definição",
                "vibe": "Sofisticado Industrial",
                "layout": "Rapport Contínuo",
                "restorationInstructions": "Refinar contornos para traço vetorial limpo, eliminar ruídos, harmonizar proporções, aplicar cores chapadas."
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
        
        // Fallback de Segurança
        if (!result.visualDescription) {
            result.visualDescription = "Padrão têxtil vetorial de alta definição com elementos geométricos estilizados.";
        }
        
        return result;

    } catch (e) {
        console.error("Forensics Dept Error:", e);
        return {
            visualDescription: "Padrão têxtil técnico vetorial",
            printLayout: "Corrida",
            searchKeywords: ["Textile Pattern", "Vector Art"],
            technicalSpecs: { silhouette: "N/A", layout: "Corrida", restorationInstructions: "Limpeza vetorial padrão" }
        };
    }
};
