# WEDDING LIVE MOMENTS
## Plataforma privada de partilha de fotos em tempo real

> Use este documento como especificação para uma IA/agente de programação desenvolver um MVP funcional, seguro, responsivo e preparado para produção.

# 1. Objetivo

Criar uma plataforma web para o casamento onde o convidado:

```text
QR Code da mesa
      ↓
Página do casamento
      ↓
Tira/seleciona foto
      ↓
Escreve nome/mensagem opcional
      ↓
Upload
      ↓
MinIO
      ↓
Fila de moderação
      ↓
Admin aprova
      ↓
WebSocket
      ↓
Foto aparece automaticamente nas TVs
```

Não exigir aplicativo, cadastro ou login dos convidados.

A experiência deve ser premium, simples e **mobile-first**.

---

# 2. Stack

Preferencialmente:

- Next.js + React + TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide Icons
- Node.js
- PostgreSQL
- Prisma ORM
- Socket.IO/WebSockets
- MinIO/S3 já existente
- Docker

React + Vite poderá ser utilizado se houver vantagem técnica.

O sistema deve funcionar atrás de Nginx, Traefik, Caddy, Cloudflare ou Coolify.

---

# 3. MinIO existente

**NÃO instalar MinIO.**

O servidor MinIO já existe. A aplicação apenas receberá as configurações pelo `.env`.

```env
APP_NAME=Wedding Live Moments
APP_URL=https://momentos.exemplo.com
NODE_ENV=production

DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/weddingmoments

JWT_SECRET=CHANGE_ME
SESSION_SECRET=CHANGE_ME

S3_ENDPOINT=
S3_PORT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
S3_REGION=
S3_USE_SSL=true
S3_PUBLIC_URL=

MAX_IMAGE_SIZE_MB=15
MAX_VIDEO_SIZE_MB=100

SOCKET_URL=
ADMIN_EMAIL=
```

Criar `.env.example`, validar variáveis obrigatórias no startup e nunca colocar secrets no código.

Preferencialmente manter bucket privado e usar Signed/Presigned URLs.

Estrutura sugerida:

```text
events/
   event-id/
      moments/
         2026/
            08/
               uuid.webp
      thumbnails/
               uuid.webp
      branding/
               logo.webp
               cover.webp
```

Usar UUID, não o nome original do arquivo.

---

# 4. Áreas da plataforma

Criar quatro experiências:

### Convidado
Interface acessada pelo QR Code.

### Admin
Moderação e gestão do casamento.

### Live Wall
Página fullscreen exibida nas TVs/projetores/painéis LED.

### Galeria
Todos os momentos aprovados.

---

# 5. QR Codes

Cada mesa terá QR próprio:

```text
/e/casamento-ekson/m/01
/e/casamento-ekson/m/02
/e/casamento-ekson/m/03
```

O sistema identifica automaticamente evento e mesa.

Também criar QR geral:

```text
/e/casamento-ekson
```

com origem `general`.

Admin deve gerar QR em:

- PNG
- SVG

E permitir cartão pronto para impressão:

```text
❤️

PARTILHE ESTE MOMENTO

Tire uma fotografia,
partilhe connosco
e veja-a no nosso mural.

       [ QR ]

       MESA 08

#NossoGrandeDia
```

---

# 6. Interface do convidado

Exemplo:

```text
❤️

EKSON
&
NOME DA NOIVA

O Nosso Grande Dia

Ajude-nos a guardar este momento.

[ PARTILHAR UM MOMENTO ]

Mesa 08
```

Ao tocar:

```text
📷 Tirar fotografia
🖼️ Escolher da galeria
```

Depois:

```text
[FOTO / PREVIEW]

Seu nome
(opcional)

Mensagem para os noivos
(opcional)

Mesa 08
(automático)

[ PUBLICAR MOMENTO ]
```

Mostrar progresso real:

```text
A enviar o seu momento...

████████░░ 82%
```

Sucesso:

```text
❤️ Momento recebido!

Obrigado por fazer parte da nossa história.

A sua fotografia será adicionada ao nosso mural.

[ PARTILHAR OUTRO MOMENTO ]
```

Se falhar:

```text
Não conseguimos concluir o envio.

[ TENTAR NOVAMENTE ]
```

Preservar foto, nome e mensagem quando tecnicamente possível.

---

# 7. Otimização das imagens

Implementar compressão client-side quando possível.

Uma foto de aproximadamente:

```text
8 MB
```

poderá ser reduzida para aproximadamente:

