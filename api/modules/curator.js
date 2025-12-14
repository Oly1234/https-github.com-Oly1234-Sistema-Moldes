
// api/modules/curator.js
// DEPARTAMENTO: CURADORIA VISUAL & CONTROLE DE QUALIDADE ESTÉTICA
// RESPONSÁVEL: Vingi Curator (IA Vision)

export const selectVisualTwin = async (apiKey, candidates, userReferenceImage, contextType = 'CLOTHING') => {
    // Se não houver candidatos ou referência, não há o que curar.
    if (!candidates || candidates.length === 0) return null;
    if (!userReferenceImage || !apiKey) return candidates[0].url;

    try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        // Prepara a lista para a IA ler
        const candidatesText = candidates.map((c, i) => `ID_${i}: ${c.title} | URL: ${c.url}`).join('\n');

        // PROMPTS ESPECIALIZADOS POR DEPARTAMENTO
        let CRITERIA_PROMPT = '';

        if (contextType === 'CLOTHING') {
            CRITERIA_PROMPT = `
            CONTEXT: We are looking for a SEWING PATTERN image that matches the User Reference.
            
            STRICT SELECTION RULES:
            1. REJECT COVERS/ENVELOPES: If the User Reference is a real person, DO NOT pick a drawn envelope cover or illustration unless it's the only option. Look for the "Model Photo".
            2. REJECT LOGOS: Never pick an image that looks like a store logo or banner.
            3. VISUAL TWIN: Pick the image that visually matches the User Reference (Pose, Color, Cut).
            4. PRIORITY: Real Model Photo > Mannequin > Technical Drawing > Pattern Envelope > Random Stock Photo.
            `;
        } else {
            // SURFACE / TEXTURE (ATUALIZADO PARA COR)
            CRITERIA_PROMPT = `
            CONTEXT: We are looking for a SURFACE PATTERN / TEXTURE that matches the User Reference.
            
            STRICT SELECTION RULES:
            1. COLOR MATCH IS KING: The dominant color of the result MUST match the reference. If reference is Yellow, reject Blue images.
            2. TEXTURE FOCUS: We want a flat swatch or a clear view of the print.
            3. REJECT MOCKUPS: Avoid images where the print is distorted on a pillow/mug.
            4. REJECT LOGOS: Never pick a brand logo (like 'Freepik' logo).
            `;
        }

        const FINAL_PROMPT = `
        ACT AS: Senior Visual Curator.
        TASK: Select the single best image URL from the Candidates that matches the User Reference Image.
        
        ${CRITERIA_PROMPT}

        CANDIDATES:
        ${candidatesText}

        OUTPUT JSON ONLY: { "bestId": integer, "reasoning": "string" }
        `;

        const payload = {
            contents: [{
                parts: [
                    { text: FINAL_PROMPT },
                    { inline_data: { mime_type: "image/jpeg", data: userReferenceImage } } 
                ]
            }],
            generation_config: { response_mime_type: "application/json" }
        };

        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(payload) 
        });

        const data = await response.json();
        
        // Tratamento de Resposta
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return candidates[0].url;

        // Limpeza básica do JSON
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const decision = JSON.parse(cleanText);
        
        let bestIndex = decision.bestId;
        
        // Validação de Segurança
        if (typeof bestIndex !== 'number' || bestIndex < 0 || bestIndex >= candidates.length) {
            bestIndex = 0;
        }

        return candidates[bestIndex].url;

    } catch (e) {
        console.error("Curator Brain Freeze:", e);
        // Fallback: Retorna o primeiro candidato se a IA falhar
        return candidates[0].url;
    }
};
