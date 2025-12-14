
// DEPARTAMENTO: FORENSE VISUAL (The Lens)
// Responsabilidade: Desmembrar a imagem em dados técnicos puros e keywords de cauda longa.

export const analyzeVisualDNA = async (apiKey, imageBase64, mimeType, cleanJson, context = 'TEXTURE') => {
    let SYSTEM_PROMPT = '';

    if (context === 'TEXTURE') {
        // ABA DE CRIADOR: Foco na Arte/Superfície
        // Lógica atualizada para gerar KEYWORDS ricas (História da Arte + Técnica)
        SYSTEM_PROMPT = `
        ACT AS: Art Historian & Surface Designer.
        TASK: Analyze the ARTWORK style to find EXACT MATCHES in stock libraries.
        
        ANALYSIS:
        1. Identify the Art Movement (e.g., Art Deco, Memphis, Toile de Jouy, Chinoiserie).
        2. Identify the Technique (e.g., Watercolor, Vector Flat, Halftone, Ikat).
        3. Identify the Motif (e.g., Monstera Leaf, Paisley, Houndstooth).
        
        OUTPUT JSON:
        {
            "visualDescription": "Specific Art Term" (e.g. "William Morris Strawberry Thief style print"),
            "searchKeywords": [
                "Primary art history term (e.g. 'Arts and Crafts movement floral pattern')",
                "Secondary technique term (e.g. 'Detailed botanical illustration seamless')",
                "Commercial stock term (e.g. 'Vintage floral wallpaper swatch')",
                "Vibe term (e.g. 'Dark academia aesthetic print')"
            ],
            "technicalSpecs": { 
                "technique": "Digital/Traditional", 
                "motifs": ["Primary Motif"], 
                "complexity": "High/Low",
                "vibe": "Mood"
            }
        }
        `;
    } else {
        // ABA DE ESCANEAMENTO: Foco na Engenharia da Roupa (Desmembramento)
        SYSTEM_PROMPT = `
        ACT AS: Master Pattern Cutter & Fashion Historian.
        TASK: "Dismember" the garment into components to find SEWING PATTERNS.
        
        ANALYSIS REQUIRED:
        1. STRUCTURE: Seams, Darts, Silhouette.
        2. SPECIFICITY: Don't just say "Dress". Say "Bias Cut Slip Dress with Cowl Neck".
        3. KEYWORDS: Generate 4 distinct search angles (Technical, Vintage, Indie, Vibe).
        
        OUTPUT JSON:
        {
            "visualDescription": "Technical Name" (e.g. "Bias Cut Slip Dress"),
            "searchKeywords": [
                "Technical Pattern Name (e.g. 'Cowl neck slip dress sewing pattern')",
                "Vintage/Specific Term (e.g. '90s minimalist evening dress pattern')",
                "Construction Term (e.g. 'Bias cut dress pdf pattern')",
                "Vibe/Style Term (e.g. 'Silk satin nightgown pattern')"
            ],
            "technicalSpecs": { 
                "silhouette": "Type", 
                "neckline": "Type", 
                "details": "Details",
                "fabric": "Suggestion"
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
        return JSON.parse(cleanJson(text));
    } catch (e) {
        console.error("Forensics Dept Error:", e);
        return {
            visualDescription: "Fashion Item",
            searchKeywords: ["Sewing pattern", "Style pattern", "Fashion design", "Garment"],
            technicalSpecs: { silhouette: "Unknown", neckline: "Unknown", details: "None", fabric: "Any" }
        };
    }
};
