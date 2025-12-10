
import { PatternAnalysisResult } from "../types";

export const analyzeClothingImage = async (
  mainImageBase64: string, 
  mainMimeType: string,
  secondaryImageBase64?: string | null,
  secondaryMimeType?: string | null,
  excludePatterns: string[] = [] // Novo parâmetro opcional
): Promise<PatternAnalysisResult> => {
  
  // Timeout Controller Aumentado para suportar listas maiores (30+ itens)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 segundos de limite

  try {
    // Chamada ao Backend Seguro (Vercel Function)
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mainImageBase64,
        mainMimeType,
        secondaryImageBase64,
        secondaryMimeType,
        excludePatterns // Envia lista para o backend
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `Erro no Servidor: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) errorMessage = errorData.error;
      } catch (e) {
        // Se não for JSON, usa o texto padrão
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result as PatternAnalysisResult;

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("Error analyzing image:", error);

    if (error.name === 'AbortError') {
        throw new Error("O servidor demorou muito para responder. Tente uma imagem menor ou verifique sua conexão.");
    }

    if (error.message?.includes('500')) {
        throw new Error("Erro Interno (500). Verifique a CHAVE API no Painel da Vercel.");
    }
    
    throw error;
  }
};
