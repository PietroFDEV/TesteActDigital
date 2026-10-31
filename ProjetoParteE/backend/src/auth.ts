import type { FastifyInstance } from 'fastify';

export const SCOPE_SUPERVISE = 'demands:supervise';

export interface Auth {
  userId: number;
  scopes: ReadonlySet<string>;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: Auth;
  }
}

/**
 * Autenticação simplificada pedida no desafio: usuário em `x-user-id`, escopos em `x-scopes`
 * (separados por vírgula). Num sistema real isso viria de um JWT verificado.
 */
export function registerAuth(app: FastifyInstance) {
  app.decorateRequest('auth', null as unknown as Auth);

  app.addHook('onRequest', async (req, reply) => {
    const rawId = req.headers['x-user-id'];
    const userId = typeof rawId === 'string' ? Number(rawId) : NaN;
    if (!Number.isInteger(userId) || userId <= 0) {
      return reply
        .code(401)
        .send({ error: 'UNAUTHENTICATED', message: 'Informe um x-user-id válido' });
    }

    const rawScopes = req.headers['x-scopes'];
    const scopes = new Set(
      (typeof rawScopes === 'string' ? rawScopes : '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );

    req.auth = { userId, scopes };
  });
}
