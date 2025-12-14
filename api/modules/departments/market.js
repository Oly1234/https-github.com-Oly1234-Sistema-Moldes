
// DEPARTAMENTO: INTELIGÊNCIA DE MERCADO
// Responsabilidade: Transformar dados técnicos em Links de Busca (Hunter Queries)

export const generateMarketLinks = (visualData, context = 'TEXTURE') => {
    const matches = [];
    const baseTerm = visualData.visualDescription;

    const createLink = (source, type, urlBase, suffix, boost, isVisualSearch = true) => {
        const query = `${baseTerm} ${suffix}`;
        return {
            source,
            patternName: baseTerm,
            type,
            linkType: isVisualSearch ? "SEARCH_QUERY" : "DIRECT",
            url: `${urlBase}${encodeURIComponent(query)}`,
            backupSearchTerm: `"${source}" ${query} -drawing`,
            similarityScore: 90 + boost,
            imageUrl: null
        };
    };

    if (context === 'TEXTURE') {
        // ESTRATÉGIA PARA SURFACE (Estampas/Arquivos)
        // Busca repetida no mesmo site permitida se o sufixo mudar
        matches.push(createLink("Patternbank", "PREMIUM", "https://patternbank.com/designs?search=", "", 3));
        matches.push(createLink("Spoonflower", "FABRIC", "https://www.spoonflower.com/en/shop?on=fabric&q=", "", 3));
        matches.push(createLink("Shutterstock", "STOCK", "https://www.shutterstock.com/search/", "seamless pattern", 3));
        matches.push(createLink("Adobe Stock", "PRO", "https://stock.adobe.com/search?k=", "textile swatch", 3));
        matches.push(createLink("Etsy", "DIGITAL", "https://www.etsy.com/search?q=", "digital paper seamless", 2));
        matches.push(createLink("Creative Market", "VECTOR", "https://creativemarket.com/search?q=", "pattern", 2));
    } else {
        // ESTRATÉGIA PARA CLOTHING (Moldes)
        // Força "Sewing Pattern"
        matches.push(createLink("Simplicity", "BIG 4", "https://simplicity.com/search.php?search_query=", "sewing pattern", 3));
        matches.push(createLink("McCall's", "BIG 4", "https://simplicity.com/search.php?search_query=", "pattern", 3));
        matches.push(createLink("Etsy", "PDF", "https://www.etsy.com/search?q=", "sewing pattern pdf", 2));
        matches.push(createLink("Etsy", "VINTAGE", "https://www.etsy.com/search?q=", "vintage pattern envelope", 2));
        matches.push(createLink("Burda", "EURO", "https://www.burdastyle.com/catalogsearch/result/?q=", "", 2));
        matches.push(createLink("Mood Fabrics", "FREE", "https://www.moodfabrics.com/blog/?s=", "free pattern", 1));
    }

    return matches;
};
