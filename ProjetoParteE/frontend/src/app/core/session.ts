import { Injectable, signal } from '@angular/core';

/**
 * Identidade simulada do operador. O desafio substitui o login por headers,
 * então a tela deixa trocar de usuário para testar a disputa entre duas pessoas.
 */
@Injectable({ providedIn: 'root' })
export class Session {
  readonly userId = signal(1);
  readonly supervise = signal(false);
}
