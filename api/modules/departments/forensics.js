
// DEPARTAMENTO: FORENSE VISUAL (The Lens)
// Responsabilidade: Desmembrar a imagem em dados técnicos puros.

export const analyzeVisualDNA = async (apiKey, imageBase64, mimeType, cleanJson, context = 'TEXTURE') => {
    let SYSTEM_PROMPT = '';

    if (context === 'TEXTURE') {
        // AB DE CRIADOR: Foco na Arte/Superfície
        SYSTEM_PROMPT = `
        ACT AS: Surface Design Specialist.
        TASK: Analyze the ARTWORK style and repetition.
        
        OUTPUT JSON:
        1. "visualDescription": Precise keywords for the print (e.g. "Seamless watercolor tropical hibiscus pattern").
        2. "technicalSpecs": { 
            "technique": "Watercolor/Digital/Vector", 
            "motifs": ["Flower", "Leaf", "Abstract"], 
            "complexity": "Simple/Complex" 
        }
        `;
    } else {
        // ABA DE ESCANEAMENTO: Foco na Engenharia da Roupa (Desmembramento)
        SYSTEM_PROMPT = `
        ACT AS: Master Pattern Cutter & Fashion Historian.
        TASK: "Dismember" the garment in the image into its construction components.
        
        ANALYSIS REQUIRED:
        1. STRUCTURE: Where are the seams? (Princess seams, Darts, Drop shoulder?)
        2. COMPONENTS: Sleeve type (Raglan, Set-in, Bishop), Collar type.
        3. FABRIC: Stiff (Denim/Wool) or Drapey (Silk/Rayon)?
        
        OUTPUT JSON:
        {
            "visualDescription": "Technical Name of the Garment" (e.g. "Bias Cut Cowl Neck Slip Dress"),
            "searchKeywords": [
                "Primary technical term (e.g. 'Bias cut slip dress pattern')",
                "Secondary vibe term (e.g. '90s minimalist evening dress sewing pattern')",
                "Specific detail term (e.g. 'Spaghetti strap midi dress pattern')"
            ],
            "technicalSpecs": { 
                "silhouette": "Defined by the cut (e.g. A-Line, Sheath)", 
                "neckline": "Specific neckline", 
                "details": "Key construction details (e.g. Invisible Zipper, French Seams)",
                "fabric": "Suggested fabric weight"
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
        // Fallback robusto
        return {
            visualDescription: "Fashion Garment",
            searchKeywords: ["Sewing pattern", "Dress pattern"],
            technicalSpecs: { silhouette: "Unknown", neckline: "Unknown", details: "None", fabric: "Any" }
        };
    }
};
