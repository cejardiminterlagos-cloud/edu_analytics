# EduAnalytics 2.0 · Jardim Interlagos

Aplicação estática de acompanhamento escolar. A importação em lote reconhece relações por turma, frequência, confirmações e planilhas de cadastro ou documentos. Na conferência, o usuário pode revisar mudanças, corrigir o período, conferir vínculos por CGM ou aplicar as linhas identificadas e retomar as pendentes depois.

Os arquivos originais são lidos no navegador. O histórico guarda a identificação do lote, a origem das mudanças e os campos necessários à revisão. Na ficha do estudante, a frequência, os documentos, as cobranças, as etiquetas de apoio e o histórico ficam em seções separadas.

## Nuvem

- Projeto Supabase: `djrumtxagxkmluuxbrfd`.
- Esquema idempotente e políticas RLS: [`supabase/schema.sql`](supabase/schema.sql).
- A tabela guarda o estado consolidado em JSON. A sincronização envia os estudantes e campos alterados para a função `edu_analytics_patch_state`, que aplica o conjunto em uma única transação e exige a revisão atual. As políticas permitem leitura e gravação somente para `cejardiminterlagos@nrecascavel.com`.
- A chave `sb_publishable_...` no cliente é pública por definição; o controle de acesso é feito por Auth e RLS. Nenhuma chave `secret` ou `service_role` fica no navegador.
- O arquivo CSV/XLSX/PDF original é processado no navegador e não é enviado como arquivo bruto; somente os dados interpretados e salvos no EduAnalytics vão para a tabela.
- Se estiver sem conexão, é possível continuar neste navegador; o painel marca as alterações como não sincronizadas e permite tentar novamente depois.

## Primeiro acesso e login

O usuário é `cejardiminterlagos@nrecascavel.com`. Em **Primeiro acesso? Criar usuário**, cadastre uma senha com pelo menos 8 caracteres e confirme o e-mail; nos próximos acessos, use **Entrar** com e-mail e senha.

No painel do Supabase, em **Authentication → URL Configuration**, defina o Site URL e inclua `https://eduanalytics-seven.vercel.app/` em Redirect URLs para que a confirmação do primeiro cadastro retorne ao app.
