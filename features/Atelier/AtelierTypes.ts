
import { PantoneColor } from '../../types';

export interface AtelierState {
    referenceImage: string | null;
    generatedPattern: string | null;
    colors: PantoneColor[];
    isProcessing: boolean;
    statusMessage: string;
    activeLayout: string;
    activeStyle: string;
    userPrompt: string;
}

export interface GenerationParams {
    prompt: string;
    colors: PantoneColor[];
    layout: string;
    style: string;
    technique: 'CYLINDER' | 'DIGITAL';
    colorCount: number;
}
