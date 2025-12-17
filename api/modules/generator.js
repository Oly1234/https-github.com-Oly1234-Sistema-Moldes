
// api/modules/generator.js
// MOTOR DE GERAÇÃO: VINGI DIRECT (SDK Implementation)
import { GoogleGenAI } from "@google/genai";

export const generatePattern = async (apiKey, prompt, colors, selvedgeInfo, technique = 'CYLINDER', colorCount = 0, layoutStyle = 'ORIGINAL', subLayoutStyle = '', artStyle = 'ORIGINAL', targetSize = 'PADRAO', customStyle = '') => {
    const ai = new GoogleGenAI({ apiKey });

    // 1. Contexto de Cor (Se disponível)
    const colorContext = (colors && colors.length > 0) 
        ? `STRICT PALETTE: ${colors.map(c => c.name).join(', ')}. Dominant tones: ${colors.slice(0,2).map(c => c.hex).join(', ')}.` 
        : "Use colors that match the requested theme.";

    // 2. Contexto de Estilo Artístico
    // AJUSTE: Forçar que mesmo estilos manuais (aquarela) sejam escaneados/flat, não fotos de papel.
    let artStyleInstruction = "";
    if (artStyle === 'CUSTOM' && customStyle) {
        artStyleInstruction = `ART STYLE: ${customStyle.toUpperCase()}. Render as FLAT 2D DIGITAL ART.`;
    } else {
        switch (artStyle) {
            case 'WATERCOLOR': artStyleInstruction = "ART STYLE: DIGITAL WATERCOLOR. Wet-on-wet effect but on a FLAT white digital canvas. No paper grain, no lighting."; break;
            case 'GIZ': artStyleInstruction = "ART STYLE: PASTEL TEXTURE. Chalky strokes, pure 2D composition. No paper background."; break;
            case 'ACRILICA': artStyleInstruction = "ART STYLE: IMPASTO PAINTING. Visible strokes but rendered as a FLAT SCAN. No glossy highlights."; break;
            case 'VETOR': artStyleInstruction = "ART STYLE: FLAT VECTOR ILLUSTRATION. Sharp crisp lines, solid fills. Adobe Illustrator style."; break;
            case 'BORDADO': artStyleInstruction = "ART STYLE: FLAT EMBROIDERY DESIGN. Vector representation of stitches. NO 3D fabric rendering."; break;
            case 'LINHA': artStyleInstruction = "ART STYLE: TECHNICAL LINE ART. Black ink on white. Clean contours only."; break;
            case 'ORNAMENTAL': artStyleInstruction = "ART STYLE: BAROQUE VECTOR. Complex filigree, flat gold/color fills. No metallic reflections."; break;
            default: artStyleInstruction = "ART STYLE: Flat digital textile artwork."; break;
        }
    }

    // 3. Contexto de Layout
    let layoutInstruction = "Seamless repeat pattern (All-over/Corrida).";
    let sizeInstruction = targetSize ? `TARGET DIMENSIONS: ${targetSize}.` : "";
    
    if (layoutStyle && layoutStyle !== 'ORIGINAL') {
        switch (layoutStyle) {
            case 'BARRADO':
                layoutInstruction = `LAYOUT: BORDER PRINT (Barrado). Heavy motifs at bottom, fading up to whitespace. FLAT 2D VIEW.`;
                break;
            case 'LENCO':
                layoutInstruction = `LAYOUT: ENGINEERED SQUARE SCARF. Symmetrical composition with borders. FLAT 2D VIEW.`;
                break;
            case 'LOCALIZADA':
                layoutInstruction = `LAYOUT: PLACED GRAPHIC (Spot Print). Isolated artwork on solid background.`;
                break;
            case 'PAREO':
                layoutInstruction = `LAYOUT: PAREO PANEL. Vertical rectangular composition.`;
                break;
            case 'CORRIDA':
                layoutInstruction = `LAYOUT: SEAMLESS REPEAT PATTERN.`;
                break;
        }
    }

    // 4. SELEÇÃO DE TÉCNICA (CILINDRO VS DIGITAL)
    let TECHNIQUE_RULES = "";
    if (technique === 'DIGITAL') {
        TECHNIQUE_RULES = `
        TECHNIQUE: DIGITAL SUBLIMATION FILE.
        - High fidelity details allowed.
        - Complex gradients allowed.
        - MUST BE A FLAT FILE ready for the printer.
        `;
    } else {
        TECHNIQUE_RULES = `
        TECHNIQUE: ROTARY SCREEN SEPARATION (Cilindro).
        - SOLID SPOT COLORS ONLY.
        - NO GRADIENTS, NO OPACITY, NO BLURS.
        - Hard edge separation between colors.
        - Vector-like appearance.
        ${colorCount > 0 ? `RESTRICTION: Exactly ${colorCount} colors.` : "Limited palette."}
        `;
    }

    // 5. Prompt Final - REESCRITO PARA "ARQUIVO DIGITAL"
    const FULL_PROMPT = `
    GENERATE A TEXTILE PRINT FILE (DIGITAL ASSET).
    
    THEME: ${prompt}.
    
    VISUAL REQUIREMENTS (CRITICAL):
    1. VIEW: FLAT 2D TOP-DOWN. This is the SOURCE FILE, NOT a photo of fabric.
    2. NO TEXTURE: Do not add fabric grain, weave, knits, or threads.
    3. NO LIGHTING: No shadows, no highlights, no folds, no wrinkles. Pure flat colors.
    4. BACKGROUND: Solid uniform color (or transparent).
    5. QUALITY: High definition, sharp edges, professional print-ready file.
    
    ${layoutInstruction}
    ${sizeInstruction}
    ${artStyleInstruction}
    ${colorContext}
    ${TECHNIQUE_RULES}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: FULL_PROMPT }] },
            config: {
                imageConfig: { aspectRatio: layoutStyle === 'PAREO' ? "9:16" : "1:1" }
            }
        });

        let imageUrl = null;
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                }
            }
        }

        if (!imageUrl) throw new Error("A IA não gerou a imagem.");
        return imageUrl;

    } catch (e) {
        console.error("Generator Error:", e);
        throw e;
    }
};
