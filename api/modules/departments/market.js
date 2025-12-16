
// DEPARTAMENTO: INTELIGÊNCIA DE MERCADO (MASSIVE SEARCH ENGINE)
// Responsabilidade: Gerar 50+ links de busca usando permutação de Lojas x Keywords.

export const generateMarketLinks = (visualData, context = 'TEXTURE') => {
    const matches = [];
    
    // Recupera palavras-chave ricas do Forense
    // O Forense retorna até 4 variações (Técnico, Vibe, Comercial, Detalhe)
    const keywords = visualData.searchKeywords || [visualData.visualDescription];
    
    // Garante que temos keywords suficientes para permutação
    const safeKeywords = keywords.length > 0 ? keywords : ["Pattern", "Design", "Texture", "Print"];
    const primaryTerm = safeKeywords[0];

    // --- FUNÇÃO GERADORA DE LINKS (DEEP SEARCH) ---
    // Gera até 3 variações de link para a MESMA LOJA usando keywords diferentes.
    const addDeepLinks = (storeName, category, urlBase, baseSuffix, boost = 0) => {
        
        // 1. MATCH EXATO (Primary Keyword) - Alta Relevância
        const term1 = safeKeywords[0];
        matches.push({
            source: storeName,
            patternName: term1, // Nome exibido no card
            type: category,
            linkType: "SEARCH_QUERY",
            url: `${urlBase}${encodeURIComponent((term1 + ' ' + baseSuffix).trim())}`,
            backupSearchTerm: `"${storeName}" ${term1} ${baseSuffix} -drawing`, // Hunter Query
            similarityScore: 96 + boost,
            imageUrl: null
        });

        // 2. MATCH DE ESTILO/VIBE (Secondary Keyword) - Descoberta
        if (safeKeywords.length > 1) {
             const term2 = safeKeywords[1];
             // Só adiciona se for diferente do primeiro
             if (term2.toLowerCase() !== term1.toLowerCase()) {
                matches.push({
                    source: storeName, // Mesma fonte
                    patternName: term2,
                    type: category,
                    linkType: "SEARCH_QUERY",
                    url: `${urlBase}${encodeURIComponent((term2 + ' ' + baseSuffix).trim())}`,
                    backupSearchTerm: `"${storeName}" ${term2} ${baseSuffix} -drawing`,
                    similarityScore: 92 + boost,
                    imageUrl: null
                });
             }
        }
        
        // 3. MATCH TÉCNICO/COMBINADO (Keyword 3 ou Combinação) - Niche
        if (safeKeywords.length > 2) {
             const term3 = safeKeywords[2];
             if (term3.toLowerCase() !== term1.toLowerCase()) {
                matches.push({
                    source: storeName,
                    patternName: term3,
                    type: category,
                    linkType: "SEARCH_QUERY",
                    url: `${urlBase}${encodeURIComponent((term3 + ' ' + baseSuffix).trim())}`,
                    backupSearchTerm: `"${storeName}" ${term3} ${baseSuffix} -drawing`,
                    similarityScore: 88 + boost,
                    imageUrl: null
                });
             }
        }
    };

    if (context === 'TEXTURE') {
        // =================================================================================
        // ABA CRIADOR (PATTERN STUDIO) - LÓGICA DEEP SEARCH (15 Lojas x 3 Vars = ~45 Links)
        // =================================================================================
        
        // 1. GIGANTES DE STOCK (Alta Qualidade Visual)
        addDeepLinks("Shutterstock", "STOCK", "https://www.shutterstock.com/search/", "seamless pattern", 5);
        addDeepLinks("Adobe Stock", "PRO", "https://stock.adobe.com/search?k=", "textile swatch", 5);
        addDeepLinks("Getty Images", "PRO", "https://www.gettyimages.com/search/2/image?phrase=", "pattern texture", 4);
        addDeepLinks("Depositphotos", "STOCK", "https://depositphotos.com/stock-photos/", "background seamless", 4);
        
        // 2. DESIGN TÊXTIL ESPECÍFICO (Foco em Tecido)
        addDeepLinks("Patternbank", "PREMIUM", "https://patternbank.com/designs?search=", "print design", 5);
        addDeepLinks("Spoonflower", "FABRIC", "https://www.spoonflower.com/en/shop?on=fabric&q=", "repeat pattern", 5);
        addDeepLinks("Textile Hive", "ARCHIVE", "https://www.textilehive.com/search?q=", "vintage swatch", 3);
        
        // 3. RECURSOS GRATUITOS & VETORES
        addDeepLinks("Freepik", "FREE", "https://www.freepik.com/search?format=search&query=", "seamless vector", 4);
        addDeepLinks("Vecteezy", "FREE", "https://www.vecteezy.com/free-vector/", "pattern", 4);
        addDeepLinks("Rawpixel", "CC0", "https://www.rawpixel.com/search/", "public domain pattern", 4);
        addDeepLinks("Unsplash", "PHOTO", "https://unsplash.com/s/photos/", "texture background", 2);
        
        // 4. MARKETPLACES CRIATIVOS (Indie)
        addDeepLinks("Creative Market", "INDIE", "https://creativemarket.com/search?q=", "pattern bundle", 4);
        addDeepLinks("Etsy Digital", "MKT", "https://www.etsy.com/search?q=", "digital paper seamless", 4);
        addDeepLinks("Envato Elements", "SUB", "https://elements.envato.com/search/", "graphic pattern", 3);

        // 5. INSPIRAÇÃO & PORTFOLIO (Visual Search)
        addDeepLinks("Behance", "PORTFOLIO", "https://www.behance.net/search/projects?search=", "surface design", 3);
        addDeepLinks("Pinterest", "SOCIAL", "https://www.pinterest.com/search/pins/?q=", "print trend", 3);

    } else {
        // =================================================================================
        // ABA SCANNER (MOLDES DE COSTURA) - LÓGICA DEEP SEARCH (20 Lojas x 3 Vars = ~60 Links)
        // =================================================================================

        // 1. THE BIG 4 (Os Clássicos)
        addDeepLinks("Simplicity", "BIG 4", "https://simplicity.com/search.php?search_query=", "pattern", 5);
        addDeepLinks("McCall's", "BIG 4", "https://simplicity.com/search.php?search_query=", "sewing pattern", 5);
        addDeepLinks("Vogue Patterns", "COUTURE", "https://simplicity.com/search.php?search_query=", "fashion pattern", 5);
        addDeepLinks("Butterick", "CLASSIC", "https://simplicity.com/search.php?search_query=", "pattern", 5);
        addDeepLinks("Burda Style", "EURO", "https://www.burdastyle.com/catalogsearch/result/?q=", "", 5);

        // 2. MODERN INDIE DARLINGS
        addDeepLinks("The Fold Line", "DB", "https://thefoldline.com/?s=", "sewing pattern", 4);
        addDeepLinks("Closet Core", "INDIE", "https://closetcorepatterns.com/search?q=", "pattern", 4);
        addDeepLinks("Tilly & Buttons", "BEGINNER", "https://shop.tillyandthebuttons.com/search?q=", "pattern", 3);
        addDeepLinks("Grainline Studio", "MODERN", "https://grainlinestudio.com/search?q=", "pattern", 3);
        addDeepLinks("Papercut", "NZ", "https://papercutpatterns.com/search?q=", "pattern", 3);
        addDeepLinks("Named Clothing", "SCANDI", "https://www.namedclothing.com/search?q=", "pattern", 4);
        
        // 3. NICHE & SPECIALIZED
        addDeepLinks("Lekala", "CUSTOM", "https://www.lekala.co/catalog?q=", "sewing pattern", 3);
        addDeepLinks("VikiSews", "TRENDY", "https://vikisews.com/search/?q=", "pattern", 4);
        addDeepLinks("Bootstrap Fashion", "CUSTOM", "https://patterns.bootstrapfashion.com/catalogsearch/result/?q=", "pattern", 2);

        // 4. MARKETPLACES & RESELLERS
        addDeepLinks("Etsy", "MARKET", "https://www.etsy.com/search?q=", "sewing pattern pdf", 4);
        addDeepLinks("eBay", "RESALE", "https://www.ebay.com/sch/i.html?_nkw=", "sewing pattern", 2);
        addDeepLinks("Amazon", "RETAIL", "https://www.amazon.com/s?k=", "sewing pattern", 2);
        addDeepLinks("Makerist", "EURO", "https://www.makerist.com/patterns?q=", "pattern", 3);
        
        // 5. FREE & COMMUNITY
        addDeepLinks("Mood Fabrics", "FREE", "https://www.moodfabrics.com/blog/?s=", "free pattern", 4);
        addDeepLinks("Pinterest", "VISUAL", "https://www.pinterest.com/search/pins/?q=", "sewing pattern", 3);
    }

    return matches;
};
