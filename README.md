# EduAnalytics · Jardim Interlagos

Aplicação estática de análise escolar. Os relatórios são interpretados no navegador; o conjunto consolidado, cobranças, calendários e histórico são sincronizados com Supabase após o login institucional.

## Nuvem

- Projeto Supabase: `djrumtxagxkmluuxbrfd`.
- Esquema idempotente e políticas RLS: [`supabase/schema.sql`](supabase/schema.sql).
- A tabela guarda um snapshot JSON do banco do aplicativo e impede acesso anônimo. As políticas permitem leitura e gravação somente para `cejardiminterlagos@nrecascavel.com`.
- A chave `sb_publishable_...` no cliente é pública por definição; o controle de acesso é feito por Auth e RLS. Nenhuma chave `secret` ou `service_role` fica no navegador.
- O arquivo CSV/XLSX/PDF original é processado no navegador e não é enviado como arquivo bruto; somente os dados interpretados e salvos no EduAnalytics vão para a tabela.

## Ativar login por link

No painel do Supabase, em **Authentication → URL Configuration**, defina o Site URL e inclua `https://eduanalytics-seven.vercel.app/` em Redirect URLs. O login usa link mágico para esse endereço.
