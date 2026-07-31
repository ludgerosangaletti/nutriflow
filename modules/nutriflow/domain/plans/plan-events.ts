import {
  createDomainEvent,
  type CreateDomainEventInput,
  type DomainEvent,
} from "../events/domain-event.ts";

export const PLAN_DRAFT_CREATED = "nutriflow.plan-draft-created.v1";
export const PLAN_DRAFT_SAVED = "nutriflow.plan-draft-saved.v1";
export const PLAN_VERSION_PUBLISHED = "nutriflow.plan-version-published.v1";
export const PLAN_PUBLICATION_REVOKED = "nutriflow.plan-publication-revoked.v1";

export type PlanDraftCreatedPayload = Readonly<{
  planPublicId: string;
  planVersionPublicId: string;
  clientId: number;
  title: string;
}>;

export type PlanDraftSavedPayload = Readonly<{
  planPublicId: string;
  planVersionPublicId: string;
  clientId: number;
  revision: number;
}>;

export type PlanVersionPublishedPayload = Readonly<{
  planPublicId: string;
  planVersionPublicId: string;
  publicationPublicId: string;
  clientId: number;
  contentHash: string;
}>;

export type PlanPublicationRevokedPayload = Readonly<{
  planPublicId: string;
  planVersionPublicId: string;
  publicationPublicId: string;
  clientId: number;
  reason: string;
}>;

type PlanEventInput<TPayload extends Readonly<Record<string, string | number>>> =
  Omit<
    CreateDomainEventInput<TPayload>,
    "eventType" | "eventVersion" | "aggregateType"
  >;

export function planDraftCreated(
  input: PlanEventInput<PlanDraftCreatedPayload>,
): DomainEvent<PlanDraftCreatedPayload> {
  return createDomainEvent({
    ...input,
    eventType: PLAN_DRAFT_CREATED,
    eventVersion: 1,
    aggregateType: "food-plan",
  });
}

export function planDraftSaved(
  input: PlanEventInput<PlanDraftSavedPayload>,
): DomainEvent<PlanDraftSavedPayload> {
  return createDomainEvent({
    ...input,
    eventType: PLAN_DRAFT_SAVED,
    eventVersion: 1,
    aggregateType: "food-plan",
  });
}

export function planVersionPublished(
  input: PlanEventInput<PlanVersionPublishedPayload>,
): DomainEvent<PlanVersionPublishedPayload> {
  return createDomainEvent({
    ...input,
    eventType: PLAN_VERSION_PUBLISHED,
    eventVersion: 1,
    aggregateType: "food-plan",
  });
}

export function planPublicationRevoked(
  input: PlanEventInput<PlanPublicationRevokedPayload>,
): DomainEvent<PlanPublicationRevokedPayload> {
  return createDomainEvent({
    ...input,
    eventType: PLAN_PUBLICATION_REVOKED,
    eventVersion: 1,
    aggregateType: "food-plan",
  });
}
