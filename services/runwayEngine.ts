
/**
 * VINGI RUNWAY ENGINE v4.0 (AUTO-HEAL)
 * Motor especializado com Morfologia Matemática para fechar buracos em estampas.
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
     * OPERAÇÕES MORFOLÓGICAS (A Mágica da Limpeza)
     * Dilatar: Expande a seleção (fecha buracos).
     * Erodir: Contrai a seleção (restaura borda).
     * Closing: Dilatar -> Erodir (Remove buracos pretos dentro do branco).
     */
    refineMask: (mask: Uint8Array, width: number, height: number, iterations: number = 2): Uint8Array => {
        let current = new Uint8Array(mask);
        const buffer = new Uint8Array(mask.length);

        // Função Helper: Dilatar (Expandir o branco)
        const dilate = (src: Uint8Array, dst: Uint8Array) => {
            for (let i = 0; i < src.length; i++) {
                if (src[i] === 255) {
                    dst[i] = 255;
                    // Vizinhos (Cima, Baixo, Esquerda, Direita)
                    const x = i % width;
                    if (x > 0) dst[i - 1] = 255;
                    if (x < width - 1) dst[i + 1] = 255;
                    if (i >= width) dst[i - width] = 255;
                    if (i < src.length - width) dst[i + width] = 255;
                }
            }
        };

        // Função Helper: Erodir (Comer o branco pelas bordas)
        const erode = (src: Uint8Array, dst: Uint8Array) => {
            for (let i = 0; i < src.length; i++) {
                // Só mantém branco se o centro for branco E todos os vizinhos forem brancos
                if (src[i] === 255) {
                    const x = i % width;
                    const l = (x > 0) ? src[i - 1] : 0;
                    const r = (x < width - 1) ? src[i + 1] : 0;
                    const t = (i >= width) ? src[i - width] : 0;
                    const b = (i < src.length - width) ? src[i + width] : 0;
                    
                    if (l && r && t && b) {
                        dst[i] = 255;
                    } else {
                        dst[i] = 0;
                    }
                } else {
                    dst[i] = 0;
                }
            }
        };

        // APLICAÇÃO: CLOSING (Fecha buracos pequenos/médios da estampa)
        // 1. Dilata X vezes
        for(let k=0; k<iterations; k++) {
            buffer.fill(0);
            dilate(current, buffer);
            current.set(buffer);
        }
        // 2. Erode X vezes (Volta ao tamanho original, mas com buracos preenchidos)
        for(let k=0; k<iterations; k++) {
            buffer.fill(0);
            erode(current, buffer);
            current.set(buffer);
        }

        return current;
    },

    /**
     * Varinha Mágica Otimizada com Auto-Heal
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
        const getLuma = (r: number, g: number, b: number) => 0.299*r + 0.587*g + 0.114*b;
        const luma0 = getLuma(r0, g0, b0);
        
        const stack: [number, number][] = [[startX, startY]];
        
        // Tolerância Dinâmica
        const lumaTolerance = params.tolerance * 1.8; 
        const chromaTolerance = params.tolerance * 0.7; 

        // Passo 1: Seleção Bruta (Flood Fill)
        if (params.contiguous) {
            while (stack.length) {
                const [cx, cy] = stack.pop()!;
                const idx = cy * width + cx;
                if (visited[idx]) continue;
                visited[idx] = 1;

                const pos = idx * 4;
                const r = data[pos], g = data[pos+1], b = data[pos+2];
                const lumaDiff = Math.abs(getLuma(r, g, b) - luma0);
                const chromaDiff = (Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0)) / 3;

                if (lumaDiff <= lumaTolerance && chromaDiff <= chromaTolerance) {
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
                const r = data[pos], g = data[pos+1], b = data[pos+2];
                const lumaDiff = Math.abs(getLuma(r, g, b) - luma0);
                const chromaDiff = (Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0)) / 3;
                if (lumaDiff <= lumaTolerance && chromaDiff <= chromaTolerance) {
                    resultMask[i] = params.mode === 'ADD' ? 255 : 0;
                }
            }
        }

        // Passo 2: Auto-Heal (Morfologia) se estiver adicionando
        // Isso fecha os "pixels sujos" dentro da estampa automaticamente
        if (params.mode === 'ADD') {
            return RunwayEngine.refineMask(resultMask, width, height, 2); // 2 iterações fecha buracos pequenos/médios
        }

        return resultMask;
    },

    paintMask: (
        mask: Uint8Array,
        ctx: CanvasRenderingContext2D | null, 
        width: number, height: number, 
        x: number, y: number, 
        params: { size: number, hardness: number, opacity: number, mode: 'ADD' | 'SUB', smart?: boolean, startColor?: {r:number, g:number, b:number} | null }
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

        let imgData: Uint8ClampedArray | null = null;
        let rRef = 0, gRef = 0, bRef = 0;
        
        if (params.smart && ctx) {
            if (params.startColor) {
                rRef = params.startColor.r; gRef = params.startColor.g; bRef = params.startColor.b;
            } else {
                const p = ctx.getImageData(centerX, centerY, 1, 1).data;
                rRef = p[0]; gRef = p[1]; bRef = p[2];
            }
            imgData = ctx.getImageData(0, 0, width, height).data; 
        }

        const hardnessK = params.hardness / 100;
        const smartTolerance = 50; 

        for (let ny = startY; ny <= endY; ny++) {
            for (let nx = startX; nx <= endX; nx++) {
                const dx = nx - centerX;
                const dy = ny - centerY;
                const distSq = dx * dx + dy * dy;

                if (distSq <= radiusSq) {
                    const idx = ny * width + nx;
                    let affinity = 1;
                    
                    if (params.smart && imgData) {
                        const pos = idx * 4;
                        const diff = Math.sqrt(Math.pow(imgData[pos] - rRef, 2) + Math.pow(imgData[pos+1] - gRef, 2) + Math.pow(imgData[pos+2] - bRef, 2));
                        if (diff > smartTolerance) affinity = Math.max(0, 1 - (diff - smartTolerance) / 20);
                    }

                    if (affinity <= 0.1) continue;

                    const dist = Math.sqrt(distSq);
                    const innerRadius = radius * hardnessK;
                    let force = dist > innerRadius ? 1 - (dist - innerRadius) / (radius - innerRadius) : 1;
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
