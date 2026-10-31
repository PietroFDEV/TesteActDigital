import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { buildApp } from '../src/app.js';
import { createPool } from '../src/db.js';

/**
 * Os testes rodam contra o MySQL real (o do docker-compose), porque o que queremos provar
 * — duas reservas simultâneas — depende das travas do InnoDB. Um mock não provaria nada.
 */
export function setup() {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('Defina TEST_DATABASE_URL ou DATABASE_URL para rodar os testes');
  const pool = createPool(url);
  const app = buildApp({ pool, logger: false });
  return { pool, app };
}

// Ids altos para não colidir com os usuários de exemplo do banco do time.
export const USERS = [
  { id: 900001, name: 'Teste Ana' },
  { id: 900002, name: 'Teste Bruno' },
  { id: 900003, name: 'Teste Carla' },
  { id: 900004, name: 'Teste Diego' },
  { id: 900005, name: 'Teste Elisa' },
] as const;

export const TEST_QUEUE = '__teste__';

export async function seedUsers(pool: Pool) {
  await pool.query(
    'INSERT INTO app_user (id, name) VALUES ? ON DUPLICATE KEY UPDATE name = VALUES(name)',
    [USERS.map((u) => [u.id, u.name])],
  );
}

export async function createDemand(pool: Pool, title = 'Demanda de teste'): Promise<number> {
  const [r] = await pool.execute<ResultSetHeader>(
    'INSERT INTO demand (title, queue) VALUES (?, ?)',
    [title, TEST_QUEUE],
  );
  return r.insertId;
}

export async function traces(pool: Pool, demandId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT user_id, action, note FROM demand_trace WHERE demand_id = ? ORDER BY id',
    [demandId],
  );
  return rows as { user_id: number; action: string; note: string | null }[];
}

export async function cleanup(pool: Pool) {
  await pool.query(
    `DELETE t FROM demand_trace t JOIN demand d ON d.id = t.demand_id WHERE d.queue = ?`,
    [TEST_QUEUE],
  );
  await pool.query('DELETE FROM demand WHERE queue = ?', [TEST_QUEUE]);
  await pool.query('DELETE FROM app_user WHERE id IN (?)', [USERS.map((u) => u.id)]);
}

export const as = (userId: number, scopes = '') => ({
  'x-user-id': String(userId),
  ...(scopes ? { 'x-scopes': scopes } : {}),
});
