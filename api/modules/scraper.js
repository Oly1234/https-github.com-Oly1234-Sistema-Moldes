
// DEPARTAMENTO: AQUISIÇÃO DE DADOS (Scraper Visual / TBN Proxy)
// Responsabilidade: Buscar a imagem REPRESENTATIVA usando Inversão de Fluxo (Search Engine Proxy).

export const getLinkPreview = async (targetUrl, backupSearchTerm, userReferenceImage, apiKey, contextType = 'CLOTHING', linkType = 'DIRECT') => {
    
    // ESTRATÉGIA: BING THUMBNAIL PROXY (TBN)
    // Documentação não oficial: https://tse{1-4}.mm.bing.net/th?q={QUERY}&w={W}&h={H}&c={MODE}...
    // Isso evita 100% dos bloqueios de sites como Etsy/Burda, pois estamos pedindo a imagem ao Bing, não ao site.
    
    const generateBingProxyUrl = (term) => {
        if (!term) return null;
        const encodedTerm = encodeURIComponent(term.trim());
        // c=7: Smart Crop (Foca no objeto)
        // rs=1: Resize / Scale
        // w=500, h=500: Tamanho ideal para o card
        // p=0: Prioridade alta
        // dpr=2: Alta densidade (Retina)
        return `https://tse2.mm.bing.net/th?q=${encodedTerm}&w=500&h=500&c=7&rs=1&p=0&dpr=2&pid=1.7`;
    };

    // 1. SELEÇÃO DO TERMO DE BUSCA VISUAL
    // Preferimos o backupSearchTerm pois ele foi otimizado pelo Dept. de Engenharia (ex: "Simplicity 8555 pattern envelope")
    // Se não tiver, extraímos do nome do produto.
    let searchTerm = backupSearchTerm;
    
    if (!searchTerm && targetUrl) {
        // Fallback básico: tentar extrair algo da URL
        try {
            const urlObj = new URL(targetUrl);
            const pathSegments = urlObj.pathname.split('/').filter(s => s.length > 3);
            if (pathSegments.length > 0) {
                searchTerm = pathSegments[pathSegments.length - 1].replace(/-/g, ' ');
            }
        } catch(e) {}
    }

    if (searchTerm) {
        // Retorna DIRETAMENTE a URL do proxy. O frontend vai carregar a imagem.
        // Não fazemos fetch no backend para economizar tempo e evitar timeout da Vercel.
        return generateBingProxyUrl(searchTerm);
    }

    // 2. FALLBACK EXTREMO (Se não tiver termo nenhum)
    // Retorna null para o frontend usar o favicon ou placeholder
    return null;
};
