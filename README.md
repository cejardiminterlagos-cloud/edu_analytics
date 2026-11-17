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
- Depois de **Sair da nuvem**, a interface exige novo login para reabrir a cópia local, inclusive após recarregar. A cópia e as alterações pendentes são preservadas. Esse bloqueio da interface não criptografa o IndexedDB; computadores compartilhados devem usar perfis Windows separados.
- A sincronização com revisão desconhecida primeiro carrega ou concilia a base. Não envia a base local vazia como substituição da base compartilhada.

## Primeiro acesso e login

O usuário é `cejardiminterlagos@nrecascavel.com`. Em **Primeiro acesso? Criar usuário**, cadastre uma senha com pelo menos 8 caracteres e confirme o e-mail; nos próximos acessos, use **Entrar** com e-mail e senha.

No painel do Supabase, em **Authentication → URL Configuration**, defina o Site URL e inclua `https://eduanalytics-seven.vercel.app/` em Redirect URLs para que a confirmação do primeiro cadastro retorne ao app.

## Relatórios Se Liga!

Abra **Se Liga!** e escolha o ano de referência. Importe CSV, XLSX ou XLS com uma linha por CGM e disciplina, confira a aba e associe as colunas antes de aplicar. O modelo CSV está disponível na própria tela. Campos: CGM, nome do estudante, turma, disciplina e notas do 1º, 2º e 3º trimestres. Nome e turma podem ser obtidos do cadastro pelo CGM; estudantes ausentes do cadastro precisam desses campos no arquivo.

A média exige notas nos três trimestres. Zero é uma nota válida. Se faltar T1, T2 ou T3, a disciplina fica como Sem Nota (cinza). A classificação usa a média sem arredondamento: Recuperação (< 6, vermelho), Reforço (>= 6 e < 7, âmbar) e Aprofundamento (>= 7, azul). A tela e o PDF indicam quantos trimestres têm nota.

O conceito geral exige também uma lista curricular confirmada por turma e ano. Selecione a turma e abra **Lista completa de disciplinas**, informe uma disciplina por linha e confirme com a matriz curricular da escola. Essa confirmação não altera notas. A opção de lista completa na importação do consolidado CSV também registra essa lista, além da substituição de disciplinas já indicada na prévia. Sem confirmação, com disciplinas faltantes ou com uma nova disciplina fora da lista, o conceito geral fica **Sem Nota**. Os conceitos individuais continuam sendo calculados normalmente. Backups anteriores continuam válidos, mas suas listas precisam ser confirmadas; não são inferidas como completas automaticamente.

Abreviações conhecidas e nomes com códigos que possam duplicar uma disciplina são sinalizados antes de criar um novo registro. Confira o nome na importação e use o já cadastrado quando se tratar do mesmo componente. Não há unificação automática de notas ou de correções manuais. Duplicações antigas continuam exigindo revisão.

Em **Importar notas de imagem, PDF ou planilha**, selecione uma captura PNG, JPEG ou WebP com o mesmo layout da referência: **Aluno – CGM** e dez blocos de **T1, T2, T3 e Total**. O reconhecimento lê T1, T2 e T3 no navegador. A biblioteca de leitura requer acesso à internet para carregar. Confira a captura, corrija os campos marcados com `?` e confirme os nomes das disciplinas. Use os nomes já cadastrados para atualizar uma disciplina existente. Os vínculos usam o nome, o CGM e a turma do cadastro no ano selecionado.

Ao aplicar a importação, notas preenchidas substituem as anteriores para o mesmo ano, CGM, disciplina e trimestre. Campos vazios preservam o valor salvo, e a proteção de notas lançadas manualmente continua valendo. Ao selecionar uma turma, o diagnóstico conta os níveis por disciplina, incluindo estudantes do cadastro sem registro completo.

