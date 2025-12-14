
// DEPARTAMENTO: FORENSE VISUAL (The Lens)
// Responsabilidade: Desmembrar a imagem em dados técnicos puros e keywords de cauda longa.

export const analyzeVisualDNA = async (apiKey, imageBase64, mimeType, cleanJson, context = 'TEXTURE') => {
    let SYSTEM_PROMPT = '';

    if (context === 'TEXTURE') {
        // ABA DE CRIADOR: Foco na Arte/Superfície & Criação
        SYSTEM_PROMPT = `
        ACT AS: Senior Surface Designer & Textile Engineer (Portuguese Speaker).
        TASK: Analyze the artwork to enable a High-Definition Recreation (New Design Generation).
        
        ANALYSIS REQUIRED (RETURN VALUES IN PORTUGUESE PT-BR):
        1. LAYOUT TYPE: Is it "Corrida" (Seamless), "Barrada" (Border), "Localizada" (Placement)?
        2. ART STYLE: Detailed technique (e.g. "Aquarela no papel molhado", "Vetor Flat", "Traço Manual").
        3. STYLE GUIDE: Identify the artistic key elements to replicate (e.g. "Clean lines", "Vibrant gradient", "Vector precision").
        
        OUTPUT JSON:
        {
            "visualDescription": "Descrição visual rica em Português (Ex: Floral romântico com fundo azul e rosas em degradê)",
            "printLayout": "Corrida" (or "Barrada", "Geométrica"),
            "searchKeywords": [
                "Termo principal (EN)",
                "Termo técnico (EN)",
                "Termo visual (EN)"
            ],
            "technicalSpecs": { 
                "technique": "Técnica (PT-BR)", 
                "motifs": ["Motivo Principal (PT-BR)"], 
                "complexity": "Alta/Baixa",
                "vibe": "Mood (PT-BR)",
                "layout": "String (e.g. 'Barrada' or 'Corrida')",
                "restorationInstructions": "Style Guide for the AI Generator (In English) - Focus on quality (e.g. 'Vectorize, remove noise, sharp edges')"
            }
        }
        `;
    } else {
        // ABA DE ESCANEAMENTO: Foco na Engenharia da Roupa
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
        return JSON.parse(cleanJson(text));
    } catch (e) {
        console.error("Forensics Dept Error:", e);
        return {
            visualDescription: "Item de Moda",
            printLayout: "Padrão",
            searchKeywords: ["Pattern", "Texture"],
            technicalSpecs: { silhouette: "Desconhecido", layout: "Padrão", restorationInstructions: "High quality vector style" }
        };
    }
};
