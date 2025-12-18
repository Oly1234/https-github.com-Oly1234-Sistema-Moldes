
import { 
  Cylinder, Printer, Layers, Frame, Target, Maximize, Droplets, Palette, 
  Box, Scissors, PenTool, Feather, ImageIcon, Edit3, Grid, LayoutTemplate, 
  Maximize2, Diamond, AlignCenter, Columns, Hash, Brush, Pencil, Paintbrush2,
  ArrowDownToLine, RefreshCw, Sparkles, Wand2
} from 'lucide-react';

export const ATELIER_MESSAGES = {
    ANALYZING: "Escaneando DNA Cromático...",
    GENERATING: "Renderizando Camadas Industriais...",
    INPAINTING: "Refinando Área Selecionada...",
    SUCCESS: "Arquivo Pronto para Produção"
};

export const LAYOUT_STRUCTURES = [
    { id: 'ORIGINAL', label: 'Manter Original', icon: ImageIcon, variants: [] },
    { 
        id: 'LENCO', label: 'Lenço', icon: Frame,
        variants: [
            { id: 'DIAMANTE', label: 'Diamante', icon: Diamond },
            { id: 'MEDALHAO', label: 'Medalhão', icon: Target },
            { id: 'BANDANA', label: 'Bandana', icon: LayoutTemplate },
            { id: 'MULTILINE', label: 'Linhas Borda', icon: Columns }
        ]
    },
    { 
        id: 'BARRADO', label: 'Barrado', icon: Scissors,
        variants: [
            { id: 'SIMPLES', label: 'Simples Base', icon: ArrowDownToLine },
            { id: 'ESPELHADO', label: 'Duplo', icon: RefreshCw },
            { id: 'DEGRADE', label: 'Degradê', icon: Droplets }
        ]
    },
    { 
        id: 'CORRIDA', label: 'Corrido', icon: Layers,
        variants: [
            { id: 'RAPPORT', label: 'Rapport 60cm', icon: Grid },
            { id: 'HALFDROP', label: 'Half-Drop', icon: Maximize2 },
            { id: 'ORGANIC', label: 'Fluido', icon: Sparkles }
        ]
    }
];

export const ART_STYLES = [
    { id: 'ORIGINAL', label: 'Manter Original', icon: ImageIcon },
    { id: 'AQUARELA', label: 'Aquarela', icon: Droplets },
    { id: 'VETOR', label: 'Vetor Flat', icon: Box },
    { id: 'GUACHE', label: 'Guache', icon: Palette },
    { id: 'LAPIS', label: 'Lápis/Giz', icon: Pencil },
    { id: 'ACRILICA', label: 'Acrílica', icon: Brush },
    { id: 'GRAVATARIA', label: 'Gravataria', icon: PenTool }
];

export const TEXTURE_OVERLAYS = [
    { id: 'ORIGINAL', label: 'Manter Original', icon: ImageIcon },
    { id: 'LINHO', label: 'Linho Nobre' },
    { id: 'SARJA', label: 'Sarja Diagonal' },
    { id: 'CANVAS', label: 'Canvas Têxtil' },
    { id: 'CHAPISCO', label: 'Chapisco' }
];
