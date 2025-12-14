
import { PatternAnalysisResult } from "../types";

export const analyzeClothingImage = async (
  mainImageBase64: string, 
  mainMimeType: string,
  secondaryImageBase64?: string | null,
  secondaryMimeType?: string | null,
  excludePatterns: string[] = []
): Promise<PatternAnalysisResult> => {
  
  // Timeout de 3 minutos para garantir busca real em sites lentos
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); 

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SCAN_CLOTHING', 
        mainImageBase64,
        mainMimeType,
        secondaryImageBase64,
        secondaryMimeType,
        excludePatterns
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        throw new Error(`Servidor Indisponível (${response.status})`);
    }

    const result = await response.json();
    
    if (result.error) {
         throw new Error(result.error);
    }

    // Validação estrita: Se não tiver nome ou matches, é erro. Nada de simulação.
    if (!result.patternName) {
        throw new Error("Não foi possível identificar o padrão na imagem.");
    }

    return result as PatternAnalysisResult;

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
        throw new Error("A busca real demorou muito. Tente uma imagem menor.");
    }
    // Repassa o erro real para a UI lidar (Botão Tentar Novamente)
    throw error;
  }
};
