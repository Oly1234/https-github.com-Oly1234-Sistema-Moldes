
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
            CONTEXT: The user needs a VISUAL REFERENCE for a sewing pattern.
            
            STRICT FILTERING RULES (TOLERANCE ZERO):
            1. SINGLE SUBJECT: Prefer photos with ONE model. Reject crowded magazine covers with multiple people/men unless the reference is men's wear.
            2. REALISM: Prefer REAL PHOTOS over drawings/sketches/illustrations.
            3. FULL VIEW: Prefer full-body or torso shots where the garment structure is visible.
            4. REJECT: Blurry thumbnails, logos, text-heavy images.
            `;
        } else {
            // SURFACE / TEXTURE - REGRAS RÍGIDAS DE FLAT LAY
            CRITERIA_PROMPT = `
            CONTEXT: The user is looking for a PRINT DESIGN FILE (Surface Pattern).
            
            STRICT FILTERING RULES (TOLERANCE ZERO):
            1. ACCEPT ONLY: Flat 2D views of the pattern, digital swatches, or direct scans of fabric.
            2. REJECT HARD: Mockups on 3D objects (Mugs, Pillows, Phone cases, T-shirts) where the pattern is distorted. We need the RAW FILE view.
            3. REJECT HARD: Logos, text banners, or blurry thumbnails.
            4. COLOR MATCH: The image MUST match the dominant colors of the reference.
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
