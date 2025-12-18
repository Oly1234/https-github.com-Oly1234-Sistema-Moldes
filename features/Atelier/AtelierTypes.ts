
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
    customStyle?: string;
    customLayout?: string;
    colors: PantoneColor[];
    layout: string;
    variant?: string;
    style: string;
    technique: 'CYLINDER' | 'DIGITAL';
    colorCount: number;
}
