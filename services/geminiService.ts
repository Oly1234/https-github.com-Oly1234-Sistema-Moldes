
import { PatternAnalysisResult } from "../types";

export const analyzeClothingImage = async (
  mainImageBase64: string, 
  mainMimeType: string,
  secondaryImageBase64?: string | null,
  secondaryMimeType?: string | null
): Promise<PatternAnalysisResult> => {
  
  try {
    // Agora chamamos nosso Backend Seguro hospedado na Vercel
    // A chave API fica escondida lá, o usuário não precisa digitar nada.
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mainImageBase64,
        mainMimeType,
        secondaryImageBase64,
        secondaryMimeType
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const result = await response.json();
    return result as PatternAnalysisResult;

  } catch (error: any) {
    console.error("Error analyzing image:", error);

    if (error.message?.includes('500')) {
        throw new Error("Erro no Servidor de IA. Verifique se a chave API está configurada no Vercel.");
    }
    
    throw error;
  }
};
