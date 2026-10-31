## Respostas da prova (Partes A a D)

As respostas das questões teóricas estão na pasta `Respostas`, separadas por parte:

| Pasta | Tema | Questões |
| --- | --- | --- |
| `Respostas/Parte A/Respostas.md` | Backend | 1 a 7 |
| `Respostas/Parte B/Respostas.md` | Banco de dados | 8 a 13 |
| `Respostas/Parte C/Respostas.md` | Frontend | 14 a 19 |
| `Respostas/Parte D/Respostas.md` | Arquitetura e operação | 20 a 24 |

Cada arquivo traz a resposta de cada questão e, quando consultei documentação, a referência usada.

# Fila de Demandas — desafio prático (Parte E)

Versão mínima da fila de Demandas do Órbita: API em Fastify + Zod + mysql2 (sem ORM) e tela em Angular 21 (standalone, OnPush, signals, formulários reativos).

## Como rodar

Pré-requisitos: Node 20.19 ou mais recente (exigência do Angular 21) e o MySQL do `docker-compose.yml` fornecido pelo time.

```bash
docker compose up -d          # banco do time, com as 5 mil demandas

# Backend (porta 3000)
cd backend
cp .env.example .env          # ajuste DATABASE_URL conforme o docker-compose
npm install
npm run dev

# Testes (usam o mesmo banco; criam e apagam os próprios dados na fila "__teste__")
npm test

# Frontend (porta 4200, com proxy de /demands para a API)
cd ../frontend
npm install
npm start
```

Abra http://localhost:4200. No topo dá para trocar o número do operador e ligar o escopo de supervisão, para simular duas pessoas disputando a mesma demanda (duas abas, um operador em cada).

## Stack

O desafio usa a parte da stack do Órbita que ele pede: backend com API e banco, frontend e testes.

| Tecnologia | Uso aqui |
| --- | --- |
| Node.js 20 + TypeScript | Backend e testes. Dependências escolhidas para rodar no Node 20 (por exemplo, Vitest 3 e `@types/node` 20). |
| Fastify 5 | API HTTP, com hooks para autenticação e um plugin por módulo. |
| Zod | Validação de entrada e serialização de saída, via `fastify-type-provider-zod`. |
| MySQL 8 + mysql2, sem ORM | SQL escrito à mão, transações explícitas e placeholders. |
| Angular 21 | Componentes standalone, `OnPush`, signals (`signal`, `computed`, `input`, `output`, `rxResource`) e formulários reativos. |
| Vitest | Testes do backend contra o MySQL real. |

Ficaram de fora, de propósito, as partes da stack que o enunciado não pede ou simplifica:

- **JWT com escopos**: o enunciado manda usar os headers `x-user-id` e `x-scopes`. O hook de autenticação lê os headers no mesmo formato que leria de um token, então trocar para JWT muda só esse arquivo.
- **Ionic 8**: o enunciado deixa opcional. A tela usa Angular puro para manter o foco nos requisitos.
- **Redis, MongoDB, workers, PM2 e GitLab CI**: não fazem parte do escopo deste desafio. O backend já faz desligamento gracioso em `SIGINT` e `SIGTERM`, que é o que o PM2 envia num reload.

## API

Autenticação simplificada: usuário no header `x-user-id`, escopos em `x-scopes` (separados por vírgula). Sem `x-user-id` válido, a API responde `401`.

| Rota | O que faz |
| --- | --- |
| `GET /demands?page&pageSize&queue&status&sort&order` | Lista paginada com total. `sort` é `id` ou `updatedAt`; `order` é `asc` ou `desc`. Parâmetro desconhecido ou valor inválido → `400`. |
| `POST /demands/:id/reserve` | Reserva. Quem perde a disputa recebe `409` com o nome de quem ficou e o estado atual da demanda. O mesmo usuário reservando de novo recebe `200`. |
| `POST /demands/:id/finish` | Encerra. Corpo `{ outcome, failureReason?, note? }`; `failureReason` é obrigatório quando `outcome` é `failure`. Só o dono da reserva ou quem tem `demands:supervise`. |

