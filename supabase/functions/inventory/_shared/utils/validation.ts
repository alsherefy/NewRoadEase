import { ValidationError } from "../_shared/types.ts";

export function validateCustomer(data: any): void {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== "string" || data.name.trim() === "") {
    errors.push("Name is required and must be a non-empty string");
  }

  if (!data.phone || typeof data.phone !== "string" || data.phone.trim() === "") {
    errors.push("Phone is required and must be a non-empty string");
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push("Invalid email format");
  }

  if (errors.length > 0) {
    throw new ValidationError("Customer validation failed", errors);
  }
}

export function validateVehicle(data: any): void {
  const errors: string[] = [];

  if (!data.car_make || typeof data.car_make !== "string" || data.car_make.trim() === "") {
    errors.push("Car make is required");
  }

  if (!data.car_model || typeof data.car_model !== "string" || data.car_model.trim() === "") {
    errors.push("Car model is required");
  }

  if (!data.plate_number || typeof data.plate_number !== "string" || data.plate_number.trim() === "") {
    errors.push("Plate number is required");
  }

  if (errors.length > 0) {
    throw new ValidationError("Vehicle validation failed", errors);
  }
}

export function validateWorkOrder(data: any): void {
  const errors: string[] = [];

  if (!data.customer_id) {
    errors.push("Customer ID is required");
  }

  if (!data.vehicle_id) {
    errors.push("Vehicle ID is required");
  }

  if (!data.description || typeof data.description !== "string" || data.description.trim() === "") {
    errors.push("Description is required");
  }

  if (errors.length > 0) {
    throw new ValidationError("Work order validation failed", errors);
  }
}

export function validateId(id: string | undefined, resourceName: string): string {
  if (!id || id.trim() === "") {
    throw new ValidationError(`${resourceName} ID is required`, [
      `${resourceName} ID cannot be empty`,
    ]);
  }
  return id;
}

export function validatePagination(params: any): { limit: number; offset: number } {
  const limit = Math.min(Math.max(1, parseInt(params.limit || "50")), 100);
  const offset = Math.max(0, parseInt(params.offset || "0"));

  return { limit, offset };
}

export function validateUUID(id: string | undefined, fieldName: string = "ID"): string {
  if (!id || id.trim() === "") {
    throw new ValidationError(`${fieldName} is required`, [`${fieldName} cannot be empty`]);
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new ValidationError(`Invalid ${fieldName}`, [`${fieldName} must be a valid UUID`]);
  }

  return id;
}

export function validateRequired(
  value: any,
  fieldName: string,
  type: "string" | "number" | "boolean" | "array" | "object" = "string"
): void {
  if (value === null || value === undefined) {
    throw new ValidationError(`${fieldName} is required`, [`${fieldName} is required`]);
  }

  if (type === "string" && (typeof value !== "string" || value.trim() === "")) {
    throw new ValidationError(`${fieldName} is required`, [`${fieldName} must be a non-empty string`]);
  }

  if (type === "number" && (typeof value !== "number" || isNaN(value))) {
    throw new ValidationError(`${fieldName} is invalid`, [`${fieldName} must be a valid number`]);
  }

  if (type === "boolean" && typeof value !== "boolean") {
    throw new ValidationError(`${fieldName} is invalid`, [`${fieldName} must be a boolean`]);
  }

  if (type === "array" && !Array.isArray(value)) {
    throw new ValidationError(`${fieldName} is invalid`, [`${fieldName} must be an array`]);
  }

  if (type === "object" && (typeof value !== "object" || Array.isArray(value))) {
    throw new ValidationError(`${fieldName} is invalid`, [`${fieldName} must be an object`]);
  }
}

export function validateEmail(email: string | undefined, fieldName: string = "Email"): void {
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError(`Invalid ${fieldName}`, [`${fieldName} format is invalid`]);
  }
}

export function validateEnum<T extends string>(
  value: T | undefined,
  allowedValues: readonly T[],
  fieldName: string
): void {
  if (value && !allowedValues.includes(value)) {
    throw new ValidationError(`Invalid ${fieldName}`, [
      `${fieldName} must be one of: ${allowedValues.join(", ")}`,
    ]);
  }
}

export function validateMinMax(
  value: number | undefined,
  fieldName: string,
  min?: number,
  max?: number
): void {
  if (value === undefined || value === null) return;

  if (min !== undefined && value < min) {
    throw new ValidationError(`${fieldName} is too small`, [
      `${fieldName} must be at least ${min}`,
    ]);
  }

  if (max !== undefined && value > max) {
    throw new ValidationError(`${fieldName} is too large`, [
      `${fieldName} must be at most ${max}`,
    ]);
  }
}

export function validateRequestBody<T>(req: Request, requiredFields?: string[]): Promise<T> {
  return req.json().then((body: any) => {
    if (requiredFields) {
      const errors: string[] = [];
      for (const field of requiredFields) {
        if (!body[field]) {
          errors.push(`${field} is required`);
        }
      }
      if (errors.length > 0) {
        throw new ValidationError("Validation failed", errors);
      }
    }
    return body as T;
  });
}