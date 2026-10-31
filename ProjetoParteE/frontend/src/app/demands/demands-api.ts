import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiError, Demand, DemandPage, DemandQuery, FinishBody } from './demand.model';

@Injectable({ providedIn: 'root' })
export class DemandsApi {
  private readonly http = inject(HttpClient);

  list(query: DemandQuery): Observable<DemandPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      // Só envia o que foi preenchido: a API recusa parâmetros vazios ou desconhecidos.
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return this.http.get<DemandPage>('/demands', { params });
  }

  queues(): Observable<string[]> {
    return this.http.get<{ items: string[] }>('/demands/queues').pipe(map((r) => r.items));
  }

  reserve(id: number): Observable<Demand> {
    return this.http.post<Demand>(`/demands/${id}/reserve`, {});
  }

  finish(id: number, body: FinishBody): Observable<Demand> {
    return this.http.post<Demand>(`/demands/${id}/finish`, body);
  }
}

/** Extrai o corpo de erro padronizado da API, quando houver. */
export function apiError(err: unknown): ApiError | null {
  if (err instanceof HttpErrorResponse && err.error && typeof err.error.message === 'string') {
    return err.error as ApiError;
  }
  return null;
}
