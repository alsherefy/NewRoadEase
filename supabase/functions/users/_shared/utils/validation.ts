import { ValidationError } from "../types.ts";

export function validateUUID(value: string, fieldName: string = "ID"): void {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(value)) {
    throw new ValidationError(`Invalid ${fieldName}`, []);
  }
}

export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    throw new ValidationError("Invalid email format", []);
  }
}

export function validateRequired(
  value: any,
  fieldName: string
): void {
  if (value === null || value === undefined || value === "") {
    throw new ValidationError(`${fieldName} is required`, []);
  }
}