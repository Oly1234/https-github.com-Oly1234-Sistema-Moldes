
// DEPARTAMENTO: FORENSE VISUAL (The Lens)
// Responsabilidade: Desmembrar a imagem em dados técnicos puros e keywords de cauda longa.

export const analyzeVisualDNA = async (apiKey, imageBase64, mimeType, cleanJson, context = 'TEXTURE', userHints = '') => {
    let SYSTEM_PROMPT = '';

    if (context === 'TEXTURE') {
        // ABA DE CRIADOR / ATELIER: Foco na Arte/Superfície & Criação
        // SEGURANÇA: Instruímos a IA a usar termos de ARTE, não termos realistas que confundem o filtro.
        const userContext = userHints ? `IMPORTANT USER HINT: "${userHints}".` : '';

        SYSTEM_PROMPT = `
        ACT AS: Senior Surface Designer (Textile Industry).
        TASK: Analyze the artwork to generate a TECHNICAL PROMPT for a Vector Generation AI.
        
        SAFETY PROTOCOL:
        - Describe shapes geometrically (e.g. "organic curves" instead of "body shapes").
        - Use art terms (watercolor, gouache, vector, screen print).
        - AVOID: Words related to biology, skin, violence, or photorealism.
        
        ${userContext}
        
        OUTPUT JSON:
        {
            "visualDescription": "A technical, comma-separated list of visual elements. Subject + Style + Technique + Colors.",
            "printLayout": "Corrida",
            "searchKeywords": [
                "Main Motif (Art term)",
                "Technique Name",
                "Color Palette Style"
            ],
            "technicalSpecs": { 
                "technique": "Vector/Watercolor", 
                "motifs": ["Floral", "Geometric"], 
                "complexity": "High",
                "vibe": "Modern",
                "layout": "Corrida",
                "restorationInstructions": "Vectorize, sharpen edges, flat color fill"
            }
        }
        `;
    } else {
        // ABA DE ESCANEAMENTO: Foco na Engenharia da Roupa (Mantém PT-BR para interface)
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
        
        // Fallback robusto se a descrição vier vazia
        if (!result.visualDescription || result.visualDescription.length < 5) {
            result.visualDescription = "Abstract geometric textile pattern, vector style, flat colors";
        }
        
        return result;

    } catch (e) {
        console.error("Forensics Dept Error:", e);
        return {
            visualDescription: "Artistic seamless textile pattern, high resolution, vector style",
            printLayout: "Corrida",
            searchKeywords: ["Pattern", "Texture"],
            technicalSpecs: { silhouette: "Desconhecido", layout: "Corrida", restorationInstructions: "High quality vector style" }
        };
    }
};
