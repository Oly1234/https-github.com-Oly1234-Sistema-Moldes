
/**
 * VINGI RUNWAY ENGINE v4.2 (SMART EDGE)
 * Motor especializado com Morfologia Matemática e Tratamento de Bordas Inteligente.
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
     * EXPANDIR MÁSCARA INTELIGENTE (SMART DILATE)
     * Expande a seleção pixel a pixel, mas PARA se encontrar uma cor muito diferente.
     * Isso permite preencher "cantinhos" da roupa sem invadir o fundo ou a pele.
     */
    expandMask: (mask: Uint8Array, width: number, height: number, imgData?: Uint8ClampedArray, tolerance: number = 30): Uint8Array => {
        const newMask = new Uint8Array(mask); // Começa com a cópia do estado atual
        
        // Percorre a máscara procurando pixels já selecionados (255)
        for (let i = 0; i < mask.length; i++) {
            if (mask[i] === 255) {
                // Tenta expandir para os 4 vizinhos
                const x = i % width;
                
                const tryExpand = (targetIdx: number) => {
                    // Se já estiver selecionado, ignora
                    if (newMask[targetIdx] === 255) return; 
                    
                    if (imgData) {
                        // SMART CHECK: Compara a cor do pixel original (i) com o vizinho (targetIdx)
                        const r1 = imgData[targetIdx*4];
                        const g1 = imgData[targetIdx*4+1];
                        const b1 = imgData[targetIdx*4+2];
                        
                        const r2 = imgData[i*4];
                        const g2 = imgData[i*4+1];
                        const b2 = imgData[i*4+2];
                        
                        // Distância de cor (Manhattan simples para performance)
                        const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
                        
                        // Se a diferença for pequena (cores parecidas), permite a expansão.
                        // Se for grande (ex: roupa branca p/ fundo preto), bloqueia.
                        if (diff <= tolerance * 3) {
                            newMask[targetIdx] = 255;
                        }
                    } else {
                        // MODO ESTRUTURAL (Sem imagem): Expande cegamente (para fechar buracos internos)
                        newMask[targetIdx] = 255;
                    }
                };

                // Checa vizinhos (Cima, Baixo, Esq, Dir)
                if (x > 0) tryExpand(i - 1);
                if (x < width - 1) tryExpand(i + 1);
                if (i >= width) tryExpand(i - width);
                if (i < mask.length - width) tryExpand(i + width);
            }
        }
        return newMask;
    },

    /**
     * CONTRAIR MÁSCARA (ERODE)
     * Remove bordas para limpar halos.
     */
    contractMask: (mask: Uint8Array, width: number, height: number): Uint8Array => {
        const newMask = new Uint8Array(mask.length);
        for (let i = 0; i < mask.length; i++) {
            if (mask[i] === 255) {
                const x = i % width;
                const l = (x > 0) ? mask[i - 1] : 0;
                const r = (x < width - 1) ? mask[i + 1] : 0;
                const t = (i >= width) ? mask[i - width] : 0;
                const b = (i < mask.length - width) ? mask[i + width] : 0;
                
                // Só mantém se estiver cercado de pixels brancos (centro seguro)
                if (l && r && t && b) {
                    newMask[i] = 255;
                } else {
                    newMask[i] = 0; // Come as bordas
                }
            }
        }
        return newMask;
    },

    /**
     * Refinamento Automático (Closing)
     * Usado pela Varinha Mágica para fechar buracos internos automaticamente.
     * Aqui usamos expansão cega (sem imgData) pois queremos fechar buracos independente da cor interna.
     */
    refineMask: (mask: Uint8Array, width: number, height: number, iterations: number = 2): Uint8Array => {
        let current = new Uint8Array(mask);
        // Dilata X vezes (Cego) -> Erode X vezes
        for(let k=0; k<iterations; k++) current = RunwayEngine.expandMask(current, width, height);
        for(let k=0; k<iterations; k++) current = RunwayEngine.contractMask(current, width, height);
        return current;
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
        
        if (startX < 0 || startX >= width || startY < 0 || startY >= height) return resultMask;

        const startPos = (startY * width + startX) * 4;
        const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];
        const getLuma = (r: number, g: number, b: number) => 0.299*r + 0.587*g + 0.114*b;
        const luma0 = getLuma(r0, g0, b0);
        
        const stack: [number, number][] = [[startX, startY]];
        const lumaTolerance = params.tolerance * 1.8; 
        const chromaTolerance = params.tolerance * 0.7; 

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

        if (params.mode === 'ADD') {
            return RunwayEngine.refineMask(resultMask, width, height, 2); 
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
