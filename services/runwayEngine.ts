
/**
 * VINGI RUNWAY ENGINE v1.0
 * Motor de segmentação exclusivo para o Provador Mágico.
 * Foco: Detecção de silhuetas de vestuário e máscaras de alta precisão.
 * ISOLADO DO LAYER STUDIO PARA SEGURANÇA.
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
     * Varinha Mágica (Magic Wand) - Otimizada para Tecidos Brancos
     */
    magicWand: (
        ctx: CanvasRenderingContext2D, 
        width: number, height: number, 
        x: number, y: number, 
        params: { tolerance: number, contiguous: boolean, mode: 'ADD' | 'SUB', existingMask?: Uint8Array }
    ) => {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        // Se já existe máscara, clonamos. Se não, cria nova zerada.
        const resultMask = params.existingMask ? new Uint8Array(params.existingMask) : new Uint8Array(width * height);
        const visited = new Uint8Array(width * height);
        
        const startX = Math.floor(x);
        const startY = Math.floor(y);
        const startPos = (startY * width + startX) * 4;
        
        if (startX < 0 || startX >= width || startY < 0 || startY >= height) return resultMask;

        const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];
        const stack: [number, number][] = [[startX, startY]];
        
        // Ajuste de tolerância para brancos (que tem pouco contraste)
        const effectiveTolerance = params.tolerance;

        if (params.contiguous) {
            while (stack.length) {
                const [cx, cy] = stack.pop()!;
                const idx = cy * width + cx;
                if (visited[idx]) continue;
                visited[idx] = 1;

                const pos = idx * 4;
                // Diferença Euclidiana simples para performance
                const diff = Math.abs(data[pos] - r0) + Math.abs(data[pos+1] - g0) + Math.abs(data[pos+2] - b0);

                if (diff <= effectiveTolerance * 3) { // 3 canais (R+G+B)
                    resultMask[idx] = params.mode === 'ADD' ? 255 : 0;

                    if (cx > 0) stack.push([cx-1, cy]);
                    if (cx < width - 1) stack.push([cx+1, cy]);
                    if (cy > 0) stack.push([cx, cy-1]);
                    if (cy < height - 1) stack.push([cx, cy+1]);
                }
            }
        } else {
            // Busca Global (Não contígua)
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
     * Pincel / Borracha (Brush/Eraser)
     */
    paintMask: (
        mask: Uint8Array, 
        width: number, height: number, 
        x: number, y: number, 
        params: { size: number, hardness: number, opacity: number, mode: 'ADD' | 'SUB' }
    ) => {
        const radius = params.size / 2;
        const radiusSq = radius * radius;
        const newMask = new Uint8Array(mask); // Clona para imutabilidade
        
        const centerX = Math.floor(x);
        const centerY = Math.floor(y);

        const startY = Math.max(0, Math.floor(centerY - radius));
        const endY = Math.min(height - 1, Math.ceil(centerY + radius));
        const startX = Math.max(0, Math.floor(centerX - radius));
        const endX = Math.min(width - 1, Math.ceil(centerX + radius));

        // Hardness afeta o gradiente da borda
        const hardnessK = params.hardness / 100;

        for (let ny = startY; ny <= endY; ny++) {
            for (let nx = startX; nx <= endX; nx++) {
                const dx = nx - centerX;
                const dy = ny - centerY;
                const distSq = dx * dx + dy * dy;

                if (distSq <= radiusSq) {
                    const idx = ny * width + nx;
                    const dist = Math.sqrt(distSq);
                    
                    // Cálculo de suavidade (feathering)
                    const innerRadius = radius * hardnessK;
                    let force = dist > innerRadius 
                        ? 1 - (dist - innerRadius) / (radius - innerRadius) 
                        : 1;
                    
                    // Aplica opacidade (se necessário) - Aqui assumimos binário ou 255 para máscara forte
                    const value = force * 255; 

                    if (params.mode === 'ADD') {
                        // Max garante que não diminuímos a opacidade se já estiver pintado
                        newMask[idx] = Math.max(newMask[idx], value); 
                    } else {
                        // Borracha
                        newMask[idx] = Math.min(newMask[idx], 255 - value);
                    }
                }
            }
        }
        return newMask;
    }
};
