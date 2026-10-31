import { buildApp } from './app.js';
import { createPool } from './db.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Defina DATABASE_URL (veja .env.example)');
  process.exit(1);
}

const pool = createPool(databaseUrl);
const app = buildApp({ pool });
app.addHook('onClose', async () => {
  await pool.end();
});

// Desligamento gracioso: para de aceitar conexões, termina as requisições em andamento e fecha o pool.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'encerrando');
    app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}

await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
