
// DEPARTAMENTO: INTELIGÊNCIA DE MERCADO
// Responsabilidade: Gerar links de busca altamente otimizados (Hunter Queries).

export const generateMarketLinks = (visualData, context = 'TEXTURE') => {
    const matches = [];
    
    // Recupera palavras-chave inteligentes do Forense (ou fallback)
    const primaryTerm = visualData.visualDescription;
    const searchTerms = visualData.searchKeywords || [primaryTerm];
    
    // Função auxiliar para rotacionar termos de busca e dar variedade aos resultados
    const getTerm = (index) => searchTerms[index % searchTerms.length] || primaryTerm;

    const createLink = (source, type, urlBase, suffix, boost, termIndex = 0) => {
        // Monta a query: Termo Inteligente + Sufixo da Loja
        const coreTerm = getTerm(termIndex);
        const query = `${coreTerm} ${suffix}`.trim();
        
        return {
            source,
            patternName: coreTerm, // Nome exibido no card
            type,
            linkType: "SEARCH_QUERY",
            url: `${urlBase}${encodeURIComponent(query)}`,
            backupSearchTerm: `"${source}" ${query} -drawing -sketch`,
            similarityScore: 90 + boost,
            imageUrl: null
        };
    };

    if (context === 'TEXTURE') {
        // --- ABA CRIADOR (Foco em Arquivos de Estampa) ---
        matches.push(createLink("Patternbank", "PREMIUM", "https://patternbank.com/designs?search=", "textile design", 3, 0));
        matches.push(createLink("Spoonflower", "FABRIC", "https://www.spoonflower.com/en/shop?on=fabric&q=", "seamless", 3, 0));
        matches.push(createLink("Shutterstock", "STOCK", "https://www.shutterstock.com/search/", "seamless pattern vector", 3, 0));
        matches.push(createLink("Adobe Stock", "PRO", "https://stock.adobe.com/search?k=", "textile swatch", 3, 0));
        matches.push(createLink("Etsy Digital", "MKT", "https://www.etsy.com/search?q=", "digital paper seamless", 2, 0));
        matches.push(createLink("Creative Market", "INDIE", "https://creativemarket.com/search?q=", "pattern overlay", 2, 0));
    } else {
        // --- ABA SCANNER (Foco em Moldes de Costura) ---
        // Usamos termos diferentes para lojas diferentes para maximizar o alcance
        
        // 1. GIGANTES (Termo Principal - Técnico)
        matches.push(createLink("Simplicity", "BIG 4", "https://simplicity.com/search.php?search_query=", "sewing pattern", 3, 0));
        matches.push(createLink("McCall's", "BIG 4", "https://simplicity.com/search.php?search_query=", "pattern", 3, 0));
        matches.push(createLink("Vogue Patterns", "COUTURE", "https://simplicity.com/search.php?search_query=", "fashion pattern", 3, 0));
        
        // 2. INDIE & MODERN (Termo Secundário - Vibe/Estilo)
        matches.push(createLink("The Fold Line", "DATABASE", "https://thefoldline.com/?s=", "sewing pattern", 3, 1));
        matches.push(createLink("Makerist", "EURO", "https://www.makerist.com/patterns?q=", "pattern", 2, 1));
        
        // 3. MARKETPLACES (Termo Detalhado)
        matches.push(createLink("Etsy", "PDF", "https://www.etsy.com/search?q=", "sewing pattern pdf", 2, 2));
        matches.push(createLink("Etsy Vintage", "VINTAGE", "https://www.etsy.com/search?q=", "vintage sewing pattern", 2, 0));
        matches.push(createLink("Burda Style", "EURO", "https://www.burdastyle.com/catalogsearch/result/?q=", "", 2, 0));
        
        // 4. GRATUITOS
        matches.push(createLink("Mood Fabrics", "FREE", "https://www.moodfabrics.com/blog/?s=", "free sewing pattern", 1, 0));
    }

    return matches;
};
