
/**
 * VINGI LAYER ENGINE PRO v9.7
 * Foco: Neural Lasso & Polygon Intelligence.
 */

export interface MaskSnapshot {
    data: Uint8Array;
    timestamp: number;
}

export const LayerEnginePro = {
    pushHistory: (stack: MaskSnapshot[], currentMask: Uint8Array): MaskSnapshot[] => {
        return [...stack, { data: new Uint8Array(currentMask), timestamp: Date.now() }].slice(-30);
    },

    /**
     * Varinha Mágica Pro
     */
    magicWandPro: (
        ctx: CanvasRenderingContext2D, 
        width: number, height: number, 
        x: number, y: number, 
        params: { tolerance: number, contiguous: boolean, mode: 'ADD' | 'SUB', existingMask?: Uint8Array }
    ) => {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const confirmed = params.existingMask ? new Uint8Array(params.existingMask) : new Uint8Array(width * height);
        const suggested = new Uint8Array(width * height);
        const visited = new Uint8Array(width * height);
        
        const startX = Math.floor(x);
        const startY = Math.floor(y);
        const startPos = (startY * width + startX) * 4;
        
        if (startX < 0 || startX >= width || startY < 0 || startY >= height) return { confirmed, suggested };

        const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];
        const stack: [number, number][] = [[startX, startY]];
        
        if (params.contiguous) {
            while (stack.length) {
                const [cx, cy] = stack.pop()!;
                const idx = cy * width + cx;
                if (visited[idx]) continue;
                visited[idx] = 1;

                const pos = idx * 4;
                const diff = Math.abs(data[pos] - r0) + Math.abs(data[pos+1] - g0) + Math.abs(data[pos+2] - b0);

                if (diff <= params.tolerance * 2.8) {
                    if (diff <= params.tolerance) {
                        confirmed[idx] = params.mode === 'ADD' ? 255 : 0;
                    } else {
                        suggested[idx] = 255;
                    }
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
                if (diff <= params.tolerance) confirmed[i] = params.mode === 'ADD' ? 255 : 0;
                else if (diff <= params.tolerance * 2.8) suggested[i] = 255;
            }
        }
        return { confirmed, suggested };
    },

    /**
     * Pincel / Borracha Inteligente
     */
    paintSmartMask: (
        mask: Uint8Array, 
        imgData: Uint8ClampedArray,
        width: number, height: number, 
        x: number, y: number, 
        params: { size: number, hardness: number, opacity: number, mode: 'ADD' | 'SUB', smartEnabled: boolean }
    ) => {
        const radius = params.size / 2;
        const radiusSq = radius * radius;
        const opacityByte = (params.opacity / 100) * 255;
        const newMask = new Uint8Array(mask);
        const centerX = Math.floor(x);
        const centerY = Math.floor(y);
        const centerPos = (centerY * width + centerX) * 4;
        
        if (centerPos < 0 || centerPos >= imgData.length) return newMask;

        const r0 = imgData[centerPos], g0 = imgData[centerPos+1], b0 = imgData[centerPos+2];
        const smartTolerance = (100 - params.hardness) * 0.8 + 20;

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = centerX + dx, ny = centerY + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const distSq = dx * dx + dy * dy;
                    if (distSq <= radiusSq) {
                        const idx = ny * width + nx;
                        let affinity = 1;
                        if (params.smartEnabled) {
                            const pos = idx * 4;
                            const diff = Math.abs(imgData[pos] - r0) + Math.abs(imgData[pos+1] - g0) + Math.abs(imgData[pos+2] - b0);
                            if (diff > smartTolerance) affinity = Math.max(0, 1 - (diff - smartTolerance) / 40);
                        }
                        if (affinity <= 0) continue;
                        const innerRadius = radius * (params.hardness / 100);
                        const dist = Math.sqrt(distSq);
                        let force = dist > innerRadius ? 1 - (dist - innerRadius) / (radius - innerRadius) : 1;
                        const alpha = force * opacityByte * affinity;
                        if (params.mode === 'ADD') newMask[idx] = Math.max(newMask[idx], alpha);
                        else newMask[idx] = Math.max(0, newMask[idx] - (force > 0.5 ? 255 : alpha));
                    }
                }
            }
        }
        return newMask;
    },

    /**
     * LASSO INTELLIGENCE
     * Cria uma máscara baseada no polígono e refina bordas por contraste.
     */
    createPolygonMask: (width: number, height: number, points: {x: number, y: number}[], imgData?: Uint8ClampedArray) => {
        const mask = new Uint8Array(width * height);
        
        // 1. Scanline Fill (Básico)
        // Encontra os limites para otimizar o loop
        let minX = width, maxX = 0, minY = height, maxY = 0;
        points.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });

        // Loop restrito ao bounding box do polígono
        for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
            for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    if (LayerEnginePro.isPointInPoly(x, y, points)) {
                        const idx = y * width + x;
                        mask[idx] = 255;
                    }
                }
            }
        }

        // 2. Refinamento Neural (Edge-Snapping) opcional se tiver imgData
        if (imgData) {
            // (Futura implementação de refinamento de bordas por gradiente)
        }

        return mask;
    },

    isPointInPoly: (x: number, y: number, poly: {x: number, y: number}[]) => {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    },

    extractLayer: (imgObj: HTMLImageElement, mask: Uint8Array, width: number, height: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(imgObj, 0, 0);
        const imgData = ctx.getImageData(0, 0, width, height);
        for (let i = 0; i < mask.length; i++) {
            imgData.data[i * 4 + 3] = Math.round((imgData.data[i * 4 + 3] * mask[i]) / 255);
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/png');
    },

    mergeMasks: (confirmed: Uint8Array, suggested: Uint8Array): Uint8Array => {
        const result = new Uint8Array(confirmed.length);
        for (let i = 0; i < confirmed.length; i++) {
            result[i] = (confirmed[i] > 0 || suggested[i] > 0) ? 255 : 0;
        }
        return result;
    }
};
