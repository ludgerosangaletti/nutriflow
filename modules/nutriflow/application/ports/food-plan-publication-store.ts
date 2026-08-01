import type { DomainEvent } from "../../domain/events/domain-event.ts";
import type { NewAuditEntry } from "./audit-repository.ts";

export type PublishFoodPlanRecord = Readonly<{
  organizationId: number;
  clientId: number;
  planPublicId: string;
  planVersionPublicId: string;
  publicationPublicId: string;
  expectedRevision: number;
  finalRevision: number;
  snapshotJson: string;
  contentHash: string;
  actorAuthUserId: string;
  audit: NewAuditEntry;
  event: DomainEvent;
  publishedAt: string;
}>;

export interface FoodPlanPublicationStore {
  publish(record: PublishFoodPlanRecord): Promise<void>;
}

