import { JWTPayload, ForbiddenError } from "../types.ts";

export function authorize(allowedRoles: Array<'admin' | 'staff' | 'user'>) {
  return (user: JWTPayload) => {
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError(
        `Access denied. Required roles: ${allowedRoles.join(', ')}`
      );
    }
  };
}

export const adminOnly = authorize(['admin']);
export const adminAndStaff = authorize(['admin', 'staff']);
export const allRoles = authorize(['admin', 'staff', 'user']);
