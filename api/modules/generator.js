
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
    let artStyleInstruction = "";
    if (artStyle === 'CUSTOM' && customStyle) {
        artStyleInstruction = `ART STYLE: ${customStyle.toUpperCase()}. Follow this aesthetic strictly.`;
    } else {
        switch (artStyle) {
            case 'WATERCOLOR': artStyleInstruction = "ART STYLE: WET WATERCOLOR PAINTING. Translucent washes, bleeding edges, soft gradients, paper texture visible. No hard outlines."; break;
            case 'GIZ': artStyleInstruction = "ART STYLE: DRY PASTEL / CHALK. Textured strokes, dusty appearance, soft blending, rough paper grain."; break;
            case 'ACRILICA': artStyleInstruction = "ART STYLE: ACRYLIC IMPASTO. Thick visible brushstrokes, vibrant opaque colors, slight texture relief, expressive painterly look."; break;
            case 'VETOR': artStyleInstruction = "ART STYLE: FLAT VECTOR ILLUSTRATION. Clean sharp lines, solid fills, no gradients, no texture. Minimalist and modern."; break;
            case 'BORDADO': artStyleInstruction = "ART STYLE: EMBROIDERY / NEEDLEWORK. Render the design as stitched threads on fabric. Satin stitch, cross-stitch details. Tactile texture."; break;
            case 'LINHA': artStyleInstruction = "ART STYLE: LINE ART / INK SKETCH. Black outline only (or monochrome), etching style, detailed hatching. No fills."; break;
            case 'ORNAMENTAL': artStyleInstruction = "ART STYLE: BAROQUE ORNAMENTAL. Highly intricate filigree, flourishes, luxury detailing, damask complexity."; break;
            default: artStyleInstruction = "ART STYLE: Maintain the aesthetic style of the original reference."; break;
        }
    }

    // 3. Contexto de Layout (Aprimorado)
    let layoutInstruction = "Seamless repeat pattern (All-over/Corrida).";
    let sizeInstruction = targetSize ? `TARGET DIMENSIONS: ${targetSize}. Compose the elements to fit this scale perfectly.` : "";
    
    if (layoutStyle && layoutStyle !== 'ORIGINAL') {
        switch (layoutStyle) {
            case 'BARRADO':
                layoutInstruction = `
                LAYOUT: HORIZONTAL BORDER PRINT (Barrado). 
                STRUCTURE: Heavy, intricate motifs at the BOTTOM edge, flowing upwards into negative space.
                ${subLayoutStyle === 'DUPLO' ? 'SUB-STYLE: MIRRORED BORDER. Identical heavy borders on BOTH Top and Bottom edges.' : ''}
                ${subLayoutStyle === 'DEGRADE' ? 'SUB-STYLE: GRADIENT FADE. Motifs visually dissolve from bottom to top.' : ''}
                `;
                break;
            case 'LENCO':
                layoutInstruction = `
                LAYOUT: ENGINEERED SQUARE SCARF (Foulard/Carré).
                GEOMETRY: Perfectly SYMMETRICAL Square Composition with border frame.
                ${subLayoutStyle === 'MEDALHAO' ? 'SUB-STYLE: MEDALLION. Central circular motif radiating outwards.' : ''}
                ${subLayoutStyle === 'BANDANA' ? 'SUB-STYLE: BANDANA/PAISLEY. Concentric frames with paisley.' : ''}
                `;
                break;
            case 'LOCALIZADA':
                layoutInstruction = `LAYOUT: PLACED PRINT (T-Shirt Graphic). Single isolated artwork centered on a solid background.`;
                break;
            case 'PAREO':
                layoutInstruction = `LAYOUT: BEACH PAREO PANEL (Vertical Rectangle). Large scale tropical/ornamental design framed for a vertical panel.`;
                break;
            case 'CORRIDA':
                layoutInstruction = `
                LAYOUT: ALL-OVER SEAMLESS REPEAT.
                ${subLayoutStyle === 'TOSS' ? 'SUB-STYLE: TOSSED. Elements scattered randomly.' : ''}
                ${subLayoutStyle === 'GRID' ? 'SUB-STYLE: GRID. Elements aligned in strict rows/columns.' : ''}
                `;
                break;
        }
    }

    // 4. SELEÇÃO DE TÉCNICA (CILINDRO VS DIGITAL)
    let TECHNIQUE_RULES = "";
    if (technique === 'DIGITAL') {
        TECHNIQUE_RULES = `
        PRINT TECH: DIGITAL PRINTING (Sublimation/Direct).
        FEATURES: High fidelity, millions of colors, gradients allowed, photo-realistic details allowed.
        `;
    } else {
        // CILINDRO STRICT RULES
        TECHNIQUE_RULES = `
        PRINT TECH: ROTARY SCREEN (Cilindro/Silk).
        CRITICAL RULES:
        1. SOLID SPOT COLORS ONLY.
        2. NO GRADIENTS, NO FADING, NO TRANSPARENCY.
        3. DISTINCT SEPARATION between colors.
        4. SIMPLIFIED SHAPES suitable for engraving.
        ${colorCount > 0 ? `RESTRICTION: Use EXACTLY ${colorCount} distinct colors.` : "Use a limited palette (Max 8 colors)."}
        `;
    }

    // 5. Prompt Final
    const FULL_PROMPT = `Generate a professional textile pattern design.
    
    THEME/SUBJECT: ${prompt}.
    
    ${layoutInstruction}
    
    ${sizeInstruction}
    
    ${artStyleInstruction}
    
    ${colorContext}
    
    TECHNICAL SPECS:
    ${TECHNIQUE_RULES}
    
    VISUAL RULES:
    - CLOSE-UP ARTWORK (Top-down view).
    - NO human models, NO mannequins, NO 3D garments.
    - Image must be a flat rectangular/square swatch.
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
