import type { Pool } from 'mysql2/promise';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { SCOPE_SUPERVISE } from '../auth.js';
import { listDemands, listQueues } from './repository.js';
import { finishDemand, reserveDemand } from './service.js';
import {
  DemandPageSchema,
  DemandSchema,
  ErrorSchema,
  FinishBodySchema,
  IdParamsSchema,
  ListQuerySchema,
  QueueListSchema,
} from './schemas.js';

export const demandRoutes: FastifyPluginAsyncZod<{ pool: Pool }> = async (app, { pool }) => {
  app.get(
    '/demands',
    { schema: { querystring: ListQuerySchema, response: { 200: DemandPageSchema } } },
    async (req) => {
      const { items, total } = await listDemands(pool, req.query);
      return { items, total, page: req.query.page, pageSize: req.query.pageSize };
    },
  );

  app.get(
    '/demands/queues',
    { schema: { response: { 200: QueueListSchema } } },
    async () => ({ items: await listQueues(pool) }),
  );

  app.post(
    '/demands/:id/reserve',
    {
      schema: {
        params: IdParamsSchema,
        response: { 200: DemandSchema, 404: ErrorSchema, 409: ErrorSchema },
      },
    },
    async (req, reply) => {
      const result = await reserveDemand(pool, req.params.id, req.auth.userId);
      switch (result.kind) {
        case 'reserved':
        case 'already-yours':
          return reply.code(200).send(result.demand);
        case 'not-found':
          return reply.code(404).send({ error: 'NOT_FOUND', message: 'Demanda não encontrada' });
        case 'closed':
          return reply.code(409).send({
            error: 'DEMAND_CLOSED',
            message: 'Esta demanda já foi encerrada',
            demand: result.demand,
          });
        case 'taken':
          return reply.code(409).send({
            error: 'DEMAND_TAKEN',
            message: `Demanda já reservada por ${result.demand.worker?.name ?? 'outra pessoa'}`,
            demand: result.demand,
          });
      }
    },
  );

  app.post(
    '/demands/:id/finish',
    {
      schema: {
        params: IdParamsSchema,
        body: FinishBodySchema,
        response: { 200: DemandSchema, 403: ErrorSchema, 404: ErrorSchema, 409: ErrorSchema },
      },
    },
    async (req, reply) => {
      const result = await finishDemand(
        pool,
        req.params.id,
        { userId: req.auth.userId, canSupervise: req.auth.scopes.has(SCOPE_SUPERVISE) },
        req.body,
      );
      switch (result.kind) {
        case 'finished':
          return reply.code(200).send(result.demand);
        case 'not-found':
          return reply.code(404).send({ error: 'NOT_FOUND', message: 'Demanda não encontrada' });
        case 'forbidden':
          return reply.code(403).send({
            error: 'FORBIDDEN',
            message: 'Só quem reservou a demanda ou a supervisão pode encerrá-la',
          });
        case 'not-reserved':
          return reply.code(409).send({
            error: 'NOT_RESERVED',
            message:
              result.demand.status === 3
                ? 'Esta demanda já foi encerrada'
                : 'A demanda precisa estar reservada para ser encerrada',
            demand: result.demand,
          });
      }
    },
  );
};
