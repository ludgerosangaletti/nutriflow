const PUBLIC_ID_PATTERN = /^[a-z][a-z0-9_-]{5,127}$/;
const UNIT_CODE_PATTERN = /^[a-z][a-z0-9_.-]{0,31}$/;

export type PublicId = string & { readonly __brand: "PublicId" };
export type UnitCode = string & { readonly __brand: "UnitCode" };
export type QuantityMilli = number & { readonly __brand: "QuantityMilli" };
export type RevisionToken = number & { readonly __brand: "RevisionToken" };
export type VersionNumber = number & { readonly __brand: "VersionNumber" };
export type SortOrder = number & { readonly __brand: "SortOrder" };

function requireSafeInteger(value: number, field: string, minimum: number) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`NUTRIFLOW_INVALID_VALUE:${field}`);
  }
}

export function publicId(value: string): PublicId {
  if (!PUBLIC_ID_PATTERN.test(value)) {
    throw new Error("NUTRIFLOW_INVALID_VALUE:publicId");
  }
  return value as PublicId;
}

export function unitCode(value: string): UnitCode {
  if (!UNIT_CODE_PATTERN.test(value)) {
    throw new Error("NUTRIFLOW_INVALID_VALUE:unitCode");
  }
  return value as UnitCode;
}

export function quantityMilli(value: number): QuantityMilli {
  requireSafeInteger(value, "quantityMilli", 1);
  return value as QuantityMilli;
}

export function revisionToken(value: number): RevisionToken {
  requireSafeInteger(value, "revision", 1);
  return value as RevisionToken;
}

export function versionNumber(value: number): VersionNumber {
  requireSafeInteger(value, "versionNumber", 1);
  return value as VersionNumber;
}

export function sortOrder(value: number): SortOrder {
  requireSafeInteger(value, "sortOrder", 0);
  return value as SortOrder;
}