## Decisões

**Reserva sem trava longa.** A condição "ainda está livre" fica dentro do próprio `UPDATE ... WHERE id = ? AND status = 1 AND worker_id IS NULL`. Quando duas transações chegam juntas, o InnoDB faz a segunda esperar a trava da linha e reavaliar o `WHERE` depois que a primeira confirma; ela altera 0 linhas e sabemos que perdeu. Nenhuma linha fica travada enquanto o operador pensa. Depois, a API lê a demanda para descobrir o motivo (outra pessoa, já encerrada, ou o próprio usuário em outra aba).

**Encerramento com `SELECT ... FOR UPDATE`.** Aqui a regra depende de quem é o dono, então a linha é lida e travada dentro de uma transação curta, a permissão é checada e o `UPDATE` acontece em seguida. A trava dura milissegundos.

**Permissão por recurso no serviço, não no hook.** Um `preHandler` sabe quem é o usuário e quais escopos ele tem, mas não sabe de quem é a demanda. A regra "dono ou supervisão" só pode ser decidida depois de ler a linha.

**Histórico na mesma transação.** Toda mudança grava em `demand_trace` dentro da transação que alterou a demanda. A reserva repetida pelo mesmo usuário não gera linha nova.

**409 devolve o estado atual.** O corpo do erro inclui a demanda como está no banco, para a tela atualizar só aquela linha sem recarregar a lista.

**Entrada validada, saída serializada pelo Zod.** A query string usa `z.strictObject` (parâmetro desconhecido vira `400`). O corpo do encerramento é uma união discriminada por `outcome`. A coluna de ordenação sai de um mapa fixo no código, nunca do texto enviado pelo cliente. As respostas declaram schema, então só os campos previstos chegam ao cliente.

**Testes contra o banco real.** O que precisa ser provado é o comportamento das travas do InnoDB, e um mock não provaria isso. O teste dispara reservas simultâneas 20 vezes seguidas e confere status, mensagem e quantidade de linhas no histórico. Ele foi validado trocando temporariamente a reserva pela versão "lê e depois escreve": nessa versão, os testes de corrida falham.

**Frontend.** A lista usa `rxResource`: cada mudança de filtro, ordenação ou página dispara uma nova consulta e cancela a anterior. A validação condicional do motivo liga e desliga o `Validators.required` conforme o resultado escolhido. O estado do formulário vira signal com `toSignal(statusChanges)`, para o botão reagir na hora com OnPush.

## O que eu faria com mais tempo

- Índice `(queue, status, updated_at, id)` e paginação por cursor em vez de `OFFSET`, que fica lento em páginas altas.
- Autenticação real com JWT e escopos no token, em vez dos headers.
- Testes de componente no frontend (formulário e tratamento do 409) e um teste de ponta a ponta.
- Atualização em tempo real da lista (SSE ou WebSocket) quando outra pessoa reserva.
- Validar a observação considerando o texto já sem espaços nas pontas também no frontend.
- Observabilidade: log estruturado com o id da demanda e do usuário em cada mudança.
- Adição das outras Stacks que o enunciado não solicitou.

## Uso de IA

Usei o Claude (Anthropic) para gerar a primeira versão do projeto. Trabalho presencialmente e não tive tempo de construir tudo do zero no prazo de 3 dias, então pedi à IA que montasse a base seguindo a stack e as regras deste enunciado.

O que foi gerado com IA:

- o código inicial do backend (rotas, schemas Zod, SQL, transações e autenticação por headers);
- os testes do backend, incluindo o de reservas simultâneas;
- o código inicial do frontend (lista paginada, reserva com tratamento do 409 e formulário de encerramento);
- este README, a partir das decisões tomadas.

A IA também rodou os testes contra um MySQL 8 e abriu a tela num navegador para confirmar o funcionamento antes de me entregar.

O que eu fiz:

- revisei e estudei o código, para conseguir explicar e alterar cada parte;
- rodei o projeto e os testes no meu ambiente local;
- Não recebi no email o `docker-compose.yml` do time para rodar e testar com ele.