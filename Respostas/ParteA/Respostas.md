# Parte A --- Backend

## 1.

### a)

``` ts
import { z } from "zod";

const FinishBodySchema = z.object({
  outcome: z.boolean(),
  failureReasonKey: z.string(),
  note: z.string().trim().max(500).optional(),
});
```

Referência: [Zod --- Defining schemas](https://zod.dev/api).

### 1b)

Ele verifica qual foi o StatusCode retornado e retorna o Schema mapeado no Zod. Caso não exista o campo no Schema definido, o `ownerPasswordHash` não será retornado no Schema do response.

Referência: [Fastify --- Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/#serialization).

### 1c)

Sim, resolve, pois teremos um escopo específico para cada função. Assim, ao passar o escopo para a função `haveScope`, que só pode ser obtido após a autenticação do usuário, a requisição consegue identificar quais ações estão autorizadas.
Eu manteria essa abordagem, mas adicionaria uma validação no preValidation para verificar se o escopo recebido permite finalizar o atendimento e se essa ação atende às regras definidas para a operação.


Referência: [Fastify --- Hooks](https://fastify.dev/docs/latest/Reference/Hooks/).

------------------------------------------------------------------------

## 2.

### 2a)

O SELECT da segunda execução retornou o campo `demand.worker_id` vazio porque foi executado antes do `UPDATE` da primeira execução. Dessa forma, ambas as execuções identificaram a demanda como disponível. Em seguida, a segunda execução também realizou o `UPDATE`, sobrescrevendo o `worker_id` definido pela primeira. Entretanto, como ambas realizaram o `INSERT` na tabela `demand_trace`, o histórico pode comprovar as duas tentativas de atribuição.

### 2b)

É necessáio realizar o UPDATE direto, utilizando a validação no próprio UPDATE, desta forma:

``` ts
const [result]: any = await conn.execute('
    UPDATE demand SET worker_id = ?, status = 3 WHERE id = ? AND worker_id IS NULL',
    [userId, demandId]);
);
```

Com o `result`, podemos verificar quantas linhas foram afetadas pelo `UPDATE`, caso nenhuma linha tenha sido retornada sabemos que já está em uso e podemos até mesmo implementar uma `transação` para dar `rollback` na execução, e após isso realizar um `SELECT` do usuário que está atrelado pelo `worker_id` na demanda, para retornar na mensagem:

``` ts
throw {
        msg: `Demanda já reservada pelo usuário ${demand[0].worker_id}`
      };
```

### 2c)

Se a primeira aba conseguir atualizar a demanda, a segunda tentativa encontrará zero linhas afetadas, pois `worker_id` já não será `NULL`. A segunda execução será recusada e a interface poderá exibir "Demanda já reservada pelo usuário XPTO".

------------------------------------------------------------------------

## 3.

### 3a)

O problema não é apenas o arquivo original de 142 MB. Durante o
processamento, podem existir várias cópias ou representações do mesmo
conteúdo na memória: o arquivo original, uma string com seu conteúdo e
uma versão codificada em Base64.

### 3b)

Uma maenira seria processar o arquivo em `chunks`, utilizando streams do Node.js. Dessa forma, o sistema não precisa carregar o
arquivo inteiro na memória para processá-lo ou enviá-lo.

Referência: [filehandle.createReadStream([options])](https://nodejs.org/api/fs.html#filehandlecreatereadstreamoptions).


### 3c)

Se não for possível alterar todos os consumidores de uma vez, eu manteria a implementação atual temporariamente e criaria uma nova versão
do endpoint com o processamento em streams. Para no futuro ir migrando o que utiliza a versão antiga.

------------------------------------------------------------------------

## 4.

### 4a)

Para gerar podemos utilizar o `crypto` nativo do node. para guardar como no documento foi comentado que podemos utilizar o `Redis`, podemos salvar dentro do redis convertendo ele com um `sha256`, o redis também tem parametros para configurar que esse salvamento ficará apenas por 120 segundos. E para a utilização o `Frontend` envia o ticket novamente para o backend e convertemos em sha256 para buscar no redis e pegar a autenticação. 

Referência: [Node.js --- Crypto](https://nodejs.org/docs/latest/api/crypto.html).

### 4b)

O Redis tem um comando chamado `GETDEL`, aonde quando for chamado já apaga o registro no redis para que não seja mais utilziado.

Referência: [Redis --- GETDEL](https://redis.io/docs/latest/commands/getdel/).

### 4c)

`#` faz com que fique apenas no navegador e não seja enviado no servidor pelo protocolo HTTP. Evita que o ticket seja exposto para o servidor.

Referência: [URI --- Fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment).


------------------------------------------------------------------------

## 5.


-   A requisição não possui timeout explícito. Pode demorar infinitamente.
-   A resposta `204 No Content` não possui corpo. Então `data.lat` e `data.lng` não serão acessiveis.


### Exemplo de implementação

``` ts
import { z } from "zod";

const GeocodeResponseSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

async function geocode(cep: string) {
  try {
    const response = await axios.get(
      `https://geo.fornecedor.com/cep/${normalizedCep}`,
      {
        timeout: 5000,
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (response.status === 204 || response.data == null) {
      throw new Error("Fornecedor não retornou dados para o CEP.");
    }

    const parsed = GeocodeResponseSchema.safeParse(response.data);

    if (!parsed.success) {
      throw new Error("Resposta inválida do serviço de geolocalização.");
    }

    return {
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        throw new Error("Tempo limite ao consultar o serviço de geolocalização.");
      }

      throw new Error("Não foi possível consultar o serviço de geolocalização.");
    }

    throw error;
  }
}
```

Referência: [AXIOS --- Headers](https://axios.rest/pages/advanced/headers.html#preserving-a-specific-header-case).


------------------------------------------------------------------------

## 6.

### 6a)

Não pois deve ser realizada no `Backend`, o `Fronted` é facilmente manipulável e não é uma camada confiável para garantir total segurança.

### 6b)

O corpo da resposta pode conter dados sensíveis como por exemplo o CPF do usuário, para que isso seja evitado seria melhor salvar apenas os metadados que fazem sentido, como a rota sendo utilizada, o status, qual usuário executou. Para que a auditorio não contenha dados sensíveis e sim o necessário.

### 6c)

O `debug` geralmente é utilizado quando o desenvolvedor só quer que certa condição ou função execute quando estiver debuggando o código para testar e desenvolver. Retornar essa informação no `Frontend` pode trazer vulnerabilidades e facilitar ataques.

------------------------------------------------------------------------

## 7.

### 7a)

1 - Conseguir reservar uma demanda disponível.
2 - Insucesso na hora de reservar uma demanda indisponível.
3 - Falha no banco de dados deve dar rollback na transaction.
4 - Duas requisições simultaneas para a mesma demanda disponível.


### 7b)

``` ts
import { describe, expect, it, vi } from "vitest";

describe("reserveDemand", () => {
  it("perdeu a corrida para outra pessoa", async () => {
    const conn = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue([{ affectedRows: 0 }]),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      reserveDemand(conn as any, 10, 25)
    ).rejects.toThrow("Demanda já reservada");

    expect(conn.beginTransaction).toHaveBeenCalledOnce();

    // O UPDATE foi executado, mas não reservou nenhuma linha.
    expect(conn.execute).toHaveBeenCalledOnce();

    // Não pode gravar o histórico nem confirmar a transação.
    expect(conn.commit).not.toHaveBeenCalled();

    // Deve desfazer a transação.
    expect(conn.rollback).toHaveBeenCalledOnce();
  });
});
```


------------------------------------------------------------------------