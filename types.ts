

export interface TechnicalDNA {
  silhouette: string;
  neckline: string;
  sleeve: string;
  fabricStructure: string;
  designDetails: string[];
}

export interface SizingAnalysis {
  estimatedModelHeight: string;
  detectedSize: 'P' | 'M' | 'G' | 'GG' | 'Plus Size';
  reasoning: string;
  measurementsUsed: {
    bust: string;
    waist: string;
    hip: string;
    length: string;
  };
}

export interface LineArt {
  frontViewPath: string;
  backViewPath: string;
  details: string[];
}

export interface PatternPiece {
  name: string; 
  path: string; 
  quantity: number; 
  cutType: 'DOBRA' | 'PAR' | 'UNICO';
  notes?: string;
}

export interface CuratedCollection {
  sourceName: string; // ex: "Etsy Vintage", "Burda Specials"
  title: string; // ex: "Seleção de Vestidos Midi Envelope"
  itemCount: string; // ex: "120+ opções"
  searchUrl: string; // URL da busca pronta
  description: string;
  icon: 'SHOPPING' | 'VINTAGE' | 'MODERN' | 'FREE';
}

export interface RecommendedResource {
  name: string;
  type: 'PURCHASE' | 'FREE_REPO' | 'INSPIRATION';
  url: string;
  description: string;
}

export interface ExternalPatternMatch {
  source: string;
  patternName: string;
  similarityScore: number;
  type: 'GRATUITO' | 'PAGO' | 'INDIE' | 'VINTAGE';
  linkType: 'DIRECT' | 'SEARCH_QUERY';
  url: string;
  imageUrl?: string;
  
  backupSearchTerm?: string; 
  description: string;
  comparisonToPhoto: string;
}

export interface MatchGroups {
  exact: ExternalPatternMatch[];
  close: ExternalPatternMatch[];
  adventurous: ExternalPatternMatch[];
}

export interface PatternAnalysisResult {
  patternName: string;
  category: string;
  generationLogic: string;
  sizingAnalysis: SizingAnalysis;
  lineArt: LineArt;
  technicalDna: TechnicalDNA;
  fabricSuggestion: string;
  elasticity: 'Baixa' | 'Média' | 'Alta' | 'Nenhuma';
  skillLevel: 'Iniciante' | 'Intermediário' | 'Avançado';
  patternPieces: PatternPiece[];
  smartSearchTerms: string[];
  matches: MatchGroups;
  curatedCollections: CuratedCollection[];
  recommendedResources: RecommendedResource[]; // Lista rica de links profundos
}

export interface ScanHistoryItem {
  id: string;
  timestamp: number;
  patternName: string;
  dnaSummary: string;
  category: string;
  thumbnailUrl?: string; // Opcional, pois não salvaremos base64 pesado no localstorage
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export type ViewState = 'HOME' | 'HISTORY' | 'MOCKUP';
