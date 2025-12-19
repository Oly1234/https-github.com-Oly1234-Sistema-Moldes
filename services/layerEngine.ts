
/**
 * VINGI LAYER ENGINE v4.0 (SAM-X BASED)
 * Pixel-level manipulation for advanced textile separation.
 */

export const LayerEngine = {
    // Segmentação com feedback tático (Verde/Vermelho)
    analyzeSelection: (ctx: CanvasRenderingContext2D, width: number, height: number, x: number, y: number, tolerance: number, existingMask?: Uint8Array) => {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const newConfirmed = new Uint8Array(width * height);
        const suggested = new Uint8Array(width * height);
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
            
            // VERDE (CONFIRMADO)
            if (diff <= tolerance) {
                newConfirmed[idx] = 255;
                if (cx > 0) stack.push([cx-1, cy]);
                if (cx < width - 1) stack.push([cx+1, cy]);
                if (cy > 0) stack.push([cx, cy-1]);
                if (cy < height - 1) stack.push([cx, cy+1]);
            } 
            // VERMELHO (SUGESTÃO)
            else if (diff <= tolerance * 2.5) {
                suggested[idx] = 255;
            }
        }

        // Fusão com máscara existente se houver (Cliques Contínuos)
        if (existingMask) {
            for (let i = 0; i < newConfirmed.length; i++) {
                if (existingMask[i] === 255) newConfirmed[i] = 255;
            }
        }

        return { confirmed: newConfirmed, suggested };
    },

    // Extração preservando coordenadas originais
    extractLayer: (imgObj: HTMLImageElement, mask: Uint8Array, width: number, height: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(imgObj, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, width, height);
        for (let i = 0; i < mask.length; i++) {
            if (mask[i] === 0) imgData.data[i*4 + 3] = 0;
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/png');
    }
};
