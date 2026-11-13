# EduAnalytics 2.0 · Jardim Interlagos

Aplicação estática de acompanhamento escolar. A importação em lote reconhece relações por turma, frequência, confirmações e planilhas de cadastro ou documentos. Na conferência, o usuário pode revisar mudanças, corrigir o período, conferir vínculos por CGM ou aplicar as linhas identificadas e retomar as pendentes depois.

Os arquivos originais são lidos no navegador. O histórico guarda a identificação do lote, a origem das mudanças e os campos necessários à revisão. Na ficha do estudante, a frequência, os documentos, as cobranças, as etiquetas de apoio e o histórico ficam em seções separadas.

## Nuvem

- Projeto Supabase: `djrumtxagxkmluuxbrfd`.
- Esquema idempotente e políticas RLS: [`supabase/schema.sql`](supabase/schema.sql).
- O estado cadastral continua em JSON; notas e vínculos por ano ficam nas tabelas `edu_grades` e `edu_grade_enrollments`, definidas em `supabase/grades.sql`. A função `edu_analytics_patch_v2` grava alterações cadastrais e somente as notas alteradas em uma transação, exigindo a revisão atual. As políticas permitem leitura e gravação somente para `cejardiminterlagos@nrecascavel.com`.
- A chave `sb_publishable_...` no cliente é pública por definição; o controle de acesso é feito por Auth e RLS. Nenhuma chave `secret` ou `service_role` fica no navegador.
- O arquivo CSV/XLSX/PDF original é processado no navegador e não é enviado como arquivo bruto; somente os dados interpretados e salvos no EduAnalytics vão para a tabela.
- Se estiver sem conexão, é possível continuar neste navegador; o painel marca as alterações como não sincronizadas e permite tentar novamente depois.

## Primeiro acesso e login

O usuário é `cejardiminterlagos@nrecascavel.com`. Em **Primeiro acesso? Criar usuário**, cadastre uma senha com pelo menos 8 caracteres e confirme o e-mail; nos próximos acessos, use **Entrar** com e-mail e senha.

No painel do Supabase, em **Authentication → URL Configuration**, defina o Site URL e inclua `https://eduanalytics-seven.vercel.app/` em Redirect URLs para que a confirmação do primeiro cadastro retorne ao app.

## Relatórios Se Liga!

Abra **Se Liga!** e escolha o ano de referência. Importe CSV, XLSX ou XLS com uma linha por CGM e disciplina, confira a aba e associe as colunas antes de aplicar. O modelo CSV está disponível na própria tela. Campos: CGM, nome do estudante, turma, disciplina e notas do 1º, 2º e 3º trimestres. Nome e turma podem ser obtidos do cadastro pelo CGM; estudantes ausentes do cadastro precisam desses campos no arquivo.

A média considera apenas notas disponíveis, incluindo zero. Os conceitos usam a média sem arredondamento: abaixo do básico (< 6, vermelho), básico (>= 6 e < 7, laranja), adequado (>= 7 e < 9, verde), avançado (>= 9, roxo). Sem notas fica sem conceito. A tela e o PDF mostram a quantidade de trimestres quando a média é parcial.

Os filtros incluem turma, disciplina, conceito e busca por nome/CGM. O filtro de conceito seleciona estudantes com pelo menos uma ocorrência nas disciplinas exibidas. O CSV inclui média, conceito e quantidade de trimestres; o PDF abre a impressão do navegador para salvar em PDF, em A4 horizontal, com CGM e estudante nas linhas e até 15 disciplinas por bloco. Turmas diferentes têm páginas separadas. Acima de 15 disciplinas, há blocos adicionais; turmas extensas continuam nas páginas seguintes com cabeçalho repetido.

As notas ficam em tabela própria na nuvem, por ano, CGM e disciplina. O navegador mantém uma cópia completa em `grades` para consulta offline e backup; a leitura inicial é paginada e verifica a revisão para não combinar versões diferentes. Reimportar atualiza apenas notas preenchidas; campos vazios não apagam notas existentes. Notas inválidas, CGMs duplicados na mesma disciplina ou identidades divergentes bloqueiam a importação para correção. O cadastro, documentos, frequência e cobranças não são alterados pela importação de notas.