Os filtros incluem turma, disciplina, conceito e busca por nome/CGM. O filtro de conceito seleciona estudantes com pelo menos uma ocorrência nas disciplinas exibidas. O CSV inclui média, conceito e quantidade de trimestres; o PDF abre a impressão do navegador para salvar em PDF, em A4 horizontal, com CGM e estudante nas linhas e até 15 disciplinas por bloco. Turmas pequenas podem compartilhar uma página, mantendo tabelas identificadas. Cada turma inclui somente as disciplinas presentes em seus registros; acima de 15 disciplinas, há blocos adicionais. Turmas extensas continuam nas páginas seguintes com identificação da turma, legenda das disciplinas e cabeçalho repetidos. Margens, espaçamentos, cabeçalhos individuais e listagens foram compactados para reduzir folhas sem alterar cálculos. Testes de impressão: `tests/seliga-print-browser.cjs` e `tests/seliga-print-check.py` (Playwright/Edge e pypdf).

As notas ficam em tabela própria na nuvem, por ano, CGM e disciplina. O navegador mantém uma cópia completa em `grades` para consulta offline e backup; a leitura inicial é paginada e verifica a revisão para não combinar versões diferentes. Reimportar atualiza apenas notas preenchidas; campos vazios não apagam notas existentes. Notas inválidas, CGMs duplicados na mesma disciplina ou identidades divergentes bloqueiam a importação para correção. O cadastro, documentos, frequência e cobranças não são alterados pela importação de notas.

Testes: `node tests/seliga.mjs`. O teste de navegador `node tests/seliga-browser.cjs` utiliza Playwright, Edge e a cópia de SheetJS em `../tmp/xlsx.full.min.js` (ou `XLSX_PATH`), em um contexto isolado e sem acesso à nuvem. Os arquivos de simulação são gravados em `../tmp/seliga` e `../output/pdf`.


### PDF por turma e ficha individual

Se Liga! aceita o PDF de acompanhamento trimestral do Sistema Escola. O leitor usa a posição dos cabeçalhos T1/T2/T3, ignora a quarta coluna sem título e reúne os blocos de disciplinas das páginas seguintes. Confira os nomes das disciplinas e o vínculo de cada chamada com um CGM antes de aplicar. Correspondências por nome normalizado e turma são sugestões; vínculos indefinidos bloqueiam a aplicação, salvo quando o usuário marca explicitamente Não importar para aquela chamada. Não são criados CGMs a partir do nome ou da chamada.

Na conferência, CGMs repetidos no mesmo PDF/turma são destacados e consolidados na maior chamada entre as linhas não excluídas. Por disciplina e trimestre, a nota preenchida da maior chamada prevalece (inclusive zero); campos vazios aproveitam a última nota disponível das chamadas anteriores. Não importar exclui completamente aquela linha. Notas manuais protegidas continuam preservadas na aplicação. CGMs ausentes ou inválidos recebem mensagem junto ao campo; um CGM vazio nunca vincula um cadastro vazio. Ao conferir, a tela leva o foco ao primeiro problema; o resumo permite ir diretamente a cada chamada. Corrigir o CGM ou marcar Não importar recalcula os destaques e invalida a prévia anterior. Cobertura em `tests/seliga-pdf-browser.cjs` e `tests/seliga-consolidate.mjs`.

Quando a mesma chamada aparece com nomes diferentes entre páginas, a leitura abre a conferência com todas as versões dos nomes e suas páginas. A linha permanece bloqueada até confirmar que todas as ocorrências pertencem ao CGM indicado ou marcar Não importar. Alterar o CGM desfaz a confirmação. Os dados são provisórios até a aplicação; o sistema não presume que nomes abreviados pertencem à mesma pessoa. Teste `tests/seliga-name-differences.cjs`, com o PDF e as coordenadas locais de 6c (não versionados).

Na ficha, abra **Desempenho · Se Liga!**, escolha o ano, filtre pelos indicadores de conceito e use **Exportar relatório individual**. A tabela mostra os trimestres, a média, o conceito e notas parciais. As contagens cobrem apenas as disciplinas importadas. Nome do arquivo e data podem acompanhar as notas como origem; nenhum PDF, planilha ou imagem original é enviado ao banco ou Storage. O exemplo real foi usado somente em testes isolados, sem importar notas para produção.

Testes adicionais: `node tests/seliga-full.mjs`, `node tests/seliga-cloud-browser.cjs` e `node tests/seliga-pdf-browser.cjs`. Os testes de navegador usam Playwright instalado no ambiente. O teste de PDF utiliza `GRADE_PDF`, as coordenadas locais em `../tmp/seliga/pdf-words.json` e as bibliotecas locais PDF.js, sem incluir documentos ou dados reais no repositório. A migração SQL é executada uma vez após o esquema principal; não exclui a base cadastral. Gravação, rejeição de versão antiga, validação e RLS foram verificadas em transação revertida.

