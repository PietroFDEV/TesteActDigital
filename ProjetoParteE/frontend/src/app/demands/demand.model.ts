export type DemandStatus = 1 | 2 | 3;
export type Outcome = 'success' | 'failure';
export type SortField = 'id' | 'updatedAt';
export type SortOrder = 'asc' | 'desc';

export interface Demand {
  id: number;
  title: string;
  queue: string;
  status: DemandStatus;
  worker: { id: number; name: string } | null;
  outcome: Outcome | null;
  failureReason: string | null;
  note: string | null;
  updatedAt: string;
}

export interface DemandPage {
  items: Demand[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DemandQuery {
  page: number;
  pageSize: number;
  queue?: string;
  search?: string;
  status?: DemandStatus;
  sort: SortField;
  order: SortOrder;
}

export type FinishBody =
  | { outcome: 'success'; note?: string }
  | { outcome: 'failure'; failureReason: string; note?: string };

/** Formato de erro da API; em 409 vem também o estado atual da demanda. */
export interface ApiError {
  error: string;
  message: string;
  demand?: Demand;
}

export const STATUS_LABEL: Record<DemandStatus, string> = {
  1: 'Aberta',
  2: 'Reservada',
  3: 'Encerrada',
};

export const FAILURE_REASONS: { key: string; label: string }[] = [
  { key: 'cliente_ausente', label: 'Cliente não atendeu' },
  { key: 'sem_viabilidade', label: 'Sem viabilidade técnica' },
  { key: 'dados_incorretos', label: 'Dados do cliente incorretos' },
  { key: 'duplicada', label: 'Demanda duplicada' },
  { key: 'outro', label: 'Outro motivo' },
];
