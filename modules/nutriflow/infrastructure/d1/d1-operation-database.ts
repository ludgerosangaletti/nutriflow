export interface D1OperationResultLike {
  readonly meta?: Readonly<{ changes?: number }>;
}

export interface D1OperationStatementLike {
  bind(...values: unknown[]): D1OperationStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1OperationResultLike>;
}

export interface D1OperationDatabaseLike {
  prepare(query: string): D1OperationStatementLike;
}
