
import { useState, useCallback } from 'react';
import { PantoneColor } from '../../types';
import { AtelierEngine } from './AtelierEngine';

export const useAtelierStore = () => {
    // Core state
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [technique, setTechnique] = useState<'CYLINDER' | 'DIGITAL' | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    
    // Tools settings
    const [colors, setColors] = useState<PantoneColor[]>([]);
    const [colorVariation, setColorVariation] = useState<'VIVID' | 'NATURAL' | 'DARK'>('NATURAL');
    
    const [activeLayout, setActiveLayout] = useState('ORIGINAL');
    const [activeVariant, setActiveVariant] = useState('');
    const [layoutText, setLayoutText] = useState('');
    
    const [activeStyle, setActiveStyle] = useState('ORIGINAL');
    const [styleText, setStyleText] = useState('');
    
    const [activeTexture, setActiveTexture] = useState('ORIGINAL');
    const [textureText, setTextureText] = useState('');

    const [userPrompt, setUserPrompt] = useState('');

    // Inpainting State
    const [isInpainting, setIsInpainting] = useState(false);
    const [inpaintPrompt, setInpaintPrompt] = useState('');

    const handleUpload = useCallback(async (base64: string) => {
        setReferenceImage(base64);
        setGeneratedPattern(null);
        setIsProcessing(true);
        setStatusMessage("Mapeando Cromatismo...");
        try {
            const extracted = await AtelierEngine.analyzeColors(base64, colorVariation);
            setColors(extracted);
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
            const res = await AtelierEngine.analyzeColors(referenceImage, filter);
            setColors(res);
            setIsProcessing(false);
        }
    };

    const generate = useCallback(async () => {
        if (!referenceImage) return;
        setIsProcessing(true);
        setStatusMessage("Renderizando IA...");
        try {
            const img = await AtelierEngine.generate({
                prompt: userPrompt,
                colors,
                layout: activeLayout,
                variant: activeVariant,
                style: activeStyle,
                technique: technique || 'DIGITAL',
                customLayout: layoutText,
                customStyle: styleText
            });
            if (img) setGeneratedPattern(img);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    }, [referenceImage, userPrompt, colors, activeLayout, activeVariant, activeStyle, technique, layoutText, styleText]);

    const executeInpaint = async (maskBase64: string) => {
        if (!generatedPattern) return;
        setIsProcessing(true);
        setStatusMessage("Refinando área...");
        try {
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
            setIsInpainting(false);
            setInpaintPrompt('');
        }
    };

    const reset = () => {
        setReferenceImage(null);
        setGeneratedPattern(null);
        setTechnique(null);
        setColors([]);
        setIsInpainting(false);
    };

    return {
        referenceImage, generatedPattern, technique, setTechnique,
        isProcessing, statusMessage, colors, colorVariation,
        activeLayout, setActiveLayout, activeVariant, setActiveVariant, layoutText, setLayoutText,
        activeStyle, setActiveStyle, styleText, setStyleText,
        activeTexture, setActiveTexture, textureText, setTextureText,
        userPrompt, setUserPrompt,
        handleUpload, generate, changePantoneFilter, reset,
        isInpainting, setIsInpainting, inpaintPrompt, setInpaintPrompt, executeInpaint
    };
};
