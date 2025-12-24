
/**
 * VINGI RUNWAY ENGINE v2.0
 * Motor de segmentação exclusivo para o Provador Mágico.
 * Inclui: Magic Wand, Smart Brush e Histórico.
 */

export interface RunwayMaskSnapshot {
    data: Uint8Array;
    timestamp: number;
}

export const RunwayEngine = {
    pushHistory: (stack: RunwayMaskSnapshot[], currentMask: Uint8Array): RunwayMaskSnapshot[] => {
        return [...stack, { data: new Uint8Array(currentMask), timestamp: Date.now() }].slice(-20);
    },

    /**
     * Varinha Mágica Otimizada
     */
    magicWand: (
        ctx: CanvasRenderingContext2D, 
        width: number, height: number, 
        x: number, y: number, 
        params: { tolerance: number, contiguous: boolean, mode: 'ADD' | 'SUB', existingMask?: Uint8Array }
    ) => {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const resultMask = params.existingMask ? new Uint8Array(params.existingMask) : new Uint8Array(width * height);
        const visited = new Uint8Array(width * height);
        
        const startX = Math.floor(x);
        const startY = Math.floor(y);
        const startPos = (startY * width + startX) * 4;
        
        if (startX < 0 || startX >= width || startY < 0 || startY >= height) return resultMask;

        const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];
        const stack: [number, number][] = [[startX, startY]];
        
        const effectiveTolerance = params.tolerance;

        if (params.contiguous) {
            while (stack.length) {
                const [cx, cy] = stack.pop()!;
                const idx = cy * width + cx;
                if (visited[idx]) continue;
                visited[idx] = 1;

                const pos = idx * 4;
                const diff = Math.abs(data[pos] - r0) + Math.abs(data[pos+1] - g0) + Math.abs(data[pos+2] - b0);

                if (diff <= effectiveTolerance * 3) {
                    resultMask[idx] = params.mode === 'ADD' ? 255 : 0;

                    if (cx > 0) stack.push([cx-1, cy]);
                    if (cx < width - 1) stack.push([cx+1, cy]);
                    if (cy > 0) stack.push([cx, cy-1]);
                    if (cy < height - 1) stack.push([cx, cy+1]);
                }
            }
        } else {
            for (let i = 0; i < width * height; i++) {
                const pos = i * 4;
                const diff = Math.abs(data[pos] - r0) + Math.abs(data[pos+1] - g0) + Math.abs(data[pos+2] - b0);
                if (diff <= effectiveTolerance * 3) {
                    resultMask[i] = params.mode === 'ADD' ? 255 : 0;
                }
            }
        }
        return resultMask;
    },

    /**
     * Pincel Inteligente (Smart Brush) - Respeita bordas
     */
    paintMask: (
        mask: Uint8Array,
        ctx: CanvasRenderingContext2D | null, // Contexto para ler cores (Smart Mode)
        width: number, height: number, 
        x: number, y: number, 
        params: { size: number, hardness: number, opacity: number, mode: 'ADD' | 'SUB', smart?: boolean }
    ) => {
        const radius = params.size / 2;
        const radiusSq = radius * radius;
        const newMask = new Uint8Array(mask);
        
        const centerX = Math.floor(x);
        const centerY = Math.floor(y);

        const startY = Math.max(0, Math.floor(centerY - radius));
        const endY = Math.min(height - 1, Math.ceil(centerY + radius));
        const startX = Math.max(0, Math.floor(centerX - radius));
        const endX = Math.min(width - 1, Math.ceil(centerX + radius));

        // Dados para Smart Mode
        let imgData: Uint8ClampedArray | null = null;
        let r0 = 0, g0 = 0, b0 = 0;
        let smartTolerance = 40;

        if (params.smart && ctx) {
            // Amostra a cor central para referência
            const p = ctx.getImageData(centerX, centerY, 1, 1).data;
            r0 = p[0]; g0 = p[1]; b0 = p[2];
            // Pega a área inteira para performance (ou apenas o bounding box do pincel)
            imgData = ctx.getImageData(0, 0, width, height).data;
        }

        const hardnessK = params.hardness / 100;

        for (let ny = startY; ny <= endY; ny++) {
            for (let nx = startX; nx <= endX; nx++) {
                const dx = nx - centerX;
                const dy = ny - centerY;
                const distSq = dx * dx + dy * dy;

                if (distSq <= radiusSq) {
                    const idx = ny * width + nx;
                    
                    // Cálculo Smart (Proteção de Borda)
                    let affinity = 1;
                    if (params.smart && imgData) {
                        const pos = idx * 4;
                        const diff = Math.abs(imgData[pos] - r0) + Math.abs(imgData[pos+1] - g0) + Math.abs(imgData[pos+2] - b0);
                        // Se a diferença for muito grande, reduz drasticamente a afinidade
                        if (diff > smartTolerance * 3) affinity = 0;
                        else if (diff > smartTolerance) affinity = 1 - ((diff - smartTolerance) / (smartTolerance * 2));
                    }

                    if (affinity <= 0.1) continue;

                    const dist = Math.sqrt(distSq);
                    const innerRadius = radius * hardnessK;
                    let force = dist > innerRadius 
                        ? 1 - (dist - innerRadius) / (radius - innerRadius) 
                        : 1;
                    
                    const value = force * 255 * affinity; 

                    if (params.mode === 'ADD') {
                        newMask[idx] = Math.max(newMask[idx], value); 
                    } else {
                        newMask[idx] = Math.min(newMask[idx], 255 - value);
                    }
                }
            }
        }
        return newMask;
    }
};