```text
1–2 MB
```

mantendo qualidade adequada.

Gerar quando necessário:

```text
thumbnail
medium
original/optimized
```

Usar lazy loading, cache, thumbnails, retries e preloading.

A solução deve funcionar bem em conexões móveis como Vodacom, Movitel e Tmcel e no Wi-Fi do salão.

---

# 8. Upload seguro

Aceitar inicialmente:

```text
image/jpeg
image/png
image/webp
```

Validar:

- MIME;
- extensão;
- tamanho;
- evento ativo;
- token/origem;
- quantidade de uploads;
- arquivos malformados.

Nunca confiar apenas na extensão.

Rate limit inicial configurável:

```text
10 uploads / 5 minutos / dispositivo-IP
```

Evitar prejudicar convidados legítimos usando a mesma rede Wi-Fi.

Se for necessário identificar IP para anti-spam:

```text
SHA256(IP + SECRET)
```

Não guardar IP puro desnecessariamente.

---

# 9. Moderação

Nenhuma fotografia aparece automaticamente no mural por padrão.

```text
UPLOAD
   ↓
PENDING
   ↓
ADMIN
   ├── APPROVED → LIVE WALL
   └── REJECTED
```

O admin deve permitir:

- visualizar;
- aprovar;
- rejeitar;
- aprovar várias;
- rejeitar várias;
- destacar na tela.

---

# 10. Dashboard

Rota:

```text
/admin
```

Login obrigatório.

Exemplo:

```text
Wedding Live Moments

243 Momentos recebidos
31 Pendentes
198 Aprovados
14 Rejeitados
```

Menu:

```text
Dashboard
Moderação
Galeria
Livro de Visitas
Telas
Mesas & QR Codes
Estatísticas
Configurações
```

O admin deve ser totalmente utilizável em smartphone/tablet.

---

# 11. Live Wall

Rota:

```text
/e/:eventSlug/live
```

Compatível com Full HD, 4K, projetores e painéis LED.

Exemplo:

```text
────────────────────────────

       EKSON & NOIVA
     O NOSSO GRANDE DIA

────────────────────────────

          [ FOTO ]

 "Felicidades ao casal ❤️"

          — Ana
         Mesa 08

────────────────────────────

  243 momentos partilhados

      #NossoGrandeDia
```

Slideshow:

```text
Foto: 8 segundos
Transição: 1 segundo
```

Transições discretas:

- fade;
- subtle zoom;
- slide;
- dissolve.

Também criar modo mosaico:

```text
┌────────┬────────┬────────┐
│ FOTO 1 │ FOTO 2 │ FOTO 3 │
├────────┼────────┼────────┤
│ FOTO 4 │ FOTO 5 │ FOTO 6 │
├────────┼────────┼────────┤
│ FOTO 7 │ FOTO 8 │ FOTO 9 │
└────────┴────────┴────────┘
```

Modos:

```text
Slideshow
Mosaico
Destaques
Últimos momentos
```

---

# 12. Tempo real

Quando o admin aprovar:

```text
Admin
 ↓
Backend
 ↓
PostgreSQL
 ↓
WebSocket
 ↓
Live Wall
```

Sem refresh manual.

Eventos previstos:

```text
moment.created
moment.approved
moment.rejected

wall.next
wall.previous
wall.pause
wall.play
wall.mode.changed
wall.highlight

stats.updated
```

Se WebSocket cair:

- reconectar automaticamente;
- sincronizar estado por API;
- continuar exibindo conteúdo cacheado.

Exemplo:

```text
GET /api/events/:id/live-state
```

Pré-carregar as próximas imagens:

```text
CURRENT
 ↓
NEXT 1 cached
NEXT 2 cached
NEXT 3 cached
```

---

# 13. Controle da tela

Admin:

```text
▶ Iniciar
⏸ Pausar
⏭ Próxima
⏮ Anterior
⭐ Destacar
🔲 Mosaico
🖼 Slideshow
```

Os comandos são enviados em tempo real.

O botão:

```text
DESTACAR NA TELA
```

deve mostrar imediatamente determinada fotografia, útil para entrada dos noivos, brinde, bolo, dança ou família.

---

# 14. Galeria

Rota:

```text
/e/:eventSlug/gallery
```

Mostrar somente momentos aprovados.

```text
GALERIA DO NOSSO GRANDE DIA

[foto] [foto] [foto]
[foto] [foto] [foto]
[foto] [foto] [foto]
```

Ao abrir:

