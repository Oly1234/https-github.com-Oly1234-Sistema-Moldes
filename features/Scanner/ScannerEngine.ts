
import { analyzeClothingImage } from '../../services/geminiService';
import { PatternAnalysisResult, ScanHistoryItem } from '../../types';

export const ScannerEngine = {
    async analyze(mainImage: string, secondaryImage?: string | null): Promise<PatternAnalysisResult> {
        const mainBase64 = mainImage.split(',')[1];
        const mainType = mainImage.split(';')[0].split(':')[1];
        let secondaryBase64: string | null = null;
        if (secondaryImage) {
            secondaryBase64 = secondaryImage.split(',')[1];
        }
        return await analyzeClothingImage(mainBase64, mainType, secondaryBase64);
    },

    saveToHistory(res: PatternAnalysisResult) {
        const newItem: ScanHistoryItem = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            patternName: res.patternName,
            category: res.category,
            dnaSummary: `${res.technicalDna.silhouette}, ${res.technicalDna.neckline}`
        };
        const stored = localStorage.getItem('vingi_scan_history');
        const currentHistory = stored ? JSON.parse(stored) : [];
        localStorage.setItem('vingi_scan_history', JSON.stringify([newItem, ...currentHistory].slice(0, 50)));
    }
};
