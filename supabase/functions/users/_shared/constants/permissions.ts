export const PERMISSION_ACTIONS = {
  VIEW: "view",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
} as const;

export type PermissionAction =
  typeof PERMISSION_ACTIONS[keyof typeof PERMISSION_ACTIONS];