```text
[FOTO]

"Que sejam muito felizes ❤️"

Ana
Mesa 08

❤️ 17
```

Likes são opcionais no MVP, mas preparar arquitetura.

---

# 15. Livro de visitas

Permitir também:

```text
💌 DEIXAR UMA MENSAGEM
```

Sem fotografia obrigatória.

```text
Seu nome

Mensagem

[ ENVIAR ]
```

Guardar como livro de visitas digital e permitir exportação posterior.

---

# 16. Banco de dados

Não prender a arquitetura a um único casamento.

## User

```text
id
name
email
password_hash
role
created_at
updated_at
```

Roles:

```text
super_admin
event_admin
moderator
```

## Event

```text
id
name
slug
event_type
couple_name_1
couple_name_2
event_date
hashtag
logo_url
cover_url
primary_color
secondary_color
is_active
created_at
updated_at
```

## Table

```text
id
event_id
number
name
qr_token
created_at
```

## Moment

```text
id
event_id
table_id
guest_name
message
media_type
storage_key
thumbnail_key
status
created_at
approved_at
approved_by
```

Status:

```text
pending
approved
rejected
```

## GuestMessage

```text
id
event_id
table_id
guest_name
message
status
created_at
```

## Reaction

```text
id
moment_id
visitor_hash
type
created_at
```

Relacionamentos:

```text
EVENT
 ├── TABLES
 ├── MOMENTS
 ├── GUEST_MESSAGES
 └── USERS

MOMENT
 └── REACTIONS
```

---

# 17. APIs

Exemplos:

```text
GET    /api/events/:slug
POST   /api/events/:id/moments
GET    /api/events/:id/moments
GET    /api/events/:id/moments/pending

PATCH  /api/moments/:id/approve
PATCH  /api/moments/:id/reject

GET    /api/events/:id/gallery
POST   /api/events/:id/messages
GET    /api/events/:id/stats
```

---

# 18. Autenticação e segurança

Convidado:

```text
sem login
```

Admin:

```text
login obrigatório
```

Implementar:

- Argon2 ou bcrypt;
- cookies HttpOnly quando possível;
- Secure em produção;
- SameSite;
- expiração de sessão;
- CSRF conforme arquitetura;
- validação de inputs.

Nunca expor credenciais MinIO no frontend.

---

# 19. Personalização

Admin poderá alterar:

```text
Nome do evento
Nome dos noivos
Data
Hashtag
Logo
Foto de capa
Cor principal
Cor secundária
Mensagem de boas-vindas
```

Design:

```text
Premium
Romântico
Minimalista
Elegante
Moderno
```

Evitar aparência genérica de dashboard produzido por IA.

---

# 20. Estatísticas

Dashboard:

```text
Momentos recebidos
Momentos aprovados
Momentos rejeitados
Mensagens
Total de fotografias
Mesa mais ativa
Uploads por hora
```

---

# 21. Exportação

Criar:

```text
EXPORTAR EVENTO
```

Incluindo:

```text
Fotografias
Mensagens
CSV de momentos
CSV de mensagens
```

Para muitas fotos, gerar ZIP através de background job em vez de montar tudo no navegador.

---

# 22. Health Check e logs

Criar:

```text
/api/health
```

Resposta:

```json
{
  "status": "ok",
  "database": "connected",
  "storage": "connected"
}
```

Registrar:

```text
upload iniciado/concluído/falhou
momento aprovado/rejeitado
login administrativo
erro MinIO
erro database
erro websocket
```

Nunca registrar:

```text
password
JWT
S3_SECRET_KEY
presigned URLs completos
```

---

# 23. Docker

Criar:

```text
Dockerfile
docker-compose.yml
.env.example
```

**Não adicionar serviço MinIO ao Docker Compose.**

O PostgreSQL poderá ser criado pelo Compose, mas também deve aceitar banco externo via:

```env
DATABASE_URL=
```

---

# 24. Estrutura sugerida

```text
src/
  app/
  components/
      guest/
      admin/
      live/
      gallery/
      shared/

  services/
      storage/
      realtime/
      auth/
      uploads/

  lib/
      db/
      minio/
      websocket/
      security/

  hooks/
  types/
  utils/

prisma/
   schema.prisma

public/
docker/

.env.example
Dockerfile
docker-compose.yml
README.md
```

A IA poderá melhorar a estrutura quando houver justificativa técnica.

---

# 25. MVP

## Prioridade 1 — obrigatório

