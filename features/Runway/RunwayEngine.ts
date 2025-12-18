
export const RunwayEngine = {
    async findBaseModels(query: string): Promise<string[]> {
        const res = await fetch('/api/analyze', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ action: 'FIND_WHITE_MODELS', prompt: query }) 
        });
        const data = await res.json();
        if (!data.success) return [];

        // Buscamos um set maior (50 resultados)
        const previews = await Promise.all(data.queries.slice(0, 50).map(async (q: string) => {
            const r = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ action: 'GET_LINK_PREVIEW', backupSearchTerm: q, linkType: 'SEARCH_QUERY' }) 
            });
            const d = await r.json(); 
            return d.success ? d.image : null;
        }));
        return previews.filter(u => u !== null) as string[];
    },

    async findBaseModelsByImage(imageBase64: string): Promise<string[]> {
        // Primeiro analisamos a imagem para saber o que buscar
        const analysisRes = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'ANALYZE_REFERENCE_FOR_PROMPT', 
                mainImageBase64: imageBase64.split(',')[1] || imageBase64 
            })
        });
        const analysisData = await analysisRes.json();
        const garmentType = analysisData.prompt || "Clothing";
        
        // Agora buscamos versões brancas desse tipo de peça
        return this.findBaseModels(`white solid ${garmentType} on white background photoshoot`);
    }
};
