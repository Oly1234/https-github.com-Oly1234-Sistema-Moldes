
import { useState, useCallback } from 'react';
import { PatternAnalysisResult } from '../../types';
import { ScannerEngine } from './ScannerEngine';

export const useScannerStore = () => {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [result, setResult] = useState<PatternAnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleUpload = useCallback((base64: string) => {
        setUploadedImage(base64);
        setResult(null);
    }, []);

    const startAnalysis = useCallback(async () => {
        if (!uploadedImage) return;
        setIsAnalyzing(true);
        try {
            const analysis = await ScannerEngine.analyze(uploadedImage);
            setResult(analysis);
            ScannerEngine.saveToHistory(analysis);
        } catch (e) {
            console.error(e);
            throw e;
        } finally {
            setIsAnalyzing(false);
        }
    }, [uploadedImage]);

    const reset = useCallback(() => {
        setUploadedImage(null);
        setResult(null);
        setIsAnalyzing(false);
    }, []);

    return {
        uploadedImage,
        result,
        isAnalyzing,
        handleUpload,
        startAnalysis,
        reset
    };
};
