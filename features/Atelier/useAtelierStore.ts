
import { useState, useCallback } from 'react';
import { PantoneColor } from '../../types';
import { AtelierEngine } from './AtelierEngine';
import { ATELIER_MESSAGES } from './AtelierConstants';

export const useAtelierStore = () => {
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [colors, setColors] = useState<PantoneColor[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [activeLayout, setActiveLayout] = useState('CORRIDA');
    const [activeStyle, setActiveStyle] = useState('VETOR');
    const [userPrompt, setUserPrompt] = useState('');

    const handleUpload = useCallback(async (base64: string) => {
        setReferenceImage(base64);
        setIsProcessing(true);
        setStatusMessage(ATELIER_MESSAGES.ANALYZING);
        try {
            const extractedColors = await AtelierEngine.analyzeColors(base64);
            setColors(extractedColors);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const generate = useCallback(async () => {
        setIsProcessing(true);
        setStatusMessage(ATELIER_MESSAGES.GENERATING_DIGITAL);
        setGeneratedPattern(null);
        try {
            const img = await AtelierEngine.generate({
                prompt: userPrompt || "Premium textile design",
                colors,
                layout: activeLayout,
                style: activeStyle,
                technique: 'DIGITAL',
                colorCount: 0
            });
            if (img) setGeneratedPattern(img);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    }, [userPrompt, colors, activeLayout, activeStyle]);

    const reset = useCallback(() => {
        setReferenceImage(null);
        setGeneratedPattern(null);
        setColors([]);
        setUserPrompt('');
    }, []);

    return {
        referenceImage, generatedPattern, colors, setColors, isProcessing,
        statusMessage, activeLayout, setActiveLayout, activeStyle, setActiveStyle,
        userPrompt, setUserPrompt, handleUpload, generate, reset
    };
};
