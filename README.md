# Relatório de Performance — T8M Energia Solar

Relatório estático (Meta Ads + Orgânico do Instagram) referente ao período de **15–24 de junho de 2026**.
É um site de uma página só (`index.html`), sem build e sem dependências de servidor.

## Estrutura
```
.
├── index.html      → o relatório (abre direto no navegador)
├── vercel.json     → configuração estática da Vercel
├── .gitignore
└── README.md
```

## Como publicar (GitHub + Vercel)

### Opção A — pelo site do GitHub (sem terminal)
1. Em https://github.com/new, crie um repositório (ex.: `t8m-relatorio-meta`). Pode deixar **privado**.
2. Na página do repositório vazio, clique em **"uploading an existing file"**.
3. Arraste os arquivos desta pasta (`index.html`, `vercel.json`, `.gitignore`, `README.md`) e clique em **Commit changes**.
4. Acesse https://vercel.com → **Add New… → Project → Import** o repositório.
5. Em *Framework Preset* selecione **Other**, deixe **Build Command** e **Output Directory** em branco, e clique em **Deploy**.
6. Em ~30s a Vercel gera a URL pública (ex.: `t8m-relatorio-meta.vercel.app`).

### Opção B — pelo terminal (Git)
```bash
git init
git add .
git commit -m "Relatório T8M 15-24 jun 2026"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/t8m-relatorio-meta.git
git push -u origin main
```
Depois importe o repositório na Vercel (passos 4–6 da Opção A).

## Atualizar o relatório
Substitua o `index.html` por uma versão nova e faça novo commit/upload — a Vercel republica sozinha a cada push.

## Exportar PDF
O botão **Exportar PDF** usa a impressão nativa do navegador (sem dependências externas — funciona offline).
Ao clicar, na janela que abrir:
1. Em **Destino**, escolha **Salvar como PDF**.
2. Abra **Mais configurações** e ative **Gráficos de segundo plano** (garante o fundo preto).
3. Clique em **Salvar**.

O texto sai vetorial (nítido) e os gráficos são preservados.
