
import { PantoneColor } from '../../types';

export const AtelierEngine = {
    // Corrected to accept variation argument as used in the store
    async analyzeColors(base64: string, variation: string = 'NATURAL'): Promise<PantoneColor[]> {
        const res = await fetch('/api/analyze', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ action: 'ANALYZE_COLOR_TREND', mainImageBase64: base64.split(',')[1] || base64, variation }) 
        });
        const data = await res.json();
        return data.success ? data.colors : [];
    },

    // Added missing extractPrompt method
    async extractPrompt(base64: string): Promise<string> {
        const res = await fetch('/api/analyze', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ action: 'ANALYZE_REFERENCE_FOR_PROMPT', mainImageBase64: base64.split(',')[1] || base64 }) 
        });
        const data = await res.json();
        return data.success ? data.prompt : "";
    },

    // Updated generate to include optional parameters used by the store
    async generate(params: {
        prompt: string, 
        customPrompt?: string,
        colors: PantoneColor[], 
        layout: string, 
        variant?: string,
        style: string,
        technique?: string,
        colorCount?: number,
        noTexture?: boolean
    }): Promise<string | null> {
        const res = await fetch('/api/analyze', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                action: 'GENERATE_PATTERN', 
                prompt: params.prompt, 
                customStyle: params.customPrompt,
                colors: params.colors, 
                layoutStyle: params.layout, 
                subLayoutStyle: params.variant,
                artStyle: params.style,
                technique: params.technique || 'DIGITAL',
                colorCount: params.colorCount || 0
            }) 
        });
        const data = await res.json();
        return data.success ? data.image : null;
    },

    // Added missing inpaint method
    async inpaint(params: {
        originalImage: string,
        mask: string,
        prompt: string
    }): Promise<string | null> {
        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'TRANSFORM_ELEMENT',
                cropBase64: params.mask.split(',')[1] || params.mask,
                userPrompt: params.prompt
            })
        });
        const data = await res.json();
        return data.success ? data.src : null;
    },

    async prepareProduction(imageBase64: string, technique: string): Promise<string | null> {
        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'PREPARE_PRODUCTION', mainImageBase64: imageBase64.split(',')[1] || imageBase64, targetSize: '4K', technique })
        });
        const data = await res.json();
        return data.success ? data.image : null;
    }
};
