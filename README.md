# Relatórios de Performance — T8M Energia Solar

Site estático com os relatórios de tráfego pago (Meta Ads) e orgânico (Instagram) da T8M.
Sem build e sem dependências — abre direto no navegador e publica na Vercel como está.

## Períodos disponíveis
O seletor **"Período ▾"** no topo de cada página troca entre os relatórios. Cada período fica
salvo/congelado em seu próprio arquivo, para o cliente conferir resultados antigos a qualquer momento.

| Arquivo | Período | Conteúdo |
|---|---|---|
| `index.html` | 15/jun – 20/jul (1º mês) | Meta Ads do mês + destaque das feiras agro |
| `relatorio-15-24-jun.html` | 15 – 24/jun (1ª semana) | Meta Ads + orgânico do Instagram |

`index.html` é sempre o relatório mais recente (o que abre por padrão no link).

## Publicar (GitHub + Vercel)
1. Suba todos os arquivos num repositório do GitHub.
2. Em vercel.com -> Add New -> Project -> Import o repositório.
3. Framework Preset = Other, Build Command e Output Directory em branco -> Deploy.
4. Sai a URL pública (ex.: t8mrelatoriometa.vercel.app) — o link responsivo para compartilhar.

Cada novo commit republica automaticamente.

## Adicionar um novo período (nos próximos meses)
1. Gere o novo relatório como relatorio-<periodo>.html.
2. Renomeie-o para index.html (vira o mais recente) e mova o antigo index.html para um nome com data.
3. Em TODOS os arquivos, adicione uma linha no menu do seletor (bloco .periodmenu):
   <a href="relatorio-<periodo>.html">Rótulo do período</a>

## Exportar PDF
O botão Exportar PDF usa a impressão nativa do navegador (offline). O PDF sai em tema claro
(fundo branco, texto escuro), legível e pronto para imprimir — a tela continua preta.
Na janela: Destino = Salvar como PDF; em Mais configurações, desmarque Cabeçalhos e rodapés; Salvar.
