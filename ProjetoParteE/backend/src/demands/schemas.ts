import { z } from 'zod';

export const DemandStatus = { OPEN: 1, RESERVED: 2, CLOSED: 3 } as const;

export const DemandSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  queue: z.string(),
  status: z.literal([DemandStatus.OPEN, DemandStatus.RESERVED, DemandStatus.CLOSED]),
  worker: z.object({ id: z.number().int(), name: z.string() }).nullable(),
  outcome: z.enum(['success', 'failure']).nullable(),
  failureReason: z.string().nullable(),
  note: z.string().nullable(),
  updatedAt: z.string(),
});
export type Demand = z.infer<typeof DemandSchema>;

/** Colunas que o cliente pode usar para ordenar, mapeadas para SQL fixo (lista branca). */
export const SORT_COLUMNS = { id: 'd.id', updatedAt: 'd.updated_at' } as const;

// strictObject: qualquer parâmetro desconhecido na query string vira 400, como o desafio pede.
export const ListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  queue: z.string().trim().min(1).max(40).optional(),
  status: z.coerce
    .number()
    .pipe(z.literal([DemandStatus.OPEN, DemandStatus.RESERVED, DemandStatus.CLOSED]))
    .optional(),
  sort: z.enum(['id', 'updatedAt']).default('id'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListQuery = z.infer<typeof ListQuerySchema>;

export const DemandPageSchema = z.object({
  items: z.array(DemandSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type DemandPage = z.infer<typeof DemandPageSchema>;

export const IdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const note = z.string().trim().max(500).optional();

// União discriminada: o valor de `outcome` decide quais campos o corpo precisa ter.
export const FinishBodySchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('success'), note }),
  z.object({
    outcome: z.literal('failure'),
    failureReason: z.string().trim().min(1).max(40),
    note,
  }),
]);
export type FinishBody = z.infer<typeof FinishBodySchema>;

export const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  /** Estado atual da demanda, para a tela atualizar a linha sem recarregar. */
  demand: DemandSchema.optional(),
});