Testes: `node tests/seliga.mjs`. O teste de navegador `node tests/seliga-browser.cjs` utiliza Playwright, Edge e a cópia de SheetJS em `../tmp/xlsx.full.min.js` (ou `XLSX_PATH`), em um contexto isolado e sem acesso à nuvem. Os arquivos de simulação são gravados em `../tmp/seliga` e `../output/pdf`.


### PDF por turma e ficha individual

Se Liga! aceita o PDF de acompanhamento trimestral do Sistema Escola. O leitor usa a posição dos cabeçalhos T1/T2/T3, ignora a quarta coluna sem título e reúne os blocos de disciplinas das páginas seguintes. Confira os nomes das disciplinas e o vínculo de cada chamada com um CGM antes de aplicar. Correspondências por nome normalizado e turma são sugestões; vínculos indefinidos bloqueiam a aplicação, salvo quando o usuário marca explicitamente Não importar para aquela chamada. Não são criados CGMs a partir do nome ou da chamada.

Na ficha, abra **Desempenho · Se Liga!**, escolha o ano, filtre pelos indicadores de conceito e use **Exportar relatório individual**. A tabela mostra os trimestres, a média, o conceito e notas parciais. As contagens cobrem apenas as disciplinas importadas. Nome do arquivo e data podem acompanhar as notas como origem; nenhum PDF, planilha ou imagem original é enviado ao banco ou Storage. O exemplo real foi usado somente em testes isolados, sem importar notas para produção.

Testes adicionais: `node tests/seliga-full.mjs`, `node tests/seliga-cloud-browser.cjs` e `node tests/seliga-pdf-browser.cjs`. Os testes de navegador usam Playwright instalado no ambiente. O teste de PDF utiliza `GRADE_PDF`, as coordenadas locais em `../tmp/seliga/pdf-words.json` e as bibliotecas locais PDF.js, sem incluir documentos ou dados reais no repositório. A migração SQL é executada uma vez após o esquema principal; não exclui a base cadastral. Gravação, rejeição de versão antiga, validação e RLS foram verificadas em transação revertida.

### Notas na importação geral

A tela Importar e cruzar reconhece PDFs de acompanhamento trimestral como Notas trimestrais · Se Liga!. Após selecionar vários arquivos, use Conferir notas em sequência. Cada aplicação abre o próximo PDF já lido, preservando as notas anteriores. Em lotes mistos, aplicar cadastros/frequências mantém os PDFs de notas aguardando conferência. A fila é temporária no navegador; os arquivos originais não são salvos. Teste de regressão: `tests/seliga-batch-browser.cjs`, com arquivos locais 3b/3c/3d e dados apenas na sessão isolada.

### Lançamento manual na ficha

Na ficha do estudante, abra **Desempenho · Se Liga! → Lançar ou corrigir notas**. A tabela reúne as disciplinas do estudante e as encontradas na mesma turma/ano, com colunas de 1º, 2º e 3º trimestres, média e conceito, sem faltas nem exceções. Edite várias disciplinas e salve juntas com um motivo. A média e o conceito são atualizados na prévia enquanto digita; só entram nos relatórios após salvar. Use **Adicionar à tabela** para uma disciplina ainda ausente. Funciona mesmo sem notas importadas para esse CGM. Linhas novas totalmente vazias não criam registros. Zero entra na média; vazio significa ausência de nota. Apagar uma nota existente retira o trimestre do cálculo. Frequência não atribui nota zero automaticamente.

Cada trimestre alterado recebe proteção contra importações. Desmarque **Preservar** abaixo da nota e salve para permitir atualizações futuras daquele trimestre. A ficha e o PDF identificam os trimestres protegidos. Notas, proteções e motivo são registrados no histórico do aluno; os mesmos dados alimentam médias, conceitos, matriz, CSV e PDF. Outros anos, estudantes e disciplinas são preservados. O teste `tests/seliga-table-browser.cjs` cobre 15 disciplinas, prévia, gravação conjunta, rejeição integral de notas inválidas e rolagem em tela pequena.

Depois de `supabase/grades.sql`, aplique uma vez `supabase/manual-grades.sql`. A coluna `manual` guarda três indicadores booleanos; a RPC continua transacional e mantém a proteção inclusive para clientes antigos sem esse campo. Testes: `tests/seliga-manual.mjs`, `tests/seliga-manual-browser.cjs`, `tests/seliga-cloud-browser.cjs` e `tests/manual-grades.sql` (transação revertida). Nenhum documento original é armazenado.
