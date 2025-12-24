
/**
 * VINGI RUNWAY ENGINE v3.5 (SMART BOUNDARIES)
 * Motor especializado em segmentação de tecidos e proteção de bordas.
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
     * Varinha Mágica "Photoshop-like"
     * Separa Luminância (Luz) de Crominância (Cor) para preencher dobras de tecido sem vazar.
     */
    magicWand: (
        ctx: CanvasRenderingContext2D, 
        width: number, height: number, 
        x: number, y: number, 
        params: { tolerance: number, contiguous: boolean, mode: 'ADD' | 'SUB', existingMask?: Uint8Array }
    ) => {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        // Se já existe máscara, clonamos. Se não, cria nova.
        const resultMask = params.existingMask ? new Uint8Array(params.existingMask) : new Uint8Array(width * height);
        
        // Matriz de visitados para o Flood Fill
        const visited = new Uint8Array(width * height);
        
        const startX = Math.floor(x);
        const startY = Math.floor(y);
        const startPos = (startY * width + startX) * 4;
        
        if (startX < 0 || startX >= width || startY < 0 || startY >= height) return resultMask;

        // Cor de Referência (Onde o usuário clicou)
        const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];
        
        // Função auxiliar de Luma (Percepção humana de brilho)
        const getLuma = (r: number, g: number, b: number) => 0.299*r + 0.587*g + 0.114*b;
        const luma0 = getLuma(r0, g0, b0);
        
        const stack: [number, number][] = [[startX, startY]];
        
        // Tolerância Dinâmica:
        // Roupas tem muita variação de luz (sombras), mas pouca de cor.
        // Aumentamos a tolerância de Luma e restringimos a de Chroma.
        const lumaTolerance = params.tolerance * 1.8; // Permite sombras fortes
        const chromaTolerance = params.tolerance * 0.6; // Restrito para não pegar o fundo

        const checkPixel = (px: number, py: number) => {
            const idx = py * width + px;
            const pos = idx * 4;
            const r = data[pos], g = data[pos+1], b = data[pos+2];

            // Distância de Brilho
            const lumaDiff = Math.abs(getLuma(r, g, b) - luma0);
            
            // Distância de Cor (Euclidiana Simples RGB)
            const chromaDiff = (Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0)) / 3;

            // Lógica de Aceitação:
            // 1. Se a cor é muito parecida, aceita mesmo com brilho diferente (dobras).
            // 2. Se a cor muda muito (fundo), rejeita.
            return (lumaDiff <= lumaTolerance && chromaDiff <= chromaTolerance);
        };

        if (params.contiguous) {
            // Flood Fill (Preenchimento Contíguo - Igual Balde de Tinta)
            while (stack.length) {
                const [cx, cy] = stack.pop()!;
                const idx = cy * width + cx;
                
                if (visited[idx]) continue;
                visited[idx] = 1;

                if (checkPixel(cx, cy)) {
                    resultMask[idx] = params.mode === 'ADD' ? 255 : 0;

                    if (cx > 0) stack.push([cx-1, cy]);
                    if (cx < width - 1) stack.push([cx+1, cy]);
                    if (cy > 0) stack.push([cx, cy-1]);
                    if (cy < height - 1) stack.push([cx, cy+1]);
                }
            }
        } else {
            // Seleção Global (Todas as cores iguais na imagem)
            for (let i = 0; i < width * height; i++) {
                const px = i % width;
                const py = Math.floor(i / width);
                if (checkPixel(px, py)) {
                    resultMask[i] = params.mode === 'ADD' ? 255 : 0;
                }
            }
        }
        return resultMask;
    },

    /**
     * Pincel Neural com Proteção de Borda (Smart Boundary)
     * Lê a cor onde o traço começou e não pinta se a cor mudar drasticamente (sair do vestido).
     */
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
        
        // Configura referência de cor para o modo Smart
        if (params.smart && ctx) {
            // Se tivermos uma cor de início do traço (startColor), usamos ela como âncora.
            // Isso impede que o pincel "aprenda" a cor do fundo se você arrastar para lá.
            if (params.startColor) {
                rRef = params.startColor.r;
                gRef = params.startColor.g;
                bRef = params.startColor.b;
            } else {
                // Fallback: usa o centro do pincel atual
                const p = ctx.getImageData(centerX, centerY, 1, 1).data;
                rRef = p[0]; gRef = p[1]; bRef = p[2];
            }
            // Pega dados da área afetada
            imgData = ctx.getImageData(0, 0, width, height).data; 
        }

        const hardnessK = params.hardness / 100;
        // Tolerância para o pincel smart (mais rígido para não vazar)
        const smartTolerance = 45; 

        for (let ny = startY; ny <= endY; ny++) {
            for (let nx = startX; nx <= endX; nx++) {
                const dx = nx - centerX;
                const dy = ny - centerY;
                const distSq = dx * dx + dy * dy;

                if (distSq <= radiusSq) {
                    const idx = ny * width + nx;
                    
                    let affinity = 1;
                    
                    // Lógica Smart: Verifica se o pixel atual pertence ao mesmo objeto da referência
                    if (params.smart && imgData) {
                        const pos = idx * 4;
                        const r = imgData[pos], g = imgData[pos+1], b = imgData[pos+2];
                        
                        const diff = Math.sqrt(
                            Math.pow(r - rRef, 2) + 
                            Math.pow(g - gRef, 2) + 
                            Math.pow(b - bRef, 2)
                        );
                        
                        if (diff > smartTolerance) {
                            // Decaimento rápido se passar da tolerância (Borda)
                            affinity = Math.max(0, 1 - (diff - smartTolerance) / 20);
                        }
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
                        // Borracha também respeita bordas se Smart estiver ligado!
                        // Isso permite apagar só o fundo perto do vestido sem apagar o vestido.
                        newMask[idx] = Math.min(newMask[idx], 255 - value);
                    }
                }
            }
        }
        return newMask;
    }
};
