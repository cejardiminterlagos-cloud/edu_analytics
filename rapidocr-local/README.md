# RapidOCR local do EduAnalytics

Execute **Iniciar-RapidOCR.cmd** antes de importar imagens em **Se Liga!**. O serviço fica em `http://127.0.0.1:8766`, usa dois threads de inferência e não inicia Docker nem configura inicialização automática do Windows. Se o navegador solicitar acesso à rede local, permita para o EduAnalytics. O navegador precisa conseguir acessar o serviço deste computador.

Execute **Parar-RapidOCR.cmd** quando terminar para encerrar o serviço iniciado pelo atalho. Ele verifica o processo deste projeto antes de encerrá-lo.

O iniciador usa o ambiente `.venv` nesta pasta, já preparado neste computador com as dependências de reconhecimento. Em outro computador, instale Python 3.12 e execute, nesta pasta:

```powershell
py -3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

Para executar em primeiro plano e encerrar com Ctrl+C:

```powershell
.venv/Scripts/python.exe server.py
```

O serviço só aceita imagens PNG/JPEG/WebP de até 20 MB e 12 milhões de pixels. Recebe as imagens em memória e devolve os dados extraídos; não salva imagens, não recebe credenciais da nuvem e não modifica cadastros ou notas. Acesso HTTP restrito a loopback, com verificação do Host, cabeçalho próprio e origens autorizadas para o endereço publicado e arquivos locais. Não exponha a porta à rede nem use proxy público.

## Formatos verificados

- Captura completa do Power BI no enquadramento 1920 × 928 fornecido, incluindo os cabeçalhos e a coluna fixa Aluno/CGM. As duas posições horizontais são reconhecidas pelo cabeçalho; a primeira disciplina cortada à esquerda e as colunas cortadas à direita são excluídas daquela imagem.
- Tabela recortada no enquadramento da referência de 16/11/2026, com dez disciplinas e T1/T2/T3/Total.

Outros enquadramentos são recusados; não há suposição automática sobre a posição das notas. A leitura de cada célula usa a imagem colorida e uma versão com contraste ajustado, exige concordância e confiança mínima e não reconstrói vírgulas ou notas a partir dos totais. Isso reduz erros, mas não substitui a conferência.

No Se Liga!, selecione até 20 imagens, limitadas a 60 MB no total. O processamento é sequencial. Repetições são unidas pelo CGM, disciplina e trimestre; valores numéricos divergentes ficam `?` até correção. CGMs não reconhecidos continuam em linhas separadas. `·` indica trecho não capturado; a célula vazia indica ausência de nota. Ambos preservam valores anteriores ao aplicar. Nenhuma lista de disciplinas é substituída por este fluxo. PDF, CSV e correção manual permanecem nos fluxos existentes.

Os testes usam `publicacao/tests/rapidocr_service_test.py`, `rapidocr-batch.mjs` e `seliga-image-browser.cjs`. A integração HTTP real pode ser testada com `rapidocr-live-browser.cjs`, informando `RAPID_IMAGE` e, para juntar os dois lados, `RAPID_IMAGE_RIGHT`. Defina uma amostra conferida em `RAPID_EXPECTED_CGM` e `RAPID_EXPECTED_NOTES` (JSON com arrays `arte` e `matematica`, com notas como strings decimais). Dados reais de estudantes não ficam gravados no teste. Não há gravação na nuvem durante os testes.
