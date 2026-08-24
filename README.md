# Wedding Live Moments

Plataforma privada de partilha de fotos em tempo real para casamentos. Um único QR Code leva o convidado direto à página de envio — tira/escolhe uma fotografia, e após aprovação do admin ela aparece automaticamente no mural (Live Wall) exibido nas TVs do evento.

## Stack

- **client/** — React + Vite + TypeScript + Tailwind CSS + React Router + Socket.IO client. Projeto e container **totalmente independentes** (`client/Dockerfile`, `client/docker-compose.yml`) — deploy na Vercel ou em qualquer host Docker (ex: outro serviço no Coolify).
- **server/** — Node.js + Express + TypeScript + Socket.IO + MinIO/Supabase Storage (via AWS S3 SDK) + **Supabase** (`@supabase/supabase-js`) para base de dados e autenticação do admin. Projeto e container **totalmente independentes** (`server/Dockerfile`, `server/docker-compose.yml`) — deploy num VPS/Coolify.

Frontend e backend são dois projetos e dois containers separados, cada um com o seu próprio `.env`/`Dockerfile`/`docker-compose.yml`, normalmente em domínios diferentes — o client fala com a API via `VITE_API_URL` (cross-origin, com cookies `SameSite=None; Secure`). Isto exige HTTPS dos dois lados em produção.

O backend nunca acede ao Postgres diretamente: todas as leituras/escritas passam pelo `supabaseAdmin` (chave *service role*), e o login do admin usa o Supabase Auth. As tabelas têm Row Level Security ativa sem políticas — só a service role (usada exclusivamente pelo backend) consegue ler/escrever, mesmo que a chave anon algum dia vaze.

## Pré-requisitos

- Node.js 20+
- Um projeto Supabase (grátis em [supabase.com](https://supabase.com))
- Um bucket S3-compatível para as fotos — MinIO próprio ou o Storage do próprio Supabase (ambos funcionam, ver `S3_*` abaixo).

## Configuração do Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor** no painel do projeto, cole o conteúdo de [server/supabase/schema.sql](server/supabase/schema.sql) e execute — isto cria as tabelas (`events`, `tables`, `moments`, `guest_messages`, `reactions`, `event_admins`) com RLS ativa.
3. Em **Project Settings → API**, copie:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (nunca exponha esta no frontend)
4. Copie `server/.env.example` para `server/.env` e preencha essas três variáveis, mais `S3_*`, `DEVICE_HASH_SECRET`, etc.

Não é preciso criar utilizadores admin manualmente — o `npm run seed` (abaixo) cria o primeiro admin diretamente no Supabase Auth.

## Desenvolvimento local

Localmente client e server continuam a correr juntos como um único origin via o proxy do Vite — nada disto muda por causa do deploy separado.

```bash
# Backend
cd server
npm install
npm run seed                # cria admin (Supabase Auth) + evento de exemplo + mesas 01-03
npm run dev                 # http://localhost:4000

# Frontend (noutro terminal)
cd client
npm install
npm run dev                 # http://localhost:5173 (proxy para /api e /socket.io)
```

O `npm run seed` cria:

- Um admin no Supabase Auth (`ADMIN_EMAIL` / `ADMIN_PASSWORD` do `.env`, por omissão `admin@example.com` / `changeme123`)
- Um evento de exemplo `casamento-ekson` (Ekson & Palmira) com as mesas `01`, `02`, `03` (opcionais — ver abaixo)

Aceda como convidado em `http://localhost:5173/e/casamento-ekson` e ao admin em `http://localhost:5173/admin/login`.

## Um único QR Code para todos

O convidado nunca precisa de saber o número da mesa. O admin (`/admin/tables`, menu "QR Code") mostra **um QR geral do evento** — é esse que deve ser impresso e colocado nas mesas/entrada. Apontar a câmara leva direto a `/e/:slug`, com a opção de tirar foto ou escolher várias da galeria de uma vez.

O sistema de mesas continua a existir no schema (é opcional): se quiser saber "qual mesa partilhou mais fotos" nas Estatísticas, pode criar mesas e usar QR Codes por mesa (`/e/:slug/m/:numero`) em vez do geral — mas isso é um extra, não é necessário para o fluxo principal.

### Testar o QR Code com o telemóvel em dev (na mesma Wi-Fi)

1. Descubra o IP local do seu computador na rede Wi-Fi (`ipconfig` no Windows, procure "IPv4 Address" — ex: `192.168.1.57`).
2. No `server/.env`, defina `APP_URL` e `CLIENT_URL` para `http://SEU_IP:5173`.
3. Reinicie `npm run dev` no `server/`. O Vite já corre com `host: true`.
4. Abra `http://SEU_IP:5173/admin/tables` no telemóvel (mesma Wi-Fi), veja o QR geral e aponte a câmara.

Se o firewall do Windows bloquear, autorize o Node.js/portas 5173 e 4000 para redes privadas quando aparecer o prompt.

## Produção: dois projetos, dois containers

`client/` e `server/` são completamente independentes — cada um tem o seu próprio `Dockerfile`, `docker-compose.yml`, `.dockerignore` e `.env`. Nenhum dos dois depende de estar dentro do mesmo repositório clonado, do mesmo host ou de correr ao mesmo tempo para ser construído.

Precisa de **dois domínios**, cada um com o seu HTTPS:

| Domínio | Para quê | Exemplo |
|---|---|---|
| **Frontend** | O que os convidados e o admin abrem | `momentos.seudominio.com` |
| **API** | O backend — nunca é aberto diretamente por ninguém | `api.seudominio.com` |

### 1. API (`server/`) no Coolify

1. **New Resource → Application**, aponte para este repositório com **Base Directory = `server`** (é aí que estão o `Dockerfile` e o `docker-compose.yml` deste projeto).
2. Em **Port**, defina `4100` (tem de bater certo com `PORT` nas variáveis, passo 5).
3. Em **Health Check**, use o caminho `/api/health` — o `Dockerfile` já tem um `HEALTHCHECK` embutido, mas configurar aqui também ajuda o Coolify a saber quando o deploy está pronto.
4. Em **Domains**, associe o domínio da API (ex: `api.seudominio.com`) — o Coolify emite o certificado SSL sozinho (Let's Encrypt).
5. Em **Environment Variables**, copie o conteúdo de `server/.env.example` e preencha:
   - `APP_URL` e `CLIENT_URL` = o domínio do **frontend** (passo 2 — pode voltar aqui depois de saber o domínio final)
   - `PORT=4100`
   - `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
   - `DEVICE_HASH_SECRET` (gere um valor aleatório, ex: `openssl rand -hex 32`)
   - `S3_*` (as credenciais do storage)
6. Deploy. Depois de estar no ar, corra o seed uma vez (terminal do Coolify para este serviço, ou `docker exec` no container):
   ```bash
   npm run seed
   ```

Ou manualmente, sem a UI do Coolify:

```bash
cd server
cp .env.example .env
# preencha como no passo 5 acima
docker compose up --build
```

### 2. Frontend (`client/`) — Vercel ou Docker

**Opção A — Vercel** (mais simples, não usa `client/Dockerfile`):

1. Importe o repositório no Vercel, com **Root Directory = `client`**.
2. Framework preset: Vite (auto-detetado). Build command e output dir ficam nos valores padrão.
3. Associe o domínio do frontend ao projeto (**Settings → Domains**).
4. Em **Environment Variables**, adicione `VITE_API_URL = https://api.seudominio.com` (o domínio da API do passo 1, sem barra final).
5. Deploy. O `client/vercel.json` já garante que rotas como `/e/casamento-ekson` ou `/admin` não dão 404 ao atualizar a página (SPA rewrite).

**Opção B — Docker** (ex: outro serviço no Coolify, ou qualquer host Docker), usando `client/Dockerfile` + `client/docker-compose.yml` (serve os ficheiros estáticos via Nginx, já com fallback de SPA em `client/nginx.conf`):

> ⚠️ O Vite grava `VITE_API_URL` dentro do JavaScript compilado **durante o build** — não é uma variável de runtime do container. Se mudar o domínio da API depois, tem de reconstruir a imagem, não basta reiniciar o container.

1. Copie `client/.env.example` para `client/.env` e defina `VITE_API_URL=https://api.seudominio.com`.
2. No Coolify: **New Resource → Application**, **Base Directory = `client`**, **Port = `80`**. Sem "Environment Variables" de runtime — o `docker-compose.yml` já passa `VITE_API_URL` como *build arg* lido do `client/.env`.
3. Associe o domínio do frontend, deploy.

Ou manualmente:

```bash
cd client
cp .env.example .env
# preencha VITE_API_URL
docker compose up --build   # http://localhost:8080
```

Depois de saber o domínio final do frontend (Vercel ou Docker), volte ao `server/.env`/Coolify e confirme que `APP_URL`/`CLIENT_URL` batem certo — se mudar depois, tem de atualizar e fazer redeploy da API.

### ⚠️ Aviso: Safari/iOS e cookies cross-origin

Como a API vive num domínio diferente do frontend, os cookies (sessão do admin e o cookie de rate-limit do convidado) são tecnicamente "de terceiros" do ponto de vista do browser. O Chrome/Edge/Firefox aceitam isto normalmente com `SameSite=None; Secure` (já configurado), mas o **Safari bloqueia cookies de terceiros por omissão** — o que pode impedir o login do admin em iPhone/Mac com Safari.

Isto não afeta os convidados (eles não fazem login), só quem gere o painel `/admin`. Se isso for um problema na prática:
- Mais simples: gerir o admin a partir do Chrome/Edge em vez de Safari.
- Mais robusto (não implementado aqui): configurar um *reverse proxy* na frente do frontend para `/api/*` e `/socket.io/*` apontarem para a API (um `rewrite` no Vercel, ou uma regra extra no Nginx do `client/Dockerfile` se for pela Opção B), fazendo tudo parecer o mesmo domínio do ponto de vista do browser. Se precisar disto, avise — implica validar que o Socket.IO consegue manter WebSocket através desse proxy (ou cai para long-polling).

## Fluxo ponta-a-ponta

```
Convidado escaneia o QR geral (aponta para o domínio do frontend)
  → /e/:slug → tira/escolhe fotos (uma ou várias) → escreve mensagem
  → upload para a API (compressão client-side + processamento server-side)
  → gravado no storage com UUID + registo "pending" no Supabase
  → admin recebe em tempo real (Socket.IO) na Moderação
  → admin aprova
  → Socket.IO emite moment.approved
  → Live Wall atualiza sem refresh
```

## Rotas principais

| Rota | Descrição |
|---|---|
| `/e/:slug` | Página do convidado — o QR único aponta aqui |
| `/e/:slug/m/:tableNumber` | Página do convidado com mesa pré-associada (opcional) |
| `/e/:slug/guestbook` | Livro de visitas (mensagem sem foto) |
| `/e/:slug/gallery` | Galeria pública (momentos aprovados) |
| `/e/:slug/live` | Live Wall (fullscreen, para TVs) |
| `/admin/login` | Login administrativo |
| `/admin` | Dashboard, Moderação, Galeria, Livro de Visitas, Telas, QR Code, Estatísticas, Configurações |

## Segurança

- Convidado: sem login/cadastro. Rate limit de uploads por dispositivo+IP (hash SHA-256, nunca o IP em texto plano).
- Admin: Supabase Auth (cookies HttpOnly com o access/refresh token).
- Dados: Row Level Security ativa em todas as tabelas — só a service role (backend) lhes acede.
- Uploads validados por MIME, assinatura real do ficheiro (magic bytes), tamanho e evento ativo.
- Bucket privado por omissão — URLs assinadas (presigned) com expiração.
- `/api/health` reporta o estado da base de dados e do storage sem expor segredos.

## Nota sobre a versão do AWS SDK

`@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner` estão fixados em `3.999.0` (sem `^`) porque, no momento em que este projeto foi criado, a versão mais recente publicada tinha uma dependência interna (`@aws-sdk/core`) ainda não disponível no registo do npm — instalar falhava. Pode tentar atualizar para a mais recente mais tarde; se `npm install` voltar a falhar com um erro `ETARGET` sobre `@aws-sdk/core`, é o mesmo problema a repetir-se.

## O que falta para além do MVP

Vídeos, deteção de conteúdo inadequado/duplicados, e transformação em SaaS multi-evento estão fora do escopo deste MVP (ver seção 26 da especificação), mas o schema (multi-evento desde o início) já não bloqueia essa evolução.
