import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Session } from '../core/session';
import {
  Demand,
  DemandQuery,
  DemandStatus,
  FAILURE_REASONS,
  STATUS_LABEL,
  SortField,
  SortOrder,
} from './demand.model';
import { DemandsApi, apiError } from './demands-api';
import { FinishForm } from './finish-form';

const PAGE_SIZE = 20;
const REASON_LABEL = new Map(FAILURE_REASONS.map((r) => [r.key, r.label]));

interface RowMessage {
  kind: 'error' | 'success';
  text: string;
}

@Component({
  selector: 'app-demand-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FinishForm],
  templateUrl: './demand-list.html',
  styleUrl: './demand-list.css',
})
export class DemandList {
  private readonly api = inject(DemandsApi);
  protected readonly session = inject(Session);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusOptions: DemandStatus[] = [1, 2, 3];

  // Estado dos filtros: cada mudança gera uma nova consulta.
  protected readonly queue = signal('');
  protected readonly status = signal<DemandStatus | null>(null);
  protected readonly sort = signal<SortField>('id');
  protected readonly order = signal<SortOrder>('desc');
  protected readonly page = signal(1);

  private readonly query = computed<DemandQuery>(() => ({
    page: this.page(),
    pageSize: PAGE_SIZE,
    queue: this.queue() || undefined,
    status: this.status() ?? undefined,
    sort: this.sort(),
    order: this.order(),
  }));

  /**
   * rxResource refaz a requisição sempre que `query` muda e cancela a anterior
   * (a resposta de um filtro antigo nunca sobrescreve a do filtro novo).
   */
  protected readonly demands = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.list(params),
  });

  protected readonly totalPages = computed(() => {
    const total = this.demands.value()?.total ?? 0;
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  });

  /** Ids com uma requisição de reserva em andamento (evita clique duplo). */
  protected readonly pending = signal<ReadonlySet<number>>(new Set());
  protected readonly messages = signal<ReadonlyMap<number, RowMessage>>(new Map());
  protected readonly finishing = signal<Demand | null>(null);

  protected setQueue(value: string): void {
    this.queue.set(value.trim());
    this.page.set(1);
  }

  protected setStatus(value: string): void {
    this.status.set(value ? (Number(value) as DemandStatus) : null);
    this.page.set(1);
  }

  protected toggleSort(field: SortField): void {
    if (this.sort() === field) {
      this.order.update((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sort.set(field);
      this.order.set('desc');
    }
    this.page.set(1);
  }

  protected ariaSort(field: SortField): 'ascending' | 'descending' | 'none' {
    if (this.sort() !== field) return 'none';
    return this.order() === 'asc' ? 'ascending' : 'descending';
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  protected isMine(d: Demand): boolean {
    return d.worker?.id === this.session.userId();
  }

  protected canFinish(d: Demand): boolean {
    return d.status === 2 && (this.isMine(d) || this.session.supervise());
  }

  protected reasonLabel(key: string | null): string {
    return key ? (REASON_LABEL.get(key) ?? key) : '';
  }

  protected reserve(d: Demand): void {
    if (this.pending().has(d.id)) return;
    this.setPending(d.id, true);
    this.setMessage(d.id, null);

    this.api.reserve(d.id).subscribe({
      next: (updated) => {
        this.setPending(d.id, false);
        this.replaceRow(updated);
        this.setMessage(d.id, { kind: 'success', text: 'Reservada para você' });
      },
      error: (err) => {
        this.setPending(d.id, false);
        const body = apiError(err);
        // O 409 traz o estado atual: atualiza só esta linha, sem recarregar a lista.
        if (body?.demand) this.replaceRow(body.demand);
        this.setMessage(d.id, {
          kind: 'error',
          text: body?.message ?? 'Não foi possível reservar. Verifique a conexão e tente de novo.',
        });
      },
    });
  }

  protected openFinish(d: Demand): void {
    this.finishing.set(d);
  }

  protected onFinished(d: Demand): void {
    this.replaceRow(d);
    this.finishing.set(null);
    this.setMessage(d.id, { kind: 'success', text: 'Demanda encerrada' });
  }

  protected replaceRow(updated: Demand): void {
    this.demands.update((page) =>
      page ? { ...page, items: page.items.map((d) => (d.id === updated.id ? updated : d)) } : page,
    );
    if (this.finishing()?.id === updated.id && updated.status !== 2) this.finishing.set(updated);
  }

  private setPending(id: number, on: boolean): void {
    this.pending.update((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private setMessage(id: number, message: RowMessage | null): void {
    this.messages.update((m) => {
      const next = new Map(m);
      if (message) next.set(id, message);
      else next.delete(id);
      return next;
    });
  }
}
