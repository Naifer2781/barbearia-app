# Barbearia App

Web app (Next.js + Supabase, tema escuro/âmbar, responsiva) com 3 níveis:

| Rota | Quem | O que faz |
|---|---|---|
| `/` | Clientes (público) | Serviços/preços, promoções, marcação passo a passo, consultar/cancelar marcações, cartão de fidelidade |
| `/barbeiro` | Barbeiros (login) | A sua agenda do dia, Concluído/Faltou, encaixes, faturação e comissão |
| `/dono` | Dono (login) | Agenda geral + bloqueios, serviços, equipa/comissões, finanças, clientes, promoções, relatórios |
| `/entrar` | Equipa | Login / criar conta |

## Configuração
1. No Supabase › **SQL Editor**, cola e executa `supabase_setup.sql` (pode ser repetido).
2. Abre `/entrar` e **cria conta**: a primeira conta torna-se o **Dono**. Cada barbeiro cria a sua conta e o dono associa-a em *Painel do Dono › Equipa*.
3. Se o Supabase exigir confirmação de email, confirma-o (ou desativa em Authentication › Providers › Email).

A ligação ao Supabase tem fallback no código (`lib/supabase.ts`); podes sobrepor com `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ver `.env.example`).

## Desenvolvimento
```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```
