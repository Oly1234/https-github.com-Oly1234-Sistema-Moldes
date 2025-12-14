
// api/modules/generator.js
// ESPECIALIDADE: Geração de Imagens (Text-to-Image / Image-to-Image)

export const generatePattern = async (apiKey, prompt, colors) => {
    // Instrução aprimorada para focar em DESIGN DE SUPERFÍCIE (Surface Design)
    const colorInstruction = colors && colors.length > 0 ? `COLOR PALETTE: ${colors.map(c => c.name).join(', ')}.` : '';
    
    const finalPrompt = `
    Create a professional Seamless Textile Pattern. 
    Subject: ${prompt}. 
    ${colorInstruction}
    
    STYLE: Digital Surface Design, Flat Lay, 2D Texture Swatch. 
    DETAILS: High fidelity, repeating seamless background, no shadows, no perspective, edge-to-edge pattern. 
    OUTPUT: A single square image tileable on all sides.
    `;

    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
    
    try {
        const response = await fetch(endpointImg, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({
                contents: [{ parts: [{ text: finalPrompt }] }],
                generation_config: { 
                    response_mime_type: "image/jpeg",
                    aspect_ratio: "1:1",
                    // Solicita apenas 1 candidato para ser rápido
                    candidate_count: 1
                 }
            }) 
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Google API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
        
        if (imagePart) {
             return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        } else {
             console.error("No image data in response", data);
             throw new Error("O modelo gerou texto em vez de imagem. Tente simplificar o prompt.");
        }
    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
