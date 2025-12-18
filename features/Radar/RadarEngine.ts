
import { PantoneColor, ExternalPatternMatch } from '../../types';

export const RadarEngine = {
    async analyze(imageBase64: string): Promise<{
        colors: PantoneColor[],
        matches: ExternalPatternMatch[],
        specs: any
    }> {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'DESCRIBE_PATTERN', 
                mainImageBase64: imageBase64.split(',')[1], 
                mainMimeType: 'image/jpeg' 
            })
        });
        const data = await response.json();
        if (!data.success) throw new Error("Falha na análise");
        
        return {
            colors: data.colors || [],
            matches: data.stockMatches || [],
            specs: data.technicalSpecs || null
        };
    }
};
