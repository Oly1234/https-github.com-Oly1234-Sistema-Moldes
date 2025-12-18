
export const MockupEngine = {
    async createPatternFromBase64(base64: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = base64;
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
        });
    },

    createMask(ctx: CanvasRenderingContext2D, x: number, y: number, tolerance: number): { maskCanvas: HTMLCanvasElement, bounds: any } | null {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const mCtx = maskCanvas.getContext('2d')!;
        const mImgData = mCtx.createImageData(width, height);
        
        const startPos = (Math.floor(y) * width + Math.floor(x)) * 4;
        const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];
        
        const visited = new Uint8Array(width * height);
        const stack = [[Math.floor(x), Math.floor(y)]];
        let minX = width, maxX = 0, minY = height, maxY = 0;

        while (stack.length) {
            const [cx, cy] = stack.pop()!;
            const idx = cy * width + cx;
            if (visited[idx]) continue;
            visited[idx] = 1;
            const p = idx * 4;
            
            const diff = Math.abs(data[p] - r0) + Math.abs(data[p+1] - g0) + Math.abs(data[p+2] - b0);
            if (diff <= tolerance * 3) {
                mImgData.data[p] = 255;
                mImgData.data[p+1] = 255;
                mImgData.data[p+2] = 255;
                mImgData.data[p+3] = 255;
                if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
                if (cx > 0) stack.push([cx-1, cy]); if (cx < width-1) stack.push([cx+1, cy]);
                if (cy > 0) stack.push([cx, cy-1]); if (cy < height-1) stack.push([cx, cy+1]);
            }
        }
        mCtx.putImageData(mImgData, 0, 0);
        return { maskCanvas, bounds: { minX, maxX, minY, maxY } };
    }
};
