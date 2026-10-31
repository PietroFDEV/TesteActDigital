import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Session } from './core/session';
import { DemandList } from './demands/demand-list';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DemandList],
  template: `
    <header class="topbar">
      <h1>Fila de demandas</h1>
      <div class="identity" role="group" aria-label="Simular usuário">
        <label for="user-id">Operador nº</label>
        <input
          id="user-id"
          type="number"
          min="1"
          inputmode="numeric"
          [value]="session.userId()"
          (change)="setUser($any($event.target).value)"
        />
        <label class="check">
          <input
            type="checkbox"
            [checked]="session.supervise()"
            (change)="session.supervise.set($any($event.target).checked)"
          />
          Supervisão
        </label>
      </div>
    </header>
    <main>
      <app-demand-list />
    </main>
  `,
  styles: `
    :host {
      display: block;
      max-width: 1320px;
      margin: 0 auto;
      padding: var(--space-4);
    }
    .topbar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-5);
    }
    h1 {
      margin: 0;
      font-size: var(--text-xl);
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .identity {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--surface);
      font-size: var(--text-sm);
    }
    .identity input[type='number'] {
      width: 6rem;
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      margin-left: var(--space-2);
    }
  `,
})
export class App {
  protected readonly session = inject(Session);

  protected setUser(value: string): void {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) this.session.userId.set(id);
  }
}
