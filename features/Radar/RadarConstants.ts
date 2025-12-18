
import { Globe, Search, Database, Image as ImageIcon } from 'lucide-react';

export const RADAR_SOURCES = [
    { name: "Patternbank", icon: Search },
    { name: "Spoonflower", icon: Database },
    { name: "Adobe Stock", icon: ImageIcon },
    { name: "Shutterstock", icon: Globe },
];

export const RADAR_MESSAGES = {
    SCANNING: "Varrendo Bancos Globais...",
    EXTRACTING: "Mapeando Texturas...",
    NO_RESULTS: "Nenhum padrão exato encontrado.",
    NEW_SEARCH: "Nova Pesquisa"
};