### Notas na importação geral

A tela Importar e cruzar reconhece PDFs de acompanhamento trimestral como Notas trimestrais · Se Liga!. Após selecionar vários arquivos, use Conferir notas em sequência. Cada aplicação abre o próximo PDF já lido, preservando as notas anteriores. Em lotes mistos, aplicar cadastros/frequências mantém os PDFs de notas aguardando conferência. A fila é temporária no navegador; os arquivos originais não são salvos. Teste de regressão: `tests/seliga-batch-browser.cjs`, com arquivos locais 3b/3c/3d e dados apenas na sessão isolada.

### Lançamento manual na ficha

Na ficha do estudante, abra **Desempenho · Se Liga! → Lançar ou corrigir notas**. A tabela reúne as disciplinas do estudante e as encontradas na mesma turma/ano, com colunas de 1º, 2º e 3º trimestres, média e conceito, sem faltas nem exceções. Edite várias disciplinas e salve juntas com um motivo. A média e o conceito são atualizados na prévia enquanto digita; só entram nos relatórios após salvar. Use **Adicionar à tabela** para uma disciplina ainda ausente. Funciona mesmo sem notas importadas para esse CGM. Linhas novas totalmente vazias não criam registros. Zero entra na média; vazio significa ausência de nota. Apagar uma nota existente retira o trimestre do cálculo. Frequência não atribui nota zero automaticamente.

Cada trimestre alterado recebe proteção contra importações. Desmarque **Preservar** abaixo da nota e salve para permitir atualizações futuras daquele trimestre. A ficha e o PDF identificam os trimestres protegidos. Notas, proteções e motivo são registrados no histórico do aluno; os mesmos dados alimentam médias, conceitos, matriz, CSV e PDF. Outros anos, estudantes e disciplinas são preservados. O teste `tests/seliga-table-browser.cjs` cobre 15 disciplinas, prévia, gravação conjunta, rejeição integral de notas inválidas e rolagem em tela pequena.

Depois de `supabase/grades.sql`, aplique uma vez `supabase/manual-grades.sql`. A coluna `manual` guarda três indicadores booleanos; a RPC continua transacional e mantém a proteção inclusive para clientes antigos sem esse campo. Testes: `tests/seliga-manual.mjs`, `tests/seliga-manual-browser.cjs`, `tests/seliga-cloud-browser.cjs` e `tests/manual-grades.sql` (transação revertida). Nenhum documento original é armazenado.

### CSV Consolidado notas

O importador reconhece disciplinas lado a lado e extrai T1, T2 e T3. A turma vem do cadastro pelo CGM no ano selecionado; apenas CGMs sem turma única exigem preenchimento individual. Médias e grupos são recalculados. Neste formato, traços e campos vazios limpam notas importadas anteriores, com lista na prévia. Notas manuais continuam protegidas. PDF e CSV de uma linha por disciplina mantêm seu comportamento.

### Conceito geral e acesso à ficha

O conceito geral é a média sem arredondamento intermediário das médias de todas as disciplinas registradas para a turma e ano, com pesos iguais. Uma disciplina ou trimestre ausente mantém Sem Nota; a ficha informa a quantidade de disciplinas completas. Filtros de disciplina não alteram o conceito geral. A tag aparece junto aos estudantes e na ficha, e o painel por turma conta os conceitos gerais. Nomes identificados pelo cadastro ou CGM abrem a ficha; registros somente de notas abrem uma ficha de consulta sem criar cadastro. As disciplinas esperadas são inferidas dos registros da turma: um componente que nunca foi importado para ninguém não pode ser detectado.

Para reimportar um consolidado que contém a lista completa de disciplinas, marque **Usar a lista do CSV como lista completa de disciplinas das turmas importadas**. A prévia lista os registros de disciplinas antigas que serão removidos no ano selecionado, inclusive de alunos ausentes do CSV nas turmas selecionadas. Registros com proteção manual são mantidos e indicados na prévia. Sem marcar a opção, a importação atualiza apenas as disciplinas presentes no arquivo.
