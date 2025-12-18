
import { Cylinder, Printer, Layers, Frame, Target, Maximize, Droplets, Palette, Box, Scissors, PenTool, Feather, ImageIcon, Edit3 } from 'lucide-react';

export const ATELIER_MESSAGES = {
    ANALYZING: "Lendo DNA da Referência...",
    IDENTIFYING: "Identificando Paleta Pantone...",
    GENERATING_DIGITAL: "Renderizando Arquivo Digital (4K)...",
    GENERATING_VECTOR: "Gerando Vetores Industriais...",
    ERROR: "Falha na análise. Verifique a conexão."
};

export const LAYOUT_OPTIONS = [
    { id: 'CORRIDA', label: 'Corrida', icon: Layers },
    { id: 'BARRADO', label: 'Barrado', icon: Scissors },
    { id: 'LENCO', label: 'Lenço', icon: Frame }, 
    { id: 'LOCALIZADA', label: 'Localizada', icon: Target },
    { id: 'PAREO', label: 'Pareô', icon: Maximize },
];

export const ART_STYLES = [
    { id: 'VETOR', label: 'Vetor Flat', icon: Box },
    { id: 'WATERCOLOR', label: 'Aquarela', icon: Droplets },
    { id: 'ACRILICA', label: 'Acrílica', icon: Palette },
    { id: 'BORDADO', label: 'Bordado', icon: Scissors },
    { id: 'LINHA', label: 'Line Art', icon: PenTool },
];
