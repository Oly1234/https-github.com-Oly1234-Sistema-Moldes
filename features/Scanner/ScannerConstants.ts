
import { ScanLine, Scissors, Shirt, Ruler, Move, Layers, Info } from 'lucide-react';

export const SCANNER_MESSAGES = {
    STARTING: "Iniciando Varredura Tática...",
    EXTRACTING_DNA: "Extraindo DNA do Molde...",
    ERROR_GENERAL: "Erro ao analisar molde. Tente uma foto mais nítida.",
    SUCCESS_REVERSE: "Engenharia Reversa Concluída."
};

export const SPEC_DEFINITIONS = [
    { label: "Silhueta", key: "silhouette", icon: Scissors },
    { label: "Decote", key: "neckline", icon: Shirt },
    { label: "Ajuste", key: "fit", icon: Move },
    { label: "Tecido", key: "fabric", icon: Layers },
];
