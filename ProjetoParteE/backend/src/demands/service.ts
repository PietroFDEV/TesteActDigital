import type { Pool, PoolConnection } from 'mysql2/promise';
import * as repo from './repository.js';
import { DemandStatus, type Demand, type FinishBody } from './schemas.js';

/** Abre uma transação, garante rollback em erro e sempre devolve a conexão ao pool. */
async function inTransaction<T>(pool: Pool, work: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

export type ReserveResult =
  | { kind: 'reserved'; demand: Demand }
  | { kind: 'already-yours'; demand: Demand }
  | { kind: 'taken'; demand: Demand }
  | { kind: 'closed'; demand: Demand }
  | { kind: 'not-found' };

export async function reserveDemand(pool: Pool, id: number, userId: number): Promise<ReserveResult> {
  const won = await inTransaction(pool, async (conn) => {
    const ok = await repo.tryReserve(conn, id, userId);
    // O histórico entra na mesma transação: ou as duas coisas acontecem, ou nenhuma.
    if (ok) await repo.insertTrace(conn, id, userId, 'reserve', null);
    return ok;
  });

  // Lido depois do commit, fora da transação: enxerga o estado já confirmado por quem venceu.
  const demand = await repo.findDemand(pool, id);
  if (!demand) return { kind: 'not-found' };
  if (won) return { kind: 'reserved', demand };

  if (demand.status === DemandStatus.RESERVED && demand.worker?.id === userId) {
    // Mesmo usuário clicando de novo (outra aba, duplo clique): sucesso idempotente, sem novo histórico.
    return { kind: 'already-yours', demand };
  }
  if (demand.status === DemandStatus.CLOSED) return { kind: 'closed', demand };
  return { kind: 'taken', demand };
}

export type FinishResult =
  | { kind: 'finished'; demand: Demand }
  | { kind: 'not-found' }
  | { kind: 'not-reserved'; demand: Demand }
  | { kind: 'forbidden' };

export async function finishDemand(
  pool: Pool,
  id: number,
  actor: { userId: number; canSupervise: boolean },
  body: FinishBody,
): Promise<FinishResult> {
  const outcome = await inTransaction(pool, async (conn) => {
    // FOR UPDATE: a linha fica travada só durante esta transação curta (nada de esperar o usuário).
    const row = await repo.lockDemand(conn, id);
    if (!row) return 'not-found' as const;
    if (row.status !== DemandStatus.RESERVED) return 'not-reserved' as const;

    // Regra por recurso: depende de quem reservou ESTA demanda, por isso fica aqui e não no hook.
    const isOwner = row.worker_id === actor.userId;
    if (!isOwner && !actor.canSupervise) return 'forbidden' as const;

    const note = body.note ? body.note : null;
    await repo.closeDemand(conn, id, {
      outcome: body.outcome,
      failureReason: body.outcome === 'failure' ? body.failureReason : null,
      note,
    });
    await repo.insertTrace(conn, id, actor.userId, 'finish', note);
    return 'finished' as const;
  });

  if (outcome === 'not-found' || outcome === 'forbidden') return { kind: outcome };
  const demand = await repo.findDemand(pool, id);
  if (!demand) return { kind: 'not-found' };
  return { kind: outcome, demand };
}
