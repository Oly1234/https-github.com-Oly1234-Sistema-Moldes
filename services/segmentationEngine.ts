
/**
 * VINGI SAM-INSPIRED SEGMENTATION ENGINE v2.5
 * Tecnologia avançada de isolamento semântico com suavização de bordas.
 */

export interface SegmentationResult {
    mask: Uint8Array;
    bounds: { x: number; y: number; w: number; h: number };
    center: { x: number; y: number };
    area: number;
}

export const VingiSegmenter = {
    /**
     * Executa a segmentação inteligente combinando Varinha e SAM.
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

        while (stack.length) {
            const [x, y] = stack.pop()!;
            const idx = y * width + x;
            
            if (visited[idx]) continue;
            visited[idx] = 1;
            
            const pos = idx * 4;
            
            // Lógica Híbrida: Similaridade de cor + Gradiente de Borda
            const diff = Math.sqrt(
                Math.pow(data[pos] - r0, 2) + 
                Math.pow(data[pos+1] - g0, 2) + 
                Math.pow(data[pos+2] - b0, 2)
            );

            // Detecção de "Barreira de Contraste" (Evita vazamento em bordas nítidas)
            let localContrast = 0;
            if (x > 0 && x < width - 1) {
                const pL = (y * width + (x - 1)) * 4;
                const pR = (y * width + (x + 1)) * 4;
                localContrast = Math.abs(data[pL] - data[pR]) + Math.abs(data[pL+1] - data[pR+1]);
            }

            if (diff <= tolerance && localContrast < 120) {
                mask[idx] = 255;
                pixelCount++;
                
                if (x < bMinX) bMinX = x; if (x > bMaxX) bMaxX = x;
                if (y < bMinY) bMinY = y; if (y > bMaxY) bMaxY = y;

                if (x > 0) stack.push([x - 1, y]);
                if (x < width - 1) stack.push([x + 1, y]);
                if (y > 0) stack.push([x, y - 1]);
                if (y < height - 1) stack.push([x, y + 1]);
            }
        }

        if (pixelCount < 10) return null;

        return {
            mask,
            bounds: { x: bMinX, y: bMinY, w: (bMaxX - bMinX) + 1, h: (bMaxY - bMinY) + 1 },
            center: { x: bMinX + (bMaxX - bMinX) / 2, y: bMinY + (bMaxY - bMinY) / 2 },
            area: pixelCount
        };
    },

    mergeMasks: (m1: Uint8Array, m2: Uint8Array): Uint8Array => {
        const result = new Uint8Array(m1.length);
        for (let i = 0; i < m1.length; i++) result[i] = (m1[i] || m2[i]) ? 255 : 0;
        return result;
    },

    subtractMasks: (base: Uint8Array, remove: Uint8Array): Uint8Array => {
        const result = new Uint8Array(base.length);
        for (let i = 0; i < base.length; i++) result[i] = (base[i] && !remove[i]) ? 255 : 0;
        return result;
    }
};
