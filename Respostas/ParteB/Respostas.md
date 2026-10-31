# Parte B --- Banco de Dados (MySQL 8)

## 8.

### a)

O índice foi criado para atender à tupla `(level, value)`, porém, no `WHERE` do `UPDATE`, também são utilizados campos que não fazem parte desse índice, como `active`, além de condições com `OR`. Isso pode reduzir a eficiência da consulta e fazer com que o otimizador não consiga aproveitar o índice da melhor forma.

Referência: [MySQL 8.0 --- Optimization and Indexes](https://dev.mysql.com/doc/refman/8.0/en/mysql-indexes.html)

### b)
Para funcionar com os indices, é necessário separar cada uma das condições em um SELECT expecifico, mas ainda sim seria bom adicionar o b.active no índice.

UPDATE address a
   SET a.blocked = (
          EXISTS (SELECT 1 FROM block b
                   WHERE b.level = 1 AND b.value = a.state    AND b.active = 1)
       OR EXISTS (SELECT 1 FROM block b
                   WHERE b.level = 2 AND b.value = a.city_key AND b.active = 1)
       OR EXISTS (SELECT 1 FROM block b
                   WHERE b.level = 3 AND b.value = a.zipcode  AND b.active = 1)
   )
 WHERE a.state = 'AC';

Referência: [MySQL 8.0 --- Index Merge Optimization](https://dev.mysql.com/doc/refman/8.0/en/index-merge-optimization.html)

### c)
Teríamos que executar o EXPLAIN em ambas as querys, pois ele traz a coluna rows, aonde mostraquantas linhas foram verificadas para trazer o resultado. Caso o número de linhas diminuiu drasticamente, então está correto.

Referência: [MySQL --- EXPLAIN](https://dev.mysql.com/doc/refman/9.7/en/explain.html)
------------------------------------------------------------------------

## 9.

Não identifiquei a causa apenas olhando para a query, e sem o contexto da execução eu verificaria se existe algum limite de tamanho para o resultado de `GROUP_CONCAT` ou se seria possível utilizar funções JSON nativas do MySQL, como `JSON_OBJECT`, conforme a estrutura esperada.

Sobre a mudança na ordem dos resultados, ela pode ocorrer porque as prioridades mudam. Além disso, se houver vários bloqueios com a mesma prioridade, não existe outro critério de ordenação para definir a ordem deles, daria para adicionaria uma coluna secundária ao ORDER BY.

------------------------------------------------------------------------

## 10.

### a)

Como o campo é do tipo `VARCHAR`, seria necessário verificar os valores `NULL` e strings vazias. Também é importante considerar valores que contenham apenas espaços.

### b)

A condição `supplier NOT IN` não encontrou registros que atendam ao filtro. Uma possibilidade é que todos os fornecedores presentes em `address` era o caso inserido naquele registro especifico na tabela `disabled_supplier`.


------------------------------------------------------------------------

## 11.

### a)

Para identificar valores equivalentes, podemos utilizar algumas funções do TypeScript para formatar os valor, como `trim()`, `toUpperCase()` e `replace()`. Também podemos utilizar expressões regulares `Regex` para identificar padrões específicos e remover caracteres especiais ou outros elementos previamente definidos nas regras de normalização.

### b)

Primeiro, faria uma validação dos casos e definiria qual registro deve ser considerado o `dado mestre`. Com isso definido, prepararia um
processo dividido em etapas para atualizar as informações das demais fontes com base no registro mestre, confirmando que não há restrições e regras que impessam essa atualização.

### c)

Porque podem existir regras de negócio, relacionamentos e outros dados que podem depender de um valor específico formatado da maneira que está registrado.

------------------------------------------------------------------------

## 12.

Caso seja enviado um filtro que não esteja na lista de colunas permitidas `allowed`, ele será ignorado e não será adicionado à query e o usuário não será avisado de que o filtro não foi aplicado.

Também existe o risco de `SQL Injection`, pois os valores dos filtros são concatenados diretamente na variável `WHERE` e no `ORDER BY` também.


------------------------------------------------------------------------

## 13.

### a)

Poderíamos criar uma tabela auxiliar com a nova coluna, relacionando na tabela principal, ou utilizar uma tabela temporária para preparar e migrar os dados antes de realizar a alteração definitiva. Isso depende do volume de dados, relacionamentos existentes e se a aplicação é usada 24h.

### b)

Aplicaria a mesma estratégia da questão anterior: realizar a migração em etapas, mantendo a compatibilidade com a estrutura antiga até que todos os consumidores estejam utilizando a nova estrutura.

### c)

Verificaria a auditoria das execuções e alterações nas tabelas para ver quais processos ainda dependem da estrutura antiga.