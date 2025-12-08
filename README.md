# VINGI MOLDES AI

Este é um sistema avançado de Inteligência Artificial para reconhecimento técnico de vestuário, engenharia reversa de moldes e curadoria de acervos globais.

## Funcionalidades

- **IA Vision 3.0:** Análise de fotos (Frente/Costas) para identificar DNA técnico (Silhueta, Gola, Manga, Tecido).
- **Galeria Massiva:** Retorna 50+ resultados de moldes reais.
- **Acervo Global:** Busca em Burda Style, Mood Fabrics, The Fold Line, Makerist, Etsy e acervos brasileiros.
- **Links Seguros:** Sistema inteligente que gera links de busca para evitar páginas 404.
- **PWA Nativo:** Instalável no celular (Android/iOS) com suporte a câmera e funcionamento em tela cheia.
- **Anti-Bloqueio:** Tecnologia de Proxy e Screenshot para exibir imagens reais mesmo de sites bloqueados.

## Como Rodar Localmente

1. Clone o repositório.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Crie um arquivo `.env` na raiz com sua chave:
   ```env
   API_KEY=Sua_Chave_Gemini_Aqui
   ```
4. Rode o projeto:
   ```bash
   npm run dev
   ```

## Como Publicar (Vercel)

1. Importe este repositório na Vercel.
2. Configure a variável de ambiente `API_KEY`.
3. Deploy.

---
Desenvolvido para uso interno profissional.
