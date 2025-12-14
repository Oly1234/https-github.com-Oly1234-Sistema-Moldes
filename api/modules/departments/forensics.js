
// DEPARTAMENTO: FORENSE VISUAL (The Lens)
// Responsabilidade: Desmembrar a imagem em dados técnicos puros e keywords de cauda longa.

export const analyzeVisualDNA = async (apiKey, imageBase64, mimeType, cleanJson, context = 'TEXTURE') => {
    let SYSTEM_PROMPT = '';

    if (context === 'TEXTURE') {
        // ABA DE CRIADOR: Foco na Arte/Superfície & Restauração
        SYSTEM_PROMPT = `
        ACT AS: Senior Textile Restorer & Surface Designer.
        TASK: Analyze the artwork to enable a High-Definition Recreation.
        
        ANALYSIS REQUIRED:
        1. LAYOUT TYPE: Is it "Seamless/All-Over" (Corrida), "Border/Engineered" (Barrada), "Geometric", or "Placement"?
        2. ART STYLE: Detailed technique (e.g. "Watercolor on wet paper", "Vector flat outline", "Halftone screen").
        3. FLAWS TO FIX: Identify low quality aspects to improve (e.g. "Blurry edges", "Pixel noise", "Loose dots", "Bad tracing").
        
        OUTPUT JSON:
        {
            "visualDescription": "Highly detailed visual description of the motif and flow",
            "printLayout": "Seamless All-Over" (or "Border Print", "Geometric Grid", etc.),
            "searchKeywords": [
                "Primary art term",
                "Technique term",
                "Market term",
                "Vibe term"
            ],
            "technicalSpecs": { 
                "technique": "Digital/Traditional", 
                "motifs": ["Primary Motif"], 
                "complexity": "High/Low",
                "vibe": "Mood",
                "layout": "String (e.g. 'Barrada/Border' or 'Corrida/Seamless')",
                "restorationInstructions": "String (e.g. 'Clean up loose pixels, sharpen lines, vectorize')"
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
            printLayout: "Standard",
            searchKeywords: ["Pattern", "Texture"],
            technicalSpecs: { silhouette: "Unknown", layout: "Standard", restorationInstructions: "Enhance quality" }
        };
    }
};
