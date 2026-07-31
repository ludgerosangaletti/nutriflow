import type { NutriFlowErrorCode } from "../../contracts/v1/errors.ts";

export class NutriFlowApplicationError extends Error {
  readonly code: NutriFlowErrorCode;
  readonly httpStatus: number;

  constructor(code: NutriFlowErrorCode, message: string, httpStatus: number) {
    super(message);
    this.name = "NutriFlowApplicationError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
