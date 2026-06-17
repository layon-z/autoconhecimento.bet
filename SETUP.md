# 🎰 AutoConhecimento.Bet — Guia de Instalação

Bolão de apostas fictícias da **Copa do Mundo 2026** entre amigos. Preto & vermelho,
saldo de R$ 50 fictícios pra cada um, odds automáticas, ranking e painel de admin.
Tudo **grátis** e hospedado na **Vercel**.

> Você não precisa saber programar. É só seguir os passos na ordem. ~20 minutos.

---

## ✅ Antes de começar — visão geral

Você vai criar 3 contas grátis e ligar uma na outra:
1. **Supabase** → o banco de dados (guarda jogadores, saldos e apostas)
2. **Vercel** → hospeda o site (o link que seus amigos acessam)
3. **football-data.org** → dados reais dos jogos *(opcional — sem ele, o site usa jogos de exemplo)*

---

## 1) Colocar a foto do EDU (logo) 📸

1. Salve a foto do Edu com o nome **`edu.jpg`**
2. Coloque ela dentro da pasta **`public/assets/`** do projeto
   (no lugar/junto do arquivo `logo.svg`)

Pronto — ela vira a logo do site automaticamente. Se faltar, aparece uma logo de reserva.

---

## 2) Criar o banco de dados (Supabase) 🗄️

1. Acesse **https://supabase.com** → **Start your project** → entre com o GitHub ou e-mail
2. Clique em **New project**. Dê um nome (ex: `autoconhecimento`), crie uma senha
   (anote em algum lugar) e clique em **Create new project**. Espere ~2 min.
3. No menu da esquerda, abra **SQL Editor** → **New query**
4. Abra o arquivo **`schema.sql`** deste projeto, copie **tudo**, cole ali e clique em **Run**
   (tem que aparecer "Success")
5. Agora pegue as chaves: menu **Project Settings (engrenagem)** → **API**. Anote:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - Em **Project API keys**, a chave **`service_role`** (clique em "reveal" pra ver).
     ⚠️ Essa chave é secreta — nunca poste em grupo nem coloque no site.

---

## 3) (Opcional) Dados reais da Copa ⚽

Sem isso o site já funciona com **jogos de exemplo**. Pra ter os jogos e placares reais:

1. Acesse **https://www.football-data.org/client/register** e cadastre-se (grátis)
2. Eles te mandam um **API token** por e-mail. Guarde.

---

## 4) Publicar na Vercel 🚀

### 4a. Subir o código pro GitHub
A forma mais fácil de publicar na Vercel é pelo GitHub:
1. Crie uma conta em **https://github.com** (se não tiver)
2. Crie um repositório novo (ex: `autoconhecimento-bet`)
3. Suba os arquivos deste projeto pra lá
   *(dá pra arrastar os arquivos pelo site do GitHub em "uploading an existing file",
   ou usar o GitHub Desktop)*

### 4b. Conectar na Vercel
1. Acesse **https://vercel.com** → entre com o **GitHub**
2. **Add New… → Project** → escolha o repositório `autoconhecimento-bet` → **Import**
3. **NÃO** clique em Deploy ainda. Abra **Environment Variables** e adicione (uma por uma):

| Name | Value |
|------|-------|
| `SUPABASE_URL` | a Project URL do Supabase |
| `SUPABASE_SERVICE_KEY` | a chave `service_role` do Supabase |
| `SESSION_SECRET` | invente uma frase longa e aleatória |
| `ADMIN_NAME` | `edu` (o nome que você vai usar no login pra ser admin) |
| `START_BALANCE` | `50` |
| `FOOTBALL_DATA_KEY` | o token do football-data *(deixe vazio se não fez o passo 3)* |

4. Clique em **Deploy** e espere terminar. Vai sair um link tipo
   `https://autoconhecimento-bet.vercel.app` — **esse é o site!** Manda pros amigos. 🎉

> O robô que paga as apostas (cron) já está configurado no `vercel.json` e roda sozinho
> a cada 10 minutos. Cron grátis na Vercel exige o plano Hobby (grátis) — já serve.

---

## 5) Virar admin 👑

Entre no site com o nome **`edu`** (igual ao `ADMIN_NAME`) e um PIN.
Essa conta vê a aba **🛠️ Admin** com o saldo e as estatísticas de todo mundo.

---

## 6) (Opcional) Usar o domínio `autoconhecimento.bet` 🌐

O endereço `.vercel.app` já funciona. Se quiser o `.bet` de verdade:
1. Compre o domínio `autoconhecimento.bet` (ex: Registro.br, GoDaddy, Namecheap)
2. Na Vercel: **Project → Settings → Domains → Add** e siga as instruções de DNS.

---

## ❓ Dúvidas comuns

- **"Banco de dados não configurado"** → faltou alguma variável no passo 4b, ou a
  `service_role` está errada. Confira e clique em **Redeploy** na Vercel.
- **Aparecem jogos de exemplo** → você não configurou o `FOOTBALL_DATA_KEY` (passo 3).
- **As apostas não foram pagas ainda** → o robô roda a cada 10 min, e só paga depois que
  o jogo termina. Dá pra forçar abrindo `…vercel.app/api/cron-settle` no navegador.
- **Quero mudar o saldo inicial** → mude a variável `START_BALANCE` e faça Redeploy
  (vale só pra quem entrar depois).

Divirtam-se! ⚫🔴⚽
