
/**
 * VINGI SAM-X MODULAR ENGINE v5.2
 * Motor de segmentação técnica especializado em motivos têxteis.
 * Este arquivo é consumido exclusivamente pelo LayerStudio.
 */

export interface SegmentationResult {
    mask: Uint8Array;
    bounds: { x: number; y: number; w: number; h: number };
    center: { x: number; y: number };
    area: number;
}

export const VingiSegmenter = {
    /**
     * Segmentação de Precisão (Gera a Máscara VERDE)
     * Utiliza flood-fill com tolerância RGB para isolar o elemento clicado.
     */
    segmentObject: (
        ctx: CanvasRenderingContext2D, 
        width: number, 
        height: number, 
        startX: number, 
        startY: number, 
        tolerance: number
    ): SegmentationResult | null => {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const mask = new Uint8Array(width * height);
        const visited = new Uint8Array(width * height);
        const stack: [number, number][] = [[Math.floor(startX), Math.floor(startY)]];
        
        const startIdx = (Math.floor(startY) * width + Math.floor(startX)) * 4;
        if (startIdx < 0 || startIdx >= data.length) return null;
        
        const r0 = data[startIdx], g0 = data[startIdx+1], b0 = data[startIdx+2];

        let bMinX = width, bMaxX = 0, bMinY = height, bMaxY = 0;
        let pixelCount = 0;
        let sumX = 0, sumY = 0;

        while (stack.length) {
            const [x, y] = stack.pop()!;
            const idx = y * width + x;
            if (visited[idx]) continue;
            visited[idx] = 1;
            const pos = idx * 4;
            
            const colorDiff = Math.sqrt(
                Math.pow(data[pos] - r0, 2) + 
                Math.pow(data[pos+1] - g0, 2) + 
                Math.pow(data[pos+2] - b0, 2)
            );

            if (colorDiff <= tolerance) {
                mask[idx] = 255;
                pixelCount++;
                sumX += x; sumY += y;
                if (x < bMinX) bMinX = x; if (x > bMaxX) bMaxX = x;
                if (y < bMinY) bMinY = y; if (y > bMaxY) bMaxY = y;

                if (x > 0) stack.push([x - 1, y]);
                if (x < width - 1) stack.push([x + 1, y]);
                if (y > 0) stack.push([x, y - 1]);
                if (y < height - 1) stack.push([x, y + 1]);
            }
        }

        if (pixelCount < 30) return null;

        return {
            mask,
            bounds: { x: bMinX, y: bMinY, w: (bMaxX - bMinX) + 1, h: (bMaxY - bMinY) + 1 },
            center: { x: sumX / pixelCount, y: sumY / pixelCount },
            area: pixelCount
        };
    },

    /**
     * Motor de Sugestão Inteligente (Gera a Máscara VERMELHA)
     * Analisa a assinatura cromática do objeto ativo e busca padrões similares na imagem.
     */
    findSimilarAreas: (
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        activeMask: Uint8Array,
        tolerance: number
    ): Uint8Array | null => {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const suggestionMask = new Uint8Array(width * height);
        
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (let i = 0; i < activeMask.length; i++) {
            if (activeMask[i] === 255) {
                const pos = i * 4;
                rSum += data[pos]; gSum += data[pos+1]; bSum += data[pos+2];
                count++;
            }
        }
        if (count === 0) return null;
        const rAvg = rSum / count, gAvg = gSum / count, bAvg = bSum / count;

        // Varredura otimizada para performance fluida
        for (let i = 0; i < data.length; i += 48) { 
            const idx = i / 4;
            if (activeMask[idx] === 255) continue;

            const colorDiff = Math.sqrt(
                Math.pow(data[i] - rAvg, 2) + 
                Math.pow(data[i+1] - gAvg, 2) + 
                Math.pow(data[i+2] - bAvg, 2)
            );

            if (colorDiff <= tolerance * 1.2) {
                suggestionMask[idx] = 255;
            }
        }
        return suggestionMask;
    },

    mergeMasks: (m1: Uint8Array, m2: Uint8Array): Uint8Array => {
        const result = new Uint8Array(m1.length);
        for (let i = 0; i < m1.length; i++) {
            result[i] = (m1[i] === 255 || m2[i] === 255) ? 255 : 0;
        }
        return result;
    }
};
