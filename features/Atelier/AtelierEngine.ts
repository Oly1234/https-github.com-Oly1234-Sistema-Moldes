
import { PantoneColor } from '../../types';

export const AtelierEngine = {
    async analyzeColors(base64: string): Promise<PantoneColor[]> {
        const res = await fetch('/api/analyze', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ action: 'ANALYZE_COLOR_TREND', mainImageBase64: base64.split(',')[1], variation: 'NATURAL' }) 
        });
        const data = await res.json();
        return data.success ? data.colors : [];
    },

    async generate(params: {
        prompt: string, 
        colors: PantoneColor[], 
        layout: string, 
        style: string,
        technique: string,
        colorCount: number
    }): Promise<string | null> {
        const res = await fetch('/api/analyze', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                action: 'GENERATE_PATTERN', 
                prompt: params.prompt, 
                colors: params.colors, 
                layoutStyle: params.layout, 
                artStyle: params.style,
                technique: params.technique,
                colorCount: params.colorCount
            }) 
        });
        const data = await res.json();
        return data.success ? data.image : null;
    },

    async prepareProduction(imageBase64: string, technique: string): Promise<string | null> {
        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'PREPARE_PRODUCTION', mainImageBase64: imageBase64.split(',')[1], targetSize: '4K', technique })
        });
        const data = await res.json();
        return data.success ? data.image : null;
    }
};
