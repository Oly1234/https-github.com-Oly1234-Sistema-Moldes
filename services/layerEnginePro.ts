
/**
 * VINGI LAYER ENGINE PRO v10.9
 * Foco: Laço Inteligente por Intenção & Precisão Neural.
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

        if (centerX < 0 || centerX >= width || centerY < 0 || centerY >= height) return newMask;

        let r0 = 0, g0 = 0, b0 = 0, samples = 0;
        for (let sy = -1; sy <= 1; sy++) {
            for (let sx = -1; sx <= 1; sx++) {
                const tx = centerX + sx, ty = centerY + sy;
                if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
                    const p = (ty * width + tx) * 4;
                    r0 += imgData[p]; g0 += imgData[p+1]; b0 += imgData[p+2];
                    samples++;
                }
            }
        }
        r0 /= samples; g0 /= samples; b0 /= samples;

        const hardnessK = params.hardness / 100;
        const smartTolerance = (100 - params.hardness) * 0.5 + 15;

        const startY = Math.max(0, Math.floor(centerY - radius));
        const endY = Math.min(height - 1, Math.ceil(centerY + radius));
        const startX = Math.max(0, Math.floor(centerX - radius));
        const endX = Math.min(width - 1, Math.ceil(centerX + radius));

        for (let ny = startY; ny <= endY; ny++) {
            for (let nx = startX; nx <= endX; nx++) {
                const dx = nx - centerX;
                const dy = ny - centerY;
                const distSq = dx * dx + dy * dy;

                if (distSq <= radiusSq) {
                    const idx = ny * width + nx;
                    let affinity = 1;

                    if (params.smartEnabled) {
                        const pos = idx * 4;
                        const diff = Math.abs(imgData[pos] - r0) + Math.abs(imgData[pos+1] - g0) + Math.abs(imgData[pos+2] - b0);
                        if (diff > smartTolerance) {
                            affinity = Math.max(0, 1 - (diff - smartTolerance) / 25);
                        }
                    }

                    if (affinity <= 0) continue;

                    const dist = Math.sqrt(distSq);
                    const innerRadius = radius * hardnessK;
                    let force = dist > innerRadius ? 1 - (dist - innerRadius) / (radius - innerRadius) : 1;
                    const alpha = force * opacityByte * affinity;

                    if (params.mode === 'ADD') {
                        if (alpha > newMask[idx]) newMask[idx] = alpha;
                    } else {
                        const erasePower = Math.min(255, alpha * 2); 
                        newMask[idx] = Math.max(0, newMask[idx] - erasePower);
                    }
                }
            }
        }
        return newMask;
    },

    /**
     * DETECT LASSO INTENT (Motor de Decisão Automática)
     */
    detectLassoIntent: (mask: Uint8Array, width: number, height: number, points: {x: number, y: number}[]): 'ADD' | 'SUB' => {
        let insidePixels = 0;
        let maskedPixels = 0;
        
        let minX = width, maxX = 0, minY = height, maxY = 0;
        points.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });

        // Amostra a área do laço para decidir a intenção
        const step = Math.max(1, Math.floor((maxX - minX) / 20)); // Amostragem para performance
        for (let y = Math.floor(minY); y <= Math.ceil(maxY); y += step) {
            for (let x = Math.floor(minX); x <= Math.ceil(maxX); x += step) {
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    if (LayerEnginePro.isPointInPoly(x, y, points)) {
                        insidePixels++;
                        if (mask[y * width + x] > 128) maskedPixels++;
                    }
                }
            }
        }

        // Se mais de 60% da área do laço já estiver mascarada, a intenção é REMOVER
        if (insidePixels > 0 && (maskedPixels / insidePixels) > 0.6) return 'SUB';
        return 'ADD';
    },

    /**
     * LASSO INTELLIGENCE
     */
    createPolygonMask: (width: number, height: number, points: {x: number, y: number}[], mode: 'ADD' | 'SUB', existingMask?: Uint8Array) => {
        const mask = existingMask ? new Uint8Array(existingMask) : new Uint8Array(width * height);
        let minX = width, maxX = 0, minY = height, maxY = 0;
        points.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });

        for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
            for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    if (LayerEnginePro.isPointInPoly(x, y, points)) {
                        const idx = y * width + x;
                        mask[idx] = mode === 'ADD' ? 255 : 0;
                    }
                }
            }
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
