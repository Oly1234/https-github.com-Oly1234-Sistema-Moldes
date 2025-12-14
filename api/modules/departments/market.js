
// DEPARTAMENTO: INTELIGÊNCIA DE MERCADO (MASSIVE SEARCH ENGINE)
// Responsabilidade: Gerar 50+ links de busca usando permutação de Lojas x Keywords.

export const generateMarketLinks = (visualData, context = 'TEXTURE') => {
    const matches = [];
    
    // Recupera palavras-chave ricas do Forense
    // O Forense agora retorna até 4 variações (Técnico, Vibe, Comercial, Detalhe)
    const keywords = visualData.searchKeywords || [visualData.visualDescription];
    const primaryTerm = keywords[0]; // Termo mais forte

    // --- FUNÇÃO GERADORA DE LINKS ---
    const addLink = (storeName, category, urlBase, suffix, keywordIndex, boost = 0) => {
        // Rotaciona as keywords para que cada loja busque um ângulo diferente do produto
        // Isso evita redundância e aumenta a chance de achar o item raro.
        const term = keywords[keywordIndex % keywords.length] || primaryTerm;
        const query = `${term} ${suffix}`.trim();
        
        matches.push({
            source: storeName,
            patternName: term, // O termo usado na busca é mostrado no card
            type: category, // Categoria (BIG 4, INDIE, VINTAGE, etc.)
            linkType: "SEARCH_QUERY",
            url: `${urlBase}${encodeURIComponent(query)}`,
            // Hunter Query para o Scraper Visual (Bing Proxy)
            // Adiciona termos visuais para garantir que a imagem seja do produto
            backupSearchTerm: `"${storeName}" ${query} -drawing -sketch -pinterest`,
            similarityScore: 90 + boost, // Boost artificial para ordenação
            imageUrl: null
        });
    };

    if (context === 'TEXTURE') {
        // =================================================================================
        // ABA CRIADOR (PATTERN STUDIO) - LÓGICA EXPANDIDA (50+ SOURCES)
        // =================================================================================
        
        // 1. GIGANTES DE STOCK (Alta Qualidade Visual)
        addLink("Shutterstock", "STOCK", "https://www.shutterstock.com/search/", "seamless pattern", 0, 5);
        addLink("Adobe Stock", "PRO", "https://stock.adobe.com/search?k=", "textile swatch", 0, 5);
        addLink("Getty Images", "PRO", "https://www.gettyimages.com/search/2/image?phrase=", "pattern texture", 1, 4);
        addLink("Depositphotos", "STOCK", "https://depositphotos.com/stock-photos/", "background seamless", 1, 4);
        addLink("IStock", "STOCK", "https://www.istockphoto.com/search/2/image?phrase=", "seamless print", 2, 4);

        // 2. DESIGN TÊXTIL ESPECÍFICO (Foco em Tecido)
        addLink("Patternbank", "PREMIUM", "https://patternbank.com/designs?search=", "print design", 0, 5);
        addLink("Spoonflower", "FABRIC", "https://www.spoonflower.com/en/shop?on=fabric&q=", "repeat pattern", 0, 5);
        addLink("Textile Hive", "ARCHIVE", "https://www.textilehive.com/search?q=", "vintage swatch", 1, 3);
        addLink("Designious", "VECTOR", "https://www.designious.com/?s=", "vector pattern", 2, 3);

        // 3. RECURSOS GRATUITOS & VETORES
        addLink("Freepik", "FREE", "https://www.freepik.com/search?format=search&query=", "seamless vector", 2, 4);
        addLink("Vecteezy", "FREE", "https://www.vecteezy.com/free-vector/", "pattern", 2, 4);
        addLink("Rawpixel", "CC0", "https://www.rawpixel.com/search/", "public domain pattern", 1, 4);
        addLink("Unsplash", "PHOTO", "https://unsplash.com/s/photos/", "texture background", 3, 2);
        
        // 4. MARKETPLACES CRIATIVOS (Indie)
        addLink("Creative Market", "INDIE", "https://creativemarket.com/search?q=", "pattern bundle", 3, 4);
        addLink("Etsy Digital", "MKT", "https://www.etsy.com/search?q=", "digital paper seamless", 0, 4);
        addLink("Gumroad", "INDIE", "https://gumroad.com/discover?query=", "texture pack", 3, 2);
        addLink("Envato Elements", "SUB", "https://elements.envato.com/search/", "graphic pattern", 1, 3);

        // 5. INSPIRAÇÃO & PORTFOLIO (Visual Search)
        addLink("Behance", "PORTFOLIO", "https://www.behance.net/search/projects?search=", "surface design", 0, 3);
        addLink("Dribbble", "DESIGN", "https://dribbble.com/search/", "seamless pattern", 0, 3);
        addLink("Pinterest", "SOCIAL", "https://www.pinterest.com/search/pins/?q=", "print trend", 3, 3);

    } else {
        // =================================================================================
        // ABA SCANNER (MOLDES DE COSTURA) - LÓGICA EXPANDIDA (50+ SOURCES)
        // =================================================================================

        // 1. THE BIG 4 (Os Clássicos) - Buscam pelo termo técnico (Keyword 0)
        addLink("Simplicity", "BIG 4", "https://simplicity.com/search.php?search_query=", "pattern", 0, 5);
        addLink("McCall's", "BIG 4", "https://simplicity.com/search.php?search_query=", "sewing pattern", 0, 5);
        addLink("Vogue Patterns", "COUTURE", "https://simplicity.com/search.php?search_query=", "fashion pattern", 0, 5);
        addLink("Butterick", "CLASSIC", "https://simplicity.com/search.php?search_query=", "pattern", 0, 5);
        addLink("Burda Style", "EURO", "https://www.burdastyle.com/catalogsearch/result/?q=", "", 0, 5);

        // 2. MODERN INDIE DARLINGS (Estilo/Vibe - Keyword 1 & 3)
        addLink("The Fold Line", "DB", "https://thefoldline.com/?s=", "sewing pattern", 1, 4);
        addLink("Closet Core", "INDIE", "https://closetcorepatterns.com/search?q=", "pattern", 1, 4);
        addLink("Tilly & Buttons", "BEGINNER", "https://shop.tillyandthebuttons.com/search?q=", "pattern", 3, 3);
        addLink("Grainline Studio", "MODERN", "https://grainlinestudio.com/search?q=", "pattern", 1, 3);
        addLink("Papercut", "NZ", "https://papercutpatterns.com/search?q=", "pattern", 3, 3);
        addLink("Named Clothing", "SCANDI", "https://www.namedclothing.com/search?q=", "pattern", 1, 4);
        addLink("Merchant & Mills", "UK", "https://merchantandmills.com/?s=", "pattern", 0, 3);
        addLink("Friday Pattern Co", "FUN", "https://fridaypatterncompany.com/search?q=", "sewing pattern", 3, 3);

        // 3. NICHE & SPECIALIZED (Técnico/Detalhe - Keyword 2)
        addLink("Lekala", "CUSTOM", "https://www.lekala.co/catalog?q=", "sewing pattern", 2, 3);
        addLink("Grasser", "RUSSIAN", "https://en.grasser.ru/search/?q=", "pattern", 2, 4);
        addLink("VikiSews", "TRENDY", "https://vikisews.com/search/?q=", "pattern", 1, 4);
        addLink("Marfy", "COUTURE", "https://www.marfy.it/?s=", "pattern", 0, 2);
        addLink("Bootstrap Fashion", "CUSTOM", "https://patterns.bootstrapfashion.com/catalogsearch/result/?q=", "pattern", 2, 2);

        // 4. MARKETPLACES & RESELLERS (Volume - Todos os Keywords)
        addLink("Etsy", "MARKET", "https://www.etsy.com/search?q=", "sewing pattern pdf", 0, 4);
        addLink("Etsy Vintage", "VINTAGE", "https://www.etsy.com/search?q=", "vintage sewing pattern", 1, 3);
        addLink("eBay", "RESALE", "https://www.ebay.com/sch/i.html?_nkw=", "sewing pattern", 0, 2);
        addLink("Amazon", "RETAIL", "https://www.amazon.com/s?k=", "sewing pattern", 0, 2);
        addLink("Makerist", "EURO", "https://www.makerist.com/patterns?q=", "pattern", 1, 3);
        
        // 5. FREE & COMMUNITY (Keyword 3 - Vibe)
        addLink("Mood Fabrics", "FREE", "https://www.moodfabrics.com/blog/?s=", "free pattern", 3, 4);
        addLink("Peppermint Mag", "FREE", "https://peppermintmag.com/?s=", "sewing pattern", 3, 3);
        addLink("Reddit Sewing", "FORUM", "https://www.reddit.com/r/sewing/search/?q=", "pattern search", 0, 1);
        addLink("Pinterest", "VISUAL", "https://www.pinterest.com/search/pins/?q=", "sewing pattern", 3, 3);
    }

    return matches;
};
