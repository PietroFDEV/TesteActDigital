import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, cleanup, createDemand, seedUsers, setup, traces, USERS } from './helpers.js';

const { pool, app } = setup();
const [ana, bruno] = USERS;

beforeAll(async () => {
  await app.ready();
  await cleanup(pool);
  await seedUsers(pool);
});
afterAll(async () => {
  await cleanup(pool);
  await app.close();
  await pool.end();
});

const reserve = (id: number, userId: number) =>
  app.inject({ method: 'POST', url: `/demands/${id}/reserve`, headers: as(userId) });

describe('POST /demands/:id/reserve', () => {
  it('duas pessoas ao mesmo tempo: um sucesso e um 409 com o nome de quem ficou', async () => {
    // Repete várias vezes: uma corrida pode "passar por sorte" numa única tentativa.
    for (let round = 0; round < 20; round++) {
      const id = await createDemand(pool);

      const [a, b] = await Promise.all([reserve(id, ana.id), reserve(id, bruno.id)]);

      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
      const winner = a.statusCode === 200 ? a : b;
      const loser = a.statusCode === 200 ? b : a;
      const winnerName = winner.json().worker.name as string;

      expect(loser.json()).toMatchObject({
        error: 'DEMAND_TAKEN',
        message: `Demanda já reservada por ${winnerName}`,
        demand: { status: 2, worker: { name: winnerName } },
      });

      // Exatamente uma linha de histórico, do vencedor.
      const t = await traces(pool, id);
      expect(t).toHaveLength(1);
      expect(t[0]).toMatchObject({ action: 'reserve', user_id: winner.json().worker.id });
    }
  });

  it('cinco pessoas ao mesmo tempo: só uma reserva', async () => {
    const id = await createDemand(pool);
    const results = await Promise.all(USERS.map((u) => reserve(id, u.id)));
    const codes = results.map((r) => r.statusCode);
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(USERS.length - 1);
    expect(await traces(pool, id)).toHaveLength(1);
  });

  it('o mesmo usuário reservando de novo (duas abas) recebe sucesso, sem histórico duplicado', async () => {
    const id = await createDemand(pool);
    const [first, second] = await Promise.all([reserve(id, ana.id), reserve(id, ana.id)]);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json().worker.id).toBe(ana.id);
    expect(await traces(pool, id)).toHaveLength(1);
  });

  it('demanda encerrada devolve 409', async () => {
    const id = await createDemand(pool);
    await reserve(id, ana.id);
    await app.inject({
      method: 'POST',
      url: `/demands/${id}/finish`,
      headers: as(ana.id),
      payload: { outcome: 'success' },
    });
    const res = await reserve(id, bruno.id);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('DEMAND_CLOSED');
  });

  it('demanda inexistente devolve 404 e id inválido devolve 400', async () => {
    expect((await reserve(2_000_000_000, ana.id)).statusCode).toBe(404);
    const bad = await app.inject({ method: 'POST', url: '/demands/abc/reserve', headers: as(ana.id) });
    expect(bad.statusCode).toBe(400);
  });

  it('sem x-user-id devolve 401', async () => {
    const id = await createDemand(pool);
    const res = await app.inject({ method: 'POST', url: `/demands/${id}/reserve` });
    expect(res.statusCode).toBe(401);
  });
});
