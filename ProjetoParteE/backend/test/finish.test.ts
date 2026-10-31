import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, cleanup, createDemand, seedUsers, setup, traces, USERS } from './helpers.js';

const { pool, app } = setup();
const [ana, bruno, carla] = USERS;

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

async function reservedBy(userId: number) {
  const id = await createDemand(pool);
  const r = await app.inject({ method: 'POST', url: `/demands/${id}/reserve`, headers: as(userId) });
  expect(r.statusCode).toBe(200);
  return id;
}

const finish = (id: number, headers: Record<string, string>, payload: unknown) =>
  app.inject({ method: 'POST', url: `/demands/${id}/finish`, headers, payload: payload as object });

describe('POST /demands/:id/finish', () => {
  it('dono encerra com sucesso e grava o histórico', async () => {
    const id = await reservedBy(ana.id);
    const res = await finish(id, as(ana.id), { outcome: 'success', note: '  resolvido  ' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 3, outcome: 'success', failureReason: null, note: 'resolvido' });
    expect((await traces(pool, id)).map((t) => t.action)).toEqual(['reserve', 'finish']);
  });

  it('insucesso exige o motivo', async () => {
    const id = await reservedBy(ana.id);
    const res = await finish(id, as(ana.id), { outcome: 'failure' });
    expect(res.statusCode).toBe(400);
    expect(res.json().details[0].path).toBe('body.failureReason');

    const ok = await finish(id, as(ana.id), { outcome: 'failure', failureReason: 'cliente_ausente' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().failureReason).toBe('cliente_ausente');
  });

  it('rejeita observação com mais de 500 caracteres e outcome desconhecido', async () => {
    const id = await reservedBy(ana.id);
    expect((await finish(id, as(ana.id), { outcome: 'success', note: 'x'.repeat(501) })).statusCode).toBe(400);
    expect((await finish(id, as(ana.id), { outcome: 'talvez' })).statusCode).toBe(400);
    // 500 caracteres depois do trim é válido
    expect((await finish(id, as(ana.id), { outcome: 'success', note: ` ${'x'.repeat(500)} ` })).statusCode).toBe(200);
  });

  it('outra pessoa sem escopo de supervisão recebe 403 e nada muda', async () => {
    const id = await reservedBy(ana.id);
    const res = await finish(id, as(bruno.id), { outcome: 'success' });
    expect(res.statusCode).toBe(403);
    expect(await traces(pool, id)).toHaveLength(1); // só a reserva
  });

  it('supervisão encerra demanda de outra pessoa', async () => {
    const id = await reservedBy(ana.id);
    const res = await finish(id, as(carla.id, 'demands:read, demands:supervise'), { outcome: 'success' });
    expect(res.statusCode).toBe(200);
    const t = await traces(pool, id);
    expect(t[1]).toMatchObject({ action: 'finish', user_id: carla.id });
  });

  it('demanda aberta ou já encerrada devolve 409', async () => {
    const open = await createDemand(pool);
    expect((await finish(open, as(ana.id, 'demands:supervise'), { outcome: 'success' })).statusCode).toBe(409);

    const id = await reservedBy(ana.id);
    await finish(id, as(ana.id), { outcome: 'success' });
    const again = await finish(id, as(ana.id), { outcome: 'success' });
    expect(again.statusCode).toBe(409);
    expect(again.json().demand.status).toBe(3);
  });
});

describe('GET /demands', () => {
  it('pagina, filtra e devolve o total', async () => {
    for (let i = 0; i < 5; i++) await createDemand(pool, `Lista ${i}`);
    const res = await app.inject({
      method: 'GET',
      url: '/demands?queue=__teste__&status=1&pageSize=2&page=2&sort=id&order=asc',
      headers: as(ana.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.page).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.total).toBeGreaterThanOrEqual(5);
    expect(body.items[0].id).toBeLessThan(body.items[1].id);
  });

  it('busca por parte do título, nº da demanda e nome do responsável', async () => {
    const id = await createDemand(pool, 'Roteador piscando luz vermelha');
    const get = async (search: string) => {
      const res = await app.inject({
        method: 'GET',
        url: `/demands?queue=__teste__&search=${encodeURIComponent(search)}`,
        headers: as(ana.id),
      });
      expect(res.statusCode).toBe(200);
      return res.json().items.map((d: { id: number }) => d.id) as number[];
    };

    expect(await get('luz verm')).toEqual([id]);
    expect(await get(String(id))).toContain(id);

    await app.inject({ method: 'POST', url: `/demands/${id}/reserve`, headers: as(bruno.id) });
    expect(await get('Bruno')).toContain(id);
  });

  it('busca trata % e _ como texto, não como curinga', async () => {
    const id = await createDemand(pool, 'Desconto de 50% na fatura');
    await createDemand(pool, 'Demanda sem porcentagem');
    const res = await app.inject({
      method: 'GET',
      url: `/demands?queue=__teste__&search=${encodeURIComponent('50%')}`,
      headers: as(ana.id),
    });
    expect(res.json().items.map((d: { id: number }) => d.id)).toEqual([id]);

    const all = await app.inject({
      method: 'GET',
      url: `/demands?queue=__teste__&search=${encodeURIComponent('%')}`,
      headers: as(ana.id),
    });
    expect(all.json().total).toBe(1);
  });

  it('lista as filas existentes', async () => {
    const res = await app.inject({ method: 'GET', url: '/demands/queues', headers: as(ana.id) });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toContain('__teste__');
  });

  it('campo de filtro ou ordenação desconhecido devolve 400', async () => {
    for (const qs of ['owner=1', 'sort=title', 'order=up', 'status=9', 'pageSize=1000']) {
      const res = await app.inject({ method: 'GET', url: `/demands?${qs}`, headers: as(ana.id) });
      expect(res.statusCode, qs).toBe(400);
    }
  });
});
