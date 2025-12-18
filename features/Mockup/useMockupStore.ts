
import { useState, useCallback } from 'react';
import { MOCKUP_DEFAULTS } from './MockupConstants';

export const useMockupStore = () => {
    const [moldImage, setMoldImage] = useState<string | null>(null);
    const [activeTool, setActiveTool] = useState<'WAND' | 'HAND'>('WAND');
    const [activeScale, setActiveScale] = useState(MOCKUP_DEFAULTS.SCALE);
    const [activeRotation, setActiveRotation] = useState(MOCKUP_DEFAULTS.ROTATION);

    const handleUpload = useCallback((base64: string) => {
        setMoldImage(base64);
    }, []);

    const reset = useCallback(() => {
        setMoldImage(null);
        setActiveTool('WAND');
        setActiveScale(MOCKUP_DEFAULTS.SCALE);
        setActiveRotation(MOCKUP_DEFAULTS.ROTATION);
    }, []);

    return {
        moldImage,
        activeTool,
        setActiveTool,
        activeScale,
        setActiveScale,
        activeRotation,
        setActiveRotation,
        handleUpload,
        reset
    };
};
