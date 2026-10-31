# Parte D --- Arquitetura, operação e depuração

## 20.

### a)

Não identifiquei o erro imediatamente, mas, ao analisar a documentação de Streams e Events do Node.js, encontrei pontos que precisaria
investigar melhor.


Referências: - [Node.js --- events.once](https://nodejs.org/api/events.html#eventsonceemitter-name-options) -
[Node.js --- EventEmitter.once](https://nodejs.org/api/events.html#emitteronceeventname-listener)

### b)

Adicionaria um timeout para limitar o tempo de execução da consulta ou de espera por dados, evitando que fique travado infinitamente.


### c)

O método `destroy()` encerra o stream. Depois que o Writable é destruído, chamadas `write()` e `end()` podem resultar no erro `ERR_STREAM_DESTROYED`.

Quando a intenção é finalizar normalmente a escrita, o recomendado de acordo com a documentação é utilizar `end()`, aguardar o término do stream e tratar possíveis erros.

Referência: [Node.js --- writable.destroy](https://nodejs.org/api/stream.html#writabledestroyerror)

------------------------------------------------------------------------

## 21.

### a)

Utilizaria um arquivo temporário em vez de tentar modificar diretamente o arquivo final.


### b)

Como o arquivo estava permanecendo com o status de "Em execução", deveria existir um monitoramento de cada execução, registrando informações como identificador, data de início ou status. Para que possa ser criado uma rotina de retry.

Um heartbeat para os processos rodando também podem ser uma boa opção, para validar se o processo finalizou corretamente.

------------------------------------------------------------------------

## 22.

Utilizaria versionamento da API com uma migração gradual, adicionando os novos campos sem sobrescrever ou remover imediatamente os
campos antigos.

------------------------------------------------------------------------

## 23.

### a)

O problema está relacionado à execução em clusters, cada instância possui sua própria memória assim não seria adequado utilizar uma
variável local para controlar todas as instâncias. O `Redis` é uma solução para sanar esse problema, criando um cache que todos possam acessar.

### b)

Cada cluster possui sua própria memória, então uma variável local não consegue informar as outras instâncias que o processo está bloqueado. O Redis resolveria esse caso.

Uma coluna isolada como `locked = 1` sem mais nada ficaria sem registro de auditoria, sem saber quem adicionou, e caso algum processo morra ficaria travado para sempre, pois não tem datas e relação com IDs que mostrem até quando ficará travado.

### c)

O backend deveria retornar o status HTTP `423 Locked` quando uma operação de edição fosse solicitada enquanto a carga estivesse ativa.

A tela deve tratar esse status e informar ao usuário que a edição
está temporariamente indisponível.
------------------------------------------------------------------------

## 24.

### a)

Como o próprio enunciado menciona, o lock do Redis expira a cada 24 horas e isso faz com que a chave deixe de existir e o e-mail pode
ser processado novamente.

Além disso, se o prefixo mudar a cada inicialização do worker, a chave utilizada para consultar o lock será diferente. Assim não será encontrado a chave no redis, e processará novamente.

### b)

No código, é utilizado `Email.find({ sent: null })` para buscar os e-mails pendentes. A alteração disso para status difinitivos resolveria o entendimento do que está ocorrendo, como: `pending`, `sending` e `sent`


### c)

Não é seguro a configuração do ambiente de desenvolvimento local aponte para o MongoDB de produção.

O correto seria manter ambientes isolados, com um banco de dados próprio para desenvolvimento e outro para QA/homologação. Assim, alterações e testes não oferecem risco aos dados reais.
