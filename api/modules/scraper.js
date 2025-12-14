
// DEPARTAMENTO: AQUISIÇÃO DE DADOS (Scraper Rápido)
// Responsabilidade: Buscar a melhor imagem REPRESENTATIVA para o link, sem bloquear o usuário.

export const getLinkPreview = async (targetUrl, backupSearchTerm, userReferenceImage, apiKey, contextType = 'CLOTHING', linkType = 'DIRECT') => {
    
    const browserHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    };

    const fetchHtml = async (url) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000); // Timeout agressivo (5s) para velocidade
        try {
            const response = await fetch(url, { headers: browserHeaders, signal: controller.signal });
            if (!response.ok) return null;
            return await response.text();
        } catch (e) { return null; }
    };

    const fetchCandidatesFromBing = async (term, specificDomain = null) => {
        if (!term) return [];
        let query = term.trim();
        if (specificDomain) query += ` site:${specificDomain}`;

        // Busca imagens com filtro de aspecto para evitar banners (aspect=Wide/Tall/Square)
        // Usamos &first=1 para pegar os primeiros resultados
        const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&scenario=ImageBasicHover`;
        const html = await fetchHtml(searchUrl);
        if (!html) return [];

        const candidates = [];
        // Regex para extrair URL da imagem e Título
        const regex = /murl&quot;:&quot;(https?:\/\/[^&]+)&quot;.*?&quot;t&quot;:&quot;([^&]+)&quot;/g;
        let match;
        let count = 0;
        
        while ((match = regex.exec(html)) !== null && count < 10) { 
            const url = match[1];
            const title = match[2];
            // Filtros Heurísticos Rápidos (Substitui a IA Lenta)
            const isLogo = /logo|banner|sprite|icon/i.test(title) || /logo|banner/i.test(url);
            const isProduct = /dress|pattern|skirt|shirt|top|trousers|fabric|print/i.test(title);
            
            if (!isLogo) {
                // Pontuação simples
                let score = 0;
                if (isProduct) score += 5;
                if (url.includes('jpg') || url.includes('png')) score += 2;
                
                candidates.push({ url, title, score });
                count++;
            }
        }
        // Ordena por pontuação heurística
        return candidates.sort((a, b) => b.score - a.score);
    };

    // --- LÓGICA DE EXECUÇÃO ---
    let imageUrl = null;
    let domain = '';
    try { domain = new URL(targetUrl).hostname; } catch(e) {}

    // 1. SELETORES DIRETOS (Rápido, se funcionar)
    // Se não for busca genérica, tenta pegar do HTML da loja
    const shouldScrapeDirect = linkType !== 'SEARCH_QUERY' && !targetUrl.includes('search');
    
    if (shouldScrapeDirect) {
        const html = await fetchHtml(targetUrl);
        if (html) {
            const storeSelectors = [
                { regex: /<meta property="og:image" content="([^"]+)"/i },
                { regex: /<meta name="twitter:image" content="([^"]+)"/i },
                { regex: /class="[^"]*product-image[^"]*"[^>]+src="([^"]+)"/i }
            ];
            for (const s of storeSelectors) {
                const match = html.match(s.regex);
                if (match && match[1]) { imageUrl = match[1]; break; }
            }
        }
    }

    // 2. BUSCA VISUAL NO BING (Backup ou Principal para Busca)
    // Se o método direto falhou ou se é uma página de busca
    if (!imageUrl && backupSearchTerm) {
        // Tenta buscar no Bing restringindo ao site da loja (ex: "vestido site:simplicity.com")
        let candidates = [];
        if (domain && !domain.includes('google')) {
             candidates = await fetchCandidatesFromBing(backupSearchTerm, domain);
        }
        
        // Se falhar, busca na web aberta
        if (candidates.length === 0) {
             candidates = await fetchCandidatesFromBing(backupSearchTerm, null);
        }

        if (candidates.length > 0) {
            // Seleciona o melhor candidato baseado na heurística (Top 1)
            imageUrl = candidates[0].url;
        }
    }

    // 3. LIMPEZA FINAL
    if (imageUrl) {
        imageUrl = imageUrl.replace(/&amp;/g, '&');
        if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
    }
    
    return imageUrl;
};
