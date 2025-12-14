
// api/modules/generator.js
// DEPARTAMENTO: ATELIER DIGITAL (Geração & Restauração de Estampas)

export const generatePattern = async (apiKey, prompt, colors, layoutType = "Seamless", restorationNotes = "Clean lines") => {
    // 1. Definição do Modelo (Nano Banana para Imagem)
    const MODEL_NAME = 'gemini-2.5-flash-image'; 
    const endpointImg = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    // 2. Construção do Prompt de Engenharia Reversa (Restauração)
    const colorList = colors && colors.length > 0 ? colors.map(c => c.name).join(', ') : 'harmonious original colors';
    
    // Prompt Otimizado: Ordena a IA a agir como um vetorizador profissional
    // Instruímos explicitamente a corrigir os erros detectados pelo Forense
    const finalPrompt = `
    TASK: Create a pristine, high-resolution textile pattern based on this description.
    THEME: ${prompt}.
    LAYOUT STRUCTURE: ${layoutType} (Critical: Respect this structure. If 'Border', place elements at bottom. If 'Seamless', ensure perfect tiling).
    COLOR PALETTE: ${colorList}.
    
    QUALITY CONTROL INSTRUCTIONS:
    - FIX FLAWS: ${restorationNotes}.
    - STYLE: Professional Vector Illustration, Clean Lines, No Artifacts, No Noise.
    - OUTPUT: Flat lay design, straight view, ready for digital printing.
    `;

    try {
        // PAYLOAD BLINDADO (Anti-Erro 400)
        // Removemos imageSize e outros params que podem ser instáveis em algumas keys
        const payload = {
            contents: [{ 
                parts: [
                    { text: finalPrompt }
                ] 
            }],
            generationConfig: {
                imageConfig: {
                    aspectRatio: "1:1" // Único parâmetro mandatório e seguro
                }
            }
        };

        const response = await fetch(endpointImg, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!response.ok) {
            const errText = await response.text();
            console.error("Generator API Error Details:", errText);
            
            // Tratamento amigável de erro de permissão
            if (response.status === 400 || response.status === 403) {
                throw new Error("Acesso ao modelo de imagem negado. Verifique se sua API Key tem permissão para 'gemini-2.5-flash-image' (Google AI Studio).");
            }
            throw new Error(`Erro Atelier (${response.status}): ${errText}`);
        }

        const data = await response.json();
        
        // 3. Extração da Imagem
        const parts = data.candidates?.[0]?.content?.parts;
        const imagePart = parts?.find(p => p.inline_data);
        
        if (imagePart) {
             return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
        } 
        
        // Verifica recusa por segurança (Safety Settings)
        const finishReason = data.candidates?.[0]?.finish_reason;
        if (finishReason === 'SAFETY') {
            throw new Error("A IA recusou gerar esta estampa por motivos de segurança. Tente um tema mais neutro.");
        }

        throw new Error("O servidor respondeu, mas não retornou dados de imagem. Tente novamente.");

    } catch (e) {
        console.error("Generator Module Error:", e);
        throw e;
    }
};
