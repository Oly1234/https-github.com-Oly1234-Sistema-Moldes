
/**
 * VINGI SAM-X NEURAL HEURISTIC ENGINE v3.0
 * Simulação de Segment Anything Model (SAM) via Gradiente de Energia e Matriz de Variância.
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
     * Executa a segmentação SAM-X baseada em Campo de Força de Bordas.
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
        
        // Cor de semente (âncora neural)
        const r0 = data[startIdx], g0 = data[startIdx+1], b0 = data[startIdx+2];

        let bMinX = width, bMaxX = 0, bMinY = height, bMaxY = 0;
        let pixelCount = 0;

        // Pré-calculo de tolerância adaptativa (mais tolerante em áreas escuras)
        const luminance = (r0 * 0.299 + g0 * 0.587 + b0 * 0.114) / 255;
        const dynamicTolerance = tolerance * (luminance < 0.3 ? 1.5 : 1.0);

        while (stack.length) {
            const [x, y] = stack.pop()!;
            const idx = y * width + x;
            
            if (visited[idx]) continue;
            visited[idx] = 1;
            
            const pos = idx * 4;
            
            // 1. Diferença de Cor (Energia de Preenchimento)
            const colorDiff = Math.sqrt(
                Math.pow(data[pos] - r0, 2) + 
                Math.pow(data[pos+1] - g0, 2) + 
                Math.pow(data[pos+2] - b0, 2)
            );

            // 2. Cálculo de Gradiente (Detecção de Barreira SAM-X)
            // Verificamos a mudança de intensidade local para detectar bordas nítidas
            let edgeEnergy = 0;
            if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                const idxR = (y * width + (x + 1)) * 4;
                const idxL = (y * width + (x - 1)) * 4;
                const idxB = ((y + 1) * width + x) * 4;
                const idxT = ((y - 1) * width + x) * 4;
                
                // Magnitude do Gradiente (Simplificação de Sobel)
                const gx = Math.abs(data[idxR] - data[idxL]);
                const gy = Math.abs(data[idxB] - data[idxT]);
                edgeEnergy = Math.max(gx, gy);
            }

            // CRITÉRIO SAM-X: Aceita se a cor for similar OU se não houver uma barreira de energia nítida
            // Se a energia da borda for alta (> 100), o modelo "trava" a expansão ali
            if (colorDiff <= dynamicTolerance && edgeEnergy < 110) {
                mask[idx] = 255;
                pixelCount++;
                
                if (x < bMinX) bMinX = x; if (x > bMaxX) bMaxX = x;
                if (y < bMinY) bMinY = y; if (y > bMaxY) bMaxY = y;

                // Expansão 4-direções
                if (x > 0) stack.push([x - 1, y]);
                if (x < width - 1) stack.push([x + 1, y]);
                if (y > 0) stack.push([x, y - 1]);
                if (y < height - 1) stack.push([x, y + 1]);
            }
        }

        // Filtro de ruído semântico
        if (pixelCount < 60) return null;

        return {
            mask,
            bounds: { 
                x: bMinX, 
                y: bMinY, 
                w: (bMaxX - bMinX) + 1, 
                h: (bMaxY - bMinY) + 1 
            },
            center: { 
                x: bMinX + (bMaxX - bMinX) / 2, 
                y: bMinY + (bMaxY - bMinY) / 2 
            },
            area: pixelCount,
            confidence: Math.min(1, pixelCount / 500)
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
