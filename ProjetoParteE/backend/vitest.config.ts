import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Os testes usam o mesmo banco real; rodar arquivos em paralelo misturaria os dados.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
