import { existsSync } from 'node:fs';

// Os scripts dev e start carregam o .env com a flag --env-file do Node,
// mas o Vitest não lê o .env sozinho. Variáveis já definidas no ambiente têm prioridade.
if (existsSync('.env')) process.loadEnvFile('.env');