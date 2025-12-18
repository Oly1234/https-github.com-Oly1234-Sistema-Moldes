
export const RunwayEngine = {
    async findBaseModels(query: string): Promise<string[]> {
        // Injetamos contexto técnico de contraste para facilitar o preenchimento de estampa posterior
        const refinedQuery = `${query} with tanned skin on dark background studio photoshoot high contrast professional white clothing`;
        
        const res = await fetch('/api/analyze', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ action: 'FIND_WHITE_MODELS', prompt: refinedQuery }) 
        });
        const data = await res.json();
        if (!data.success) return [];

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
        
        return this.findBaseModels(`white solid ${garmentType}`);
    }
};
