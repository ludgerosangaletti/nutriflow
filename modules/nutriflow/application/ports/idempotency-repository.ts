export type IdempotencyRecord = Readonly<{
  requestHash: string;
  status: "processing" | "completed" | "failed";
  responseJson: string | null;
  errorCode: string | null;
  correlationId: string;
  expiresAt: string;
}>;

export type BeginIdempotentOperationInput = Readonly<{
  organizationId: number;
  operation: string;
  idempotencyKey: string;
  requestHash: string;
  correlationId: string;
  expiresAt: string;
  now: string;
}>;

export type BeginIdempotentOperationResult =
  | Readonly<{ outcome: "acquired" }>
  | Readonly<{ outcome: "existing"; record: IdempotencyRecord }>;

export interface IdempotencyRepository {
  begin(input: BeginIdempotentOperationInput): Promise<BeginIdempotentOperationResult>;
  complete(input: Readonly<{
    organizationId: number;
    operation: string;
    idempotencyKey: string;
    requestHash: string;
    responseJson: string;
    completedAt: string;
  }>): Promise<void>;
  fail(input: Readonly<{
    organizationId: number;
    operation: string;
    idempotencyKey: string;
    requestHash: string;
    errorCode: string;
    failedAt: string;
  }>): Promise<void>;
}
