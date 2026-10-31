import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
import type { Pool } from 'mysql2/promise';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { registerAuth } from './auth.js';
import { demandRoutes } from './demands/routes.js';

export function buildApp(opts: { pool: Pool; logger?: FastifyServerOptions['logger'] }) {
  const app = Fastify({ logger: opts.logger ?? true }).withTypeProvider<ZodTypeProvider>();

  // Zod passa a validar a entrada e a serializar a saída de todas as rotas.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler<FastifyError>((err, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Requisição inválida',
        details: err.validation.map((v) => ({
          // Ex.: "body.failureReason", "querystring.status"
          path: [err.validationContext, ...v.instancePath.split('/')].filter(Boolean).join('.'),
          message: v.message,
        })),
      });
    }
    const status = err.statusCode ?? 500;
    if (status >= 500) {
      req.log.error(err);
      // Nunca devolver detalhes internos ao cliente.
      return reply.code(500).send({ error: 'INTERNAL', message: 'Erro interno' });
    }
    return reply.code(status).send({ error: err.code ?? 'ERROR', message: err.message });
  });

  app.get('/health', async () => ({ ok: true }));

  // Escopo encapsulado: o hook de autenticação vale só para as rotas registradas aqui dentro.
  app.register(async (scoped) => {
    registerAuth(scoped);
    await scoped.register(demandRoutes, { pool: opts.pool });
  });

  return app;
}
