import { ValidationError } from "../types.ts";

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
