
/**
 * VINGI SAM-X MODULAR ENGINE v3.2
 * Motor de segmentação por campo de energia com suporte a fusão de máscaras.
 */

export interface SegmentationResult {
    mask: Uint8Array;
    bounds: { x: number; y: number; w: number; h: number };
    center: { x: number; y: number };
    area: number;
    confidence: number;
}

export const VingiSegmenter = {
    /**
     * Algoritmo de Difusão SAM-X
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
        const luminance = (r0 * 0.299 + g0 * 0.587 + b0 * 0.114) / 255;
        const dynamicTolerance = tolerance * (luminance < 0.3 ? 1.4 : 1.0);

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

            let edgeEnergy = 0;
            if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                const idxR = (y * width + (x + 1)) * 4;
                const idxL = (y * width + (x - 1)) * 4;
                const idxB = ((y + 1) * width + x) * 4;
                const idxT = ((y - 1) * width + x) * 4;
                edgeEnergy = Math.max(
                    Math.abs(data[idxR] - data[idxL]),
                    Math.abs(data[idxB] - data[idxT])
                );
            }

            if (colorDiff <= dynamicTolerance && edgeEnergy < 120) {
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

        if (pixelCount < 50) return null;

        return {
            mask,
            bounds: { x: bMinX, y: bMinY, w: (bMaxX - bMinX) + 1, h: (bMaxY - bMinY) + 1 },
            center: { x: sumX / pixelCount, y: sumY / pixelCount },
            area: pixelCount,
            confidence: Math.min(1, pixelCount / 1000)
        };
    },

    /**
     * Funde duas máscaras em uma única camada de bits.
     */
    mergeMasks: (m1: Uint8Array, m2: Uint8Array): Uint8Array => {
        const result = new Uint8Array(m1.length);
        for (let i = 0; i < m1.length; i++) {
            result[i] = (m1[i] === 255 || m2[i] === 255) ? 255 : 0;
        }
        return result;
    }
};
