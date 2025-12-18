
import { useState, useCallback } from 'react';
import { PantoneColor, ExternalPatternMatch } from '../../types';
import { RadarEngine } from './RadarEngine';

export const useRadarStore = () => {
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [hasAnalyzed, setHasAnalyzed] = useState(false);
    const [detectedColors, setDetectedColors] = useState<PantoneColor[]>([]);
    const [fabricMatches, setFabricMatches] = useState<ExternalPatternMatch[]>([]);
    const [visibleMatchesCount, setVisibleMatchesCount] = useState(12);

    const handleUpload = useCallback((base64: string) => {
        setReferenceImage(base64);
        setHasAnalyzed(false);
        setFabricMatches([]);
    }, []);

    const startAnalysis = useCallback(async () => {
        if (!referenceImage) return;
        setIsAnalyzing(true);
        try {
            const data = await RadarEngine.analyze(referenceImage);
            setDetectedColors(data.colors || []);
            setFabricMatches(data.matches || []);
            setHasAnalyzed(true);
        } catch (e) {
            console.error(e);
        } finally {
            setIsAnalyzing(false);
        }
    }, [referenceImage]);

    const reset = useCallback(() => {
        setReferenceImage(null);
        setIsAnalyzing(false);
        setHasAnalyzed(false);
        setDetectedColors([]);
        setFabricMatches([]);
        setVisibleMatchesCount(12);
    }, []);

    const loadMore = useCallback(() => {
        setVisibleMatchesCount(prev => prev + 12);
    }, []);

    return {
        referenceImage,
        isAnalyzing,
        hasAnalyzed,
        detectedColors,
        fabricMatches,
        visibleMatchesCount,
        handleUpload,
        startAnalysis,
        reset,
        loadMore,
        setVisibleMatchesCount
    };
};
