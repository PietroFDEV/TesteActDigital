import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Session } from './session';

export const SCOPE_SUPERVISE = 'demands:supervise';

/** Anexa a identidade simulada a toda requisição para a API. */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(Session);
  const headers: Record<string, string> = { 'x-user-id': String(session.userId()) };
  if (session.supervise()) headers['x-scopes'] = SCOPE_SUPERVISE;
  return next(req.clone({ setHeaders: headers }));
};