```text
Event
Mesas
QR Code
Upload
MinIO
PostgreSQL
Admin
Moderação
Aprovação
Galeria
WebSocket
Live Screen
Slideshow
Docker
```

## Prioridade 2

```text
Mensagens
Mosaico
Controle remoto
Estatísticas
Personalização
Exportação
```

## Prioridade 3

```text
Likes
Vídeos
IA
Photo Mosaic
SaaS
```

---

# 26. Futuro

Preparar arquitetura para:

- vídeos MP4/MOV/WebM;
- detecção de conteúdo inadequado;
- duplicados;
- classificação automática;
- melhores fotos;
- legendas por IA;
- mosaico formado por centenas de fotos;
- transformação em SaaS para casamentos, aniversários, conferências, formaturas e eventos empresariais.

Não tornar essas funções obrigatórias para o primeiro MVP.

---

# 27. Testes obrigatórios

Testar:

```text
Upload Android
Upload iPhone
Câmera
Galeria
Imagem grande
Internet lenta
Upload interrompido
Upload duplicado
QR válido/inválido
Evento inexistente/desativado
Login admin
Aprovação/rejeição
WebSocket reconnect
Live Screen
MinIO indisponível
PostgreSQL indisponível
Docker/build
```

---

# 28. Fases de desenvolvimento

## Fase 1 — Fundação

```text
Projeto
Docker
PostgreSQL
Prisma
MinIO client
.env
Auth
Estrutura base
```

## Fase 2 — Eventos

```text
Event CRUD
Tables CRUD
QR generation
Event settings
```

## Fase 3 — Convidados

```text
QR landing page
Upload
Preview
Compressão
Progress
MinIO
Moment creation
Success screen
```

## Fase 4 — Administração

```text
Dashboard
Pending moments
Approve/Reject
Bulk actions
Gallery management
```

## Fase 5 — Tempo real

```text
WebSockets
moment.created
moment.approved
wall updates
reconnect
```

## Fase 6 — Live Wall

```text
Fullscreen
Slideshow
Preloading
Transitions
Mosaic
New moment
```

## Fase 7 — Extras

```text
Guestbook
Stats
Remote controls
Export
Customization
```

## Fase 8 — Produção

```text
Security audit
Performance test
Mobile test
Upload test
WebSocket test
MinIO test
Database test
Docker test
Production build
```

Ao finalizar cada fase:

1. testar;
2. corrigir erros;
3. executar TypeScript/lint/build;
4. informar arquivos criados/modificados;
5. explicar como testar;
6. somente depois avançar.

---

# 29. Regras para o agente de IA

Não faça apenas protótipos visuais.

Não deixe botões sem funcionalidade.

Não use dados falsos como implementação final.

Não use `localStorage` como banco principal.

Não armazene imagens no PostgreSQL.

Não crie outro MinIO.

Não exponha secrets no frontend.

Não coloque credenciais diretamente no código.

Utilize TypeScript corretamente e evite `any` desnecessário.

Implemente loading, empty e error states.

Antes de programar, apresente:

1. arquitetura escolhida;
2. estrutura de diretórios;
3. schema PostgreSQL/Prisma;
4. fluxo MinIO;
5. fluxo WebSocket;
6. autenticação;
7. estratégia de upload;
8. plano de implementação.

Depois comece pela **FASE 1**.

---

# 30. Critério de conclusão

O MVP só estará concluído quando isto funcionar:

```text
CONVIDADO
    ↓
ESCANEIA QR DA MESA 08
    ↓
ABRE SITE
    ↓
TIRA FOTO
    ↓
ESCREVE "Felicidades ❤️"
    ↓
UPLOAD
    ↓
MINIO
    ↓
POSTGRESQL
    ↓
ADMIN RECEBE
    ↓
ADMIN APROVA
    ↓
WEBSOCKET
    ↓
TV RECEBE
    ↓
FOTO APARECE NO SLIDESHOW
```

Tudo sem:

```text
refresh manual
instalação de aplicativo
cadastro do convidado
intervenção técnica
```

A experiência final desejada é simples:

> **“Eu tirei uma fotografia no meu telefone e poucos segundos depois ela apareceu na tela gigante do casamento.”**

No final, os noivos devem ter uma galeria privada com as fotografias espontâneas, mensagens dos convidados, identificação das mesas e todo o conteúdo armazenado no MinIO.

**INSTRUÇÃO FINAL AO AGENTE:** construa uma aplicação real destinada a produção. O MinIO já está instalado e operacional em infraestrutura externa; apenas integre-o através das variáveis de ambiente fornecidas.