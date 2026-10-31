import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Db } from '../db.js';
import { SORT_COLUMNS, type Demand, type ListQuery } from './schemas.js';

interface DemandRow extends RowDataPacket {
  id: number;
  title: string;
  queue: string;
  status: 1 | 2 | 3;
  worker_id: number | null;
  worker_name: string | null;
  outcome: 'success' | 'failure' | null;
  failure_reason: string | null;
  note: string | null;
  updated_at: Date;
}

const SELECT_DEMAND = `
  SELECT d.id, d.title, d.queue, d.status, d.worker_id, u.name AS worker_name,
         d.outcome, d.failure_reason, d.note, d.updated_at
    FROM demand d
    LEFT JOIN app_user u ON u.id = d.worker_id`;

function toDemand(row: DemandRow): Demand {
  return {
    id: row.id,
    title: row.title,
    queue: row.queue,
    status: row.status,
    worker:
      row.worker_id === null
        ? null
        : { id: row.worker_id, name: row.worker_name ?? `Usuário ${row.worker_id}` },
    outcome: row.outcome,
    failureReason: row.failure_reason,
    note: row.note,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findDemand(db: Db, id: number): Promise<Demand | null> {
  const [rows] = await db.query<DemandRow[]>(`${SELECT_DEMAND} WHERE d.id = ?`, [id]);
  return rows[0] ? toDemand(rows[0]) : null;
}

export async function listDemands(
  db: Db,
  q: ListQuery,
): Promise<{ items: Demand[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (q.queue !== undefined) {
    conditions.push('d.queue = ?');
    params.push(q.queue);
  }
  if (q.status !== undefined) {
    conditions.push('d.status = ?');
    params.push(q.status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Nome de coluna e direção nunca vêm do cliente: saem de valores fixos do código.
  const column = SORT_COLUMNS[q.sort];
  const direction = q.order === 'asc' ? 'ASC' : 'DESC';
  // Desempate por id para a ordem ser estável entre páginas quando updated_at se repete.
  const orderBy = q.sort === 'id' ? `${column} ${direction}` : `${column} ${direction}, d.id ${direction}`;

  const offset = (q.page - 1) * q.pageSize;

  const [[rows], [countRows]] = await Promise.all([
    db.query<DemandRow[]>(`${SELECT_DEMAND} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [
      ...params,
      q.pageSize,
      offset,
    ]),
    db.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM demand d ${where}`, params),
  ]);

  return { items: rows.map(toDemand), total: Number(countRows[0]?.total ?? 0) };
}

/**
 * Reserva atômica: a condição "ainda está livre" fica no próprio UPDATE.
 * Se duas transações tentarem ao mesmo tempo, o InnoDB serializa as duas na trava da linha
 * e a segunda reavalia o WHERE depois que a primeira confirma, alterando 0 linhas.
 */
export async function tryReserve(db: Db, id: number, userId: number): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE demand
        SET status = 2, worker_id = ?
      WHERE id = ? AND status = 1 AND worker_id IS NULL`,
    [userId, id],
  );
  return result.affectedRows === 1;
}

interface LockedRow extends RowDataPacket {
  status: 1 | 2 | 3;
  worker_id: number | null;
}

/** Lê e trava a linha até o fim da transação (usado no encerramento, que tem regras de permissão). */
export async function lockDemand(db: Db, id: number): Promise<LockedRow | null> {
  const [rows] = await db.query<LockedRow[]>(
    'SELECT status, worker_id FROM demand WHERE id = ? FOR UPDATE',
    [id],
  );
  return rows[0] ?? null;
}

export async function closeDemand(
  db: Db,
  id: number,
  data: { outcome: 'success' | 'failure'; failureReason: string | null; note: string | null },
): Promise<void> {
  await db.execute(
    `UPDATE demand
        SET status = 3, outcome = ?, failure_reason = ?, note = ?
      WHERE id = ?`,
    [data.outcome, data.failureReason, data.note, id],
  );
}

export async function insertTrace(
  db: Db,
  demandId: number,
  userId: number,
  action: 'reserve' | 'finish',
  note: string | null,
): Promise<void> {
  await db.execute(
    'INSERT INTO demand_trace (demand_id, user_id, action, note) VALUES (?, ?, ?, ?)',
    [demandId, userId, action, note],
  );
}
