
import { useState, useCallback, useRef } from 'react';
import { PantoneColor } from '../../types';
import { AtelierEngine } from './AtelierEngine';
import { ATELIER_MESSAGES } from './AtelierConstants';

export const useAtelierStore = () => {
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [colors, setColors] = useState<PantoneColor[]>([]);
    const [colorVariation, setColorVariation] = useState<'VIVID' | 'NATURAL' | 'DARK'>('NATURAL');
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    
    const [activeLayout, setActiveLayout] = useState('CORRIDA');
    const [activeVariant, setActiveVariant] = useState('');
    const [activeStyle, setActiveStyle] = useState('VETOR');
    const [activeTexture, setActiveTexture] = useState('NONE');
    
    const [userPrompt, setUserPrompt] = useState('');
    const [customInstruction, setCustomInstruction] = useState('');

    // Inpainting State
    const [isInpaintingMode, setIsInpaintingMode] = useState(false);
    const [maskData, setMaskData] = useState<string | null>(null);

    const handleUpload = useCallback(async (base64: string) => {
        setReferenceImage(base64);
        setIsProcessing(true);
        setStatusMessage(ATELIER_MESSAGES.ANALYZING);
        try {
            // Corrected to match the updated AtelierEngine.analyzeColors signature
            const extractedColors = await AtelierEngine.analyzeColors(base64, colorVariation);
            setColors(extractedColors);
            // Corrected to match the updated AtelierEngine.extractPrompt method
            const prompt = await AtelierEngine.extractPrompt(base64);
            setUserPrompt(prompt);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    }, [colorVariation]);

    const changePantoneFilter = async (filter: 'VIVID' | 'NATURAL' | 'DARK') => {
        setColorVariation(filter);
        if (referenceImage) {
            setIsProcessing(true);
            // Corrected to match the updated AtelierEngine.analyzeColors signature
            const res = await AtelierEngine.analyzeColors(referenceImage, filter);
            setColors(res);
            setIsProcessing(false);
        }
    };

    const generate = useCallback(async () => {
        setIsProcessing(true);
        setStatusMessage(ATELIER_MESSAGES.GENERATING);
        try {
            // Corrected to match the updated AtelierEngine.generate parameter type
            const img = await AtelierEngine.generate({
                prompt: userPrompt,
                customPrompt: customInstruction,
                colors,
                layout: activeLayout,
                variant: activeVariant,
                style: activeStyle,
                noTexture: true // Crucial para o usuário aplicar a dele depois
            });
            if (img) setGeneratedPattern(img);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    }, [userPrompt, customInstruction, colors, activeLayout, activeVariant, activeStyle]);

    const executeInpaint = async (maskBase64: string, inpaintPrompt: string) => {
        if (!generatedPattern) return;
        setIsProcessing(true);
        setStatusMessage(ATELIER_MESSAGES.INPAINTING);
        try {
            // Corrected to match the updated AtelierEngine.inpaint method
            const result = await AtelierEngine.inpaint({
                originalImage: generatedPattern,
                mask: maskBase64,
                prompt: inpaintPrompt
            });
            if (result) setGeneratedPattern(result);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
            setIsInpaintingMode(false);
        }
    };

    const reset = () => {
        setReferenceImage(null);
        setGeneratedPattern(null);
        setColors([]);
        setIsInpaintingMode(false);
    };

    return {
        referenceImage, generatedPattern, colors, setColors,
        isProcessing, statusMessage,
        activeLayout, setActiveLayout, activeVariant, setActiveVariant,
        activeStyle, setActiveStyle, activeTexture, setActiveTexture,
        userPrompt, setUserPrompt, customInstruction, setCustomInstruction,
        colorVariation, changePantoneFilter, handleUpload, generate, reset,
        isInpaintingMode, setIsInpaintingMode, executeInpaint
    };
};
