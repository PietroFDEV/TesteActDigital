-- Dados de exemplo para testes locais: 8 operadores e 5 mil demandas.
-- Distribuição: cerca de 70% abertas, 20% reservadas e 10% encerradas,
-- em 4 filas, com datas espalhadas pelos últimos 30 dias.

SET SESSION cte_max_recursion_depth = 10000;

INSERT INTO app_user (id, name) VALUES
  (1, 'Ana Souza'),
  (2, 'Bruno Lima'),
  (3, 'Carla Dias'),
  (4, 'Diego Martins'),
  (5, 'Elisa Rocha'),
  (6, 'Felipe Nunes'),
  (7, 'Gabriela Alves'),
  (8, 'Heitor Ramos');

INSERT INTO demand (title, queue, status, worker_id, outcome, failure_reason, note, updated_at)
WITH RECURSIVE seq (i) AS (
  SELECT 1
  UNION ALL
  SELECT i + 1 FROM seq WHERE i < 5000
),
base AS (
  SELECT
    i,
    CASE WHEN i % 10 < 7 THEN 1 WHEN i % 10 < 9 THEN 2 ELSE 3 END AS status
  FROM seq
)
SELECT
  CONCAT(
    ELT(1 + i % 6, 'Sem conexão', 'Troca de plano', 'Pedido de cancelamento',
                   'Segunda via de fatura', 'Mudança de endereço', 'Instalação nova'),
    ' (cliente ', LPAD((i * 7919) % 900000 + 100000, 6, '0'), ')'
  ),
  ELT(1 + (i DIV 3) % 4, 'suporte', 'vendas', 'retencao', 'cobranca'),
  status,
  IF(status > 1, 1 + i % 8, NULL),
  IF(status = 3, IF(i % 20 = 9, 'failure', 'success'), NULL),
  IF(status = 3 AND i % 20 = 9,
     ELT(1 + (i DIV 20) % 4, 'cliente_ausente', 'sem_viabilidade', 'dados_incorretos', 'duplicada'),
     NULL),
  IF(status = 3 AND i % 40 = 19, 'Cliente confirmou que o serviço voltou a funcionar.', NULL),
  NOW() - INTERVAL ((i * 7919) % 43200) MINUTE
FROM base;

-- Histórico coerente com o estado das demandas já reservadas ou encerradas.
INSERT INTO demand_trace (demand_id, user_id, action, note, created_at)
SELECT id, worker_id, 'reserve', NULL, updated_at - INTERVAL 30 MINUTE
  FROM demand
 WHERE status IN (2, 3);

INSERT INTO demand_trace (demand_id, user_id, action, note, created_at)
SELECT id, worker_id, 'finish', note, updated_at
  FROM demand
 WHERE status = 3;
