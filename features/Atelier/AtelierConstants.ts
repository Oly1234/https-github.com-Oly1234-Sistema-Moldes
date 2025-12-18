
import { 
  Cylinder, Printer, Layers, Frame, Target, Maximize, Droplets, Palette, 
  Box, Scissors, PenTool, Feather, ImageIcon, Edit3, Grid, LayoutTemplate, 
  Maximize2, Diamond, AlignCenter, Columns, Hash, Brush, Pencil, Paintbrush2,
  ArrowDownToLine, RefreshCw, Sparkles
} from 'lucide-react';

export const ATELIER_MESSAGES = {
    ANALYZING: "Mapeando DNA e Cromatismo...",
    IDENTIFYING: "Calculando Paleta Pantone TCX...",
    GENERATING: "Renderizando Arquivo Industrial...",
    INPAINTING: "Refinando Área Selecionada...",
    ERROR: "Falha na análise. Verifique a conexão."
};

export const LAYOUT_STRUCTURES = [
    { 
        id: 'LENCO', label: 'Lenço', icon: Frame,
        variants: [
            { id: 'DIAMANTE', label: 'Diamante', icon: Diamond },
            { id: 'MEDALHAO', label: 'Medalhão Central', icon: Target },
            { id: 'BANDANA', label: 'Bandana / Quadro', icon: LayoutTemplate },
            { id: 'MULTILINE', label: '1-4 Linhas Borda', icon: Columns },
            { id: 'LISTRADO', label: 'Listras Enquadradas', icon: Hash }
        ]
    },
    { 
        id: 'BARRADO', label: 'Barrado', icon: Scissors,
        variants: [
            { id: 'SIMPLES', label: 'Simples Base', icon: ArrowDownToLine },
            { id: 'ESPELHADO', label: 'Barrado Duplo', icon: RefreshCw },
            { id: 'DEGRADE', label: 'Degradê Borda', icon: Droplets }
        ]
    },
    { 
        id: 'CORRIDA', label: 'Corrido', icon: Layers,
        variants: [
            { id: 'RAPPORT', label: 'Rapport 60cm', icon: Grid },
            { id: 'HALFDROP', label: 'Half-Drop', icon: Maximize2 },
            { id: 'ORGANIC', label: 'Fluido / All-over', icon: Sparkles }
        ]
    },
    { id: 'LOCALIZADA', label: 'Localizada', icon: Target, variants: [] }
];

export const ART_STYLES = [
    { id: 'AQUARELA', label: 'Aquarela', icon: Droplets, prompt: "Fine watercolor texture, wet-on-wet, artistic bleeds" },
    { id: 'GUACHE', label: 'Guache', icon: Palette, prompt: "Opaque gouache painting, visible thick brush strokes" },
    { id: 'LAPIS', label: 'Lápis / Giz', icon: Pencil, prompt: "Hand-drawn colored pencil texture, grainy shading" },
    { id: 'VETOR', label: 'Vetor Flat', icon: Box, prompt: "Clean solid flat vector shapes, no gradients, industrial sharp" },
    { id: 'ACRILICA', label: 'Acrílica', icon: Brush, prompt: "Impasto acrylic paint, heavy texture, palette knife marks" },
    { id: 'GRAVATARIA', label: 'Gravataria', icon: PenTool, prompt: "Micro-geometric tie pattern, repetitive luxury aesthetic" },
    { id: 'LINEART', label: 'Line Art', icon: PenTool, prompt: "Minimalist black and white continuous line drawing" }
];

export const TEXTURE_OVERLAYS = [
    { id: 'NONE', label: 'Lisa / Sem Trama', mixMode: 'normal' },
    { id: 'LINHO', label: 'Linho Nobre', image: '/textures/linen.jpg', mixMode: 'multiply' },
    { id: 'SARJA', label: 'Sarja Diagonal', image: '/textures/twill.jpg', mixMode: 'multiply' },
    { id: 'CANVAS', label: 'Canvas / Lona', image: '/textures/canvas.jpg', mixMode: 'multiply' },
    { id: 'CHAPISCO', label: 'Chapisco Têxtil', image: '/textures/noise.jpg', mixMode: 'overlay' },
    { id: 'CORDA', label: 'Corda / Trama Larga', image: '/textures/rope.jpg', mixMode: 'multiply' }
];
