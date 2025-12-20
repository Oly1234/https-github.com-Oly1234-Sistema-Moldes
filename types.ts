
export interface TechnicalDNA {
  silhouette: string;
  neckline: string;
  sleeve: string;
  length: string;      
  fit: string;         
  fabric: string;      
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
  sourceName: string; 
  title: string; 
  itemCount: string; 
  searchUrl: string; 
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
  type: 'GRATUITO' | 'PAGO' | 'INDIE' | 'VINTAGE' | 'PREMIUM' | 'ROYALTY-FREE';
  linkType: 'DIRECT' | 'SEARCH_QUERY';
  url: string;
  imageUrl?: string;
  
  backupSearchTerm?: string; 
  description?: string;
  comparisonToPhoto?: string;
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
  recommendedResources: RecommendedResource[]; 
}

export interface ScanHistoryItem {
  id: string;
  timestamp: number;
  patternName: string;
  dnaSummary: string;
  category: string;
  thumbnailUrl?: string; 
}

export interface PantoneColor {
  name: string;
  code: string;  // TCX Code (e.g. 18-1750 TCX)
  hex: string;
  trendStatus?: string; // e.g. "COY 2023"
  role?: string;
}

// TIPO PARA CAMADAS DO STUDIO
export interface DesignLayer {
  id: string;
  type: 'BACKGROUND' | 'ELEMENT';
  name: string;
  src: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  originalPrompt?: string;
  opacity?: number; 
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export type ViewState = 'HOME' | 'SCANNER' | 'HISTORY' | 'MOCKUP' | 'CREATOR' | 'ATELIER' | 'LAYER_STUDIO' | 'RUNWAY' | 'TECHNICAL_HUB';
