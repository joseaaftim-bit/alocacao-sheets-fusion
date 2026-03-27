# Alocação Sheets Fusion - Guia de Publicação

Este projeto está pronto para ser publicado no **GitHub** e hospedado no **Railway**.

## 🛑 IMPORTANTE: Segurança das Credenciais
Os seguintes arquivos foram ignorados pelo `.gitignore` e **NÃO** devem ser enviados para o GitHub:
- `credentials.json`
- `token.json`
- `.env`

## 🚀 Passo a Passo para Publicação

### 1. Criar Repositório no GitHub
1. Abra seu GitHub e crie um repositório vazio (privado de preferência).
2. Na pasta do projeto, rode os comandos:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Sheets Fusion"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```

### 2. Configurar no Railway
1. Crie um novo projeto no Railway e conecte seu repositório do GitHub.
2. Vá em **Variables** e adicione as seguintes:
   - `PORT`: `3000` (ou deixe o Railway definir)
   - `SPREADSHEET_ID`: (O ID da sua planilha Google)
   - `GOOGLE_TOKEN_JSON`: (COPIE e COLE o conteúdo completo do seu arquivo `token.json` local aqui)

### 3. Atualizar Redirecionamento de Auth (Google Console)
1. Pegue a URL que o Railway gerar (ex: `https://meu-app.railway.app`).
2. Vá no [Google Cloud Console](https://console.cloud.google.com/) > Credenciais > OAuth 2.0 Client IDs.
3. Adicione `https://meu-app.railway.app/auth/callback` em **Authorized Redirect URIs**.

## 🛠️ Tecnologias
- **Frontend**: Vite + Vanilla JS
- **Backend**: Node.js + Express
- **BD**: Google Sheets API v4
