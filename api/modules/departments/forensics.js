
// DEPARTAMENTO: FORENSE VISUAL (The Lens)
// Responsabilidade: Desmembrar a imagem em dados técnicos puros e keywords de cauda longa.

export const analyzeVisualDNA = async (apiKey, imageBase64, mimeType, cleanJson, context = 'TEXTURE', userHints = '') => {
    let SYSTEM_PROMPT = '';

    if (context === 'TEXTURE') {
        // PROMPT DE ALTA SENIORIDADE - SURFACE DESIGN MANAGER
        // Foco: Extrair a arte ignorando o suporte (corpo/roupa)
        const userContext = userHints ? `DIRECTOR NOTES: "${userHints}".` : '';

        SYSTEM_PROMPT = `
        ACT AS: Executive Textile Design Manager (20+ Years Experience).
        TASK: Perform a technical breakdown of the SURFACE PATTERN found in this image.
        
        CRITICAL VISUAL ISOLATION PROTOCOL:
        1. IGNORE THE MODEL: Do not describe the person, body, skin, face, hair, or pose.
        2. IGNORE THE GARMENT: Do not describe the dress, shirt, or folds. Look ONLY at the 2D ARTWORK.
        3. TRANSLATE TO VECTOR: Describe the motif as if it were a flat Adobe Illustrator file.
        
        SAFETY VOCABULARY ENFORCEMENT:
        - FORBIDDEN: "Woman", "Girl", "Lady", "Body", "Skin", "Nude", "Legs", "Chest", "Wearing".
        - REPLACEMENTS: "Figurative element", "Organic shape", "Background color", "Motif".
        
        ${userContext}
        
        OUTPUT JSON:
        {
            "visualDescription": "A highly technical, flat description of the print artwork only. Focus on motif style (e.g., 'Gouache Floral', 'Geo-Vector'), composition (e.g., 'Tossed', 'Ogee'), and color palette. NO HUMAN TERMS.",
            "printLayout": "Corrida",
            "searchKeywords": [
                "Main Motif (Art term)",
                "Technique Name (e.g. Screen Print, Ikat)",
                "Art Movement (e.g. Bauhaus, Tropical)"
            ],
            "technicalSpecs": { 
                "technique": "Vector/Watercolor/Digital", 
                "motifs": ["Primary Motif", "Secondary Motif"], 
                "complexity": "Commercial/High",
                "vibe": "Professional",
                "layout": "Seamless Repeat",
                "restorationInstructions": "Reconstruct as flat 2D vector file, clean lines, solid colors, remove fabric texture."
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
