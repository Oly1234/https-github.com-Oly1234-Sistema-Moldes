
// DEPARTAMENTO: FORENSE VISUAL (The Lens)
// Responsabilidade: Desmembrar a imagem em dados técnicos puros e keywords de cauda longa.

export const analyzeVisualDNA = async (apiKey, imageBase64, mimeType, cleanJson, context = 'TEXTURE', userHints = '') => {
    let SYSTEM_PROMPT = '';

    if (context === 'TEXTURE') {
        // ABA DE CRIADOR / ATELIER: Foco na Arte/Superfície & Criação
        const userContext = userHints ? `IMPORTANT - USER OVERRIDE/INSTRUCTION: "${userHints}". CONSIDER THIS IN THE STYLE GUIDE.` : '';

        SYSTEM_PROMPT = `
        ACT AS: Senior Surface Designer & Prompt Engineer.
        TASK: Analyze the artwork to enable a High-Definition Recreation by an AI Image Generator.
        ${userContext}
        
        ANALYSIS REQUIRED:
        1. VISUAL DESCRIPTION (ENGLISH): A highly optimized, comma-separated list of visual descriptors. Format: "Subject, Adjectives, Colors, Artistic Technique, Vibe".
           - Example: "Watercolor floral motif, pastel pink and sage green, wet-on-wet technique, soft dreamy vibe, seamless pattern".
           - AVOID: Complex sentences. Use Keywords.
        2. LAYOUT TYPE: "Corrida" (Seamless), "Barrada" (Border), or "Localizada" (Placement).
        
        OUTPUT JSON:
        {
            "visualDescription": "Subject description, Color palette, Technique details, Composition style",
            "printLayout": "Corrida",
            "searchKeywords": [
                "Main Subject (EN)",
                "Technique (EN)",
                "Vibe (EN)"
            ],
            "technicalSpecs": { 
                "technique": "Technique Name", 
                "motifs": ["Motif 1", "Motif 2"], 
                "complexity": "Medium",
                "vibe": "Mood",
                "layout": "Corrida",
                "restorationInstructions": "Vectorize, sharpen edges, remove noise"
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
            result.visualDescription = "High quality seamless textile pattern with artistic motifs";
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
