
/**
 * VINGI LAYER ENGINE PRO v5.0
 * Operações avançadas de pixels e gerenciamento de estado de máscara.
 */

export interface MaskSnapshot {
    data: Uint8Array;
    timestamp: number;
}

export const LayerEnginePro = {
    // Gerenciamento de Histórico (Máximo 20 níveis para performance mobile)
    pushHistory: (stack: MaskSnapshot[], currentMask: Uint8Array): MaskSnapshot[] => {
        const newStack = [...stack, { data: new Uint8Array(currentMask), timestamp: Date.now() }];
        return newStack.slice(-20);
    },

    // Algoritmo de Varinha Mágica Pro
    magicWand: (
        ctx: CanvasRenderingContext2D, 
        width: number, height: number, 
        x: number, y: number, 
        params: { tolerance: number, contiguous: boolean, mode: 'ADD' | 'SUB', existingMask?: Uint8Array }
    ) => {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const newMask = params.existingMask ? new Uint8Array(params.existingMask) : new Uint8Array(width * height);
        const visited = new Uint8Array(width * height);
        const stack: [number, number][] = [[Math.floor(x), Math.floor(y)]];
        
        const startPos = (Math.floor(y) * width + Math.floor(x)) * 4;
        const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];

        while (stack.length) {
            const [cx, cy] = stack.pop()!;
            const idx = cy * width + cx;
            if (visited[idx]) continue;
            visited[idx] = 1;

            const pos = idx * 4;
            const diff = Math.abs(data[pos] - r0) + Math.abs(data[pos+1] - g0) + Math.abs(data[pos+2] - b0);

            if (diff <= params.tolerance) {
                newMask[idx] = params.mode === 'ADD' ? 255 : 0;
                
                if (params.contiguous) {
                    if (cx > 0) stack.push([cx-1, cy]);
                    if (cx < width - 1) stack.push([cx+1, cy]);
                    if (cy > 0) stack.push([cx, cy-1]);
                    if (cy < height - 1) stack.push([cx, cy+1]);
                }
            }
        }

        // Se não for contíguo, processa o resto da imagem
        if (!params.contiguous) {
            for (let i = 0; i < width * height; i++) {
                const pos = i * 4;
                const diff = Math.abs(data[pos] - r0) + Math.abs(data[pos+1] - g0) + Math.abs(data[pos+2] - b0);
                if (diff <= params.tolerance) {
                    newMask[i] = params.mode === 'ADD' ? 255 : 0;
                }
            }
        }

        return newMask;
    },

    // Aplicar Feather (Suavização de Borda via Box Blur simplificado para Performance)
    applyFeather: (mask: Uint8Array, width: number, height: number, radius: number): Uint8Array => {
        if (radius <= 0) return mask;
        const result = new Uint8Array(mask.length);
        // Lógica de suavização simplificada para não travar mobile
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0, count = 0;
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const nx = x + dx, ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            sum += mask[ny * width + nx];
                            count++;
                        }
                    }
                }
                result[y * width + x] = sum / count;
            }
        }
        return result;
    },

    // Extração de camada preservando o canal alfa com base na máscara de seleção
    extractLayer: (imgObj: HTMLImageElement, mask: Uint8Array, width: number, height: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(imgObj, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, width, height);
        for (let i = 0; i < mask.length; i++) {
            // Se o pixel na máscara for 0 (não selecionado), definimos a opacidade (alpha) do pixel da imagem como 0
            if (mask[i] === 0) {
                imgData.data[i * 4 + 3] = 0;
            }
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/png');
    }
};
