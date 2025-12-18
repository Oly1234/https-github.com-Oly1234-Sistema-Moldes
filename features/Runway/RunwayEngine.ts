
export const RunwayEngine = {
    async findBaseModels(query: string): Promise<string[]> {
        const res = await fetch('/api/analyze', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ action: 'FIND_WHITE_MODELS', prompt: query }) 
        });
        const data = await res.json();
        if (!data.success) return [];

        const previews = await Promise.all(data.queries.slice(0, 8).map(async (q: string) => {
            const r = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ action: 'GET_LINK_PREVIEW', backupSearchTerm: q, linkType: 'SEARCH_QUERY' }) 
            });
            const d = await r.json(); 
            return d.success ? d.image : null;
        }));
        return previews.filter(u => u !== null);
    }
};
