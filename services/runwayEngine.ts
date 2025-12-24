
/**
 * VINGI RUNWAY ENGINE v3.0 (WHITE-AWARE)
 * Motor especializado em segmentação de tecidos claros e preservação de sombras.
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
     * Varinha Mágica Especialista em Roupas Brancas
     * Diferencial: Aceita variação de brilho (dobras/sombras) mas rejeita variação de cor (fundo).
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
        
        // Conversão rápida para "Luma" (Brilho percebido)
        const getLuma = (r: number, g: number, b: number) => 0.299*r + 0.587*g + 0.114*b;
        const luma0 = getLuma(r0, g0, b0);
        
        const stack: [number, number][] = [[startX, startY]];
        
        // Tolerância ajustada: Mais permissiva para brilho (sombras do branco), restrita para cor
        const lumaTolerance = params.tolerance * 1.5; // Permite sombras
        const chromaTolerance = params.tolerance * 0.8; // Não permite mudar de cor (ex: ir para pele ou fundo)

        if (params.contiguous) {
            while (stack.length) {
                const [cx, cy] = stack.pop()!;
                const idx = cy * width + cx;
                if (visited[idx]) continue;
                visited[idx] = 1;

                const pos = idx * 4;
                const r = data[pos], g = data[pos+1], b = data[pos+2];
                
                // Diferença de Brilho (Sombras)
                const luma = getLuma(r, g, b);
                const lumaDiff = Math.abs(luma - luma0);
                
                // Diferença de Crominância (Cor Absoluta - aproximada pela distância euclidiana RGB normalizada)
                const rgbDiff = (Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0)) / 3;

                // Lógica Híbrida:
                // Se for roupa branca, a cor muda pouco (rgbDiff baixo), mas o brilho muda muito (lumaDiff alto).
                // Se for para o fundo, a cor muda muito.
                if (lumaDiff <= lumaTolerance && rgbDiff <= chromaTolerance * 1.5) {
                    resultMask[idx] = params.mode === 'ADD' ? 255 : 0;

                    if (cx > 0) stack.push([cx-1, cy]);
                    if (cx < width - 1) stack.push([cx+1, cy]);
                    if (cy > 0) stack.push([cx, cy-1]);
                    if (cy < height - 1) stack.push([cx, cy+1]);
                }
            }
        } else {
            // Modo Global (Não contíguo)
            for (let i = 0; i < width * height; i++) {
                const pos = i * 4;
                const r = data[pos], g = data[pos+1], b = data[pos+2];
                const lumaDiff = Math.abs(getLuma(r, g, b) - luma0);
                const rgbDiff = (Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0)) / 3;

                if (lumaDiff <= lumaTolerance && rgbDiff <= chromaTolerance) {
                    resultMask[i] = params.mode === 'ADD' ? 255 : 0;
                }
            }
        }
        return resultMask;
    },

    /**
     * Pincel Inteligente com Detecção de Borda (High Contrast Edge Stop)
     */
    paintMask: (
        mask: Uint8Array,
        ctx: CanvasRenderingContext2D | null, 
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

        let imgData: Uint8ClampedArray | null = null;
        let r0 = 0, g0 = 0, b0 = 0;
        
        // Smart Logic: Amostra a cor central para saber o que "proteger"
        if (params.smart && ctx) {
            const p = ctx.getImageData(centerX, centerY, 1, 1).data;
            r0 = p[0]; g0 = p[1]; b0 = p[2];
            // Pega uma área um pouco maior que o pincel para performance
            const safeX = Math.max(0, startX - 10);
            const safeY = Math.max(0, startY - 10);
            const safeW = Math.min(width, endX + 10) - safeX;
            const safeH = Math.min(height, endY + 10) - safeY;
            
            // Nota: Para simplificar aqui, vamos pegar a imagem toda se não for gigante,
            // ou idealmente pegaríamos só o patch. Assumindo imagem cheia cacheada no frontend seria melhor,
            // mas aqui vamos pegar o patch para ser rápido.
            imgData = ctx.getImageData(0, 0, width, height).data; 
        }

        const hardnessK = params.hardness / 100;
        // Tolerância dinâmica: Roupas brancas precisam de mais tolerância a sombras (60-80)
        const smartTolerance = 65; 

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
                        // Distância Euclidiana Simples é rápida e eficaz para bordas duras
                        const diff = Math.sqrt(
                            Math.pow(imgData[pos] - r0, 2) + 
                            Math.pow(imgData[pos+1] - g0, 2) + 
                            Math.pow(imgData[pos+2] - b0, 2)
                        );
                        
                        // Curva de decaimento suave
                        if (diff > smartTolerance * 1.5) affinity = 0; // Borda dura
                        else if (diff > smartTolerance) affinity = 1 - ((diff - smartTolerance) / (smartTolerance * 0.5));
                    }

                    if (affinity <= 0.05) continue;

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
