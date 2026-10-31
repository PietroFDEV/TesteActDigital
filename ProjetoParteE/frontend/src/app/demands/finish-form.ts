import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { Demand, FAILURE_REASONS, FinishBody, Outcome } from './demand.model';
import { DemandsApi, apiError } from './demands-api';

const NOTE_MAX = 500;

@Component({
  selector: 'app-finish-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './finish-form.html',
  styleUrl: './finish-form.css',
})
export class FinishForm {
  readonly demand = input.required<Demand>();
  /** Encerrou com sucesso: o pai atualiza a linha e fecha o painel. */
  readonly finished = output<Demand>();
  /** A API recusou mas devolveu o estado atual (ex.: 409): o pai atualiza a linha. */
  readonly refreshed = output<Demand>();
  readonly cancelled = output<void>();

  private readonly api = inject(DemandsApi);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly reasons = FAILURE_REASONS;
  protected readonly noteMax = NOTE_MAX;

  protected readonly form = this.fb.group({
    outcome: this.fb.control<Outcome | ''>('', Validators.required),
    failureReason: this.fb.control(''),
    note: this.fb.control('', Validators.maxLength(NOTE_MAX)),
  });

  // statusChanges e valueChanges viram signals: o OnPush re-renderiza quando eles mudam.
  private readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  protected readonly outcome = toSignal(this.form.controls.outcome.valueChanges, {
    initialValue: this.form.controls.outcome.value,
  });
  protected readonly noteLength = toSignal(
    this.form.controls.note.valueChanges.pipe(
      startWith(this.form.controls.note.value),
      map((v) => v.length),
    ),
    { requireSync: true },
  );

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canSubmit = computed(() => this.formStatus() === 'VALID' && !this.submitting());

  constructor() {
    // Validação condicional: o motivo só é obrigatório quando o resultado é "insucesso".
    this.form.controls.outcome.valueChanges.pipe(takeUntilDestroyed()).subscribe((outcome) => {
      const reason = this.form.controls.failureReason;
      if (outcome === 'failure') {
        reason.setValidators(Validators.required);
      } else {
        reason.clearValidators();
        reason.setValue('', { emitEvent: false });
      }
      reason.updateValueAndValidity();
    });

    // Trocar de demanda com o painel aberto limpa o formulário.
    effect(() => {
      this.demand();
      untracked(() => {
        this.form.reset();
        this.error.set(null);
      });
    });
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    const { outcome, failureReason, note } = this.form.getRawValue();
    const trimmedNote = note.trim() || undefined;
    const body: FinishBody =
      outcome === 'failure'
        ? { outcome, failureReason, note: trimmedNote }
        : { outcome: 'success', note: trimmedNote };

    this.submitting.set(true);
    this.error.set(null);
    this.api.finish(this.demand().id, body).subscribe({
      next: (demand) => {
        this.submitting.set(false);
        this.finished.emit(demand);
      },
      error: (err) => {
        this.submitting.set(false);
        const body = apiError(err);
        if (body?.demand) this.refreshed.emit(body.demand);
        this.error.set(body?.message ?? 'Não foi possível encerrar. Verifique a conexão e tente de novo.');
      },
    });
  }
}
