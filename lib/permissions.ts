export type AppName = "motocare" | "pincorp";

export type PermissionRole = {
  name?: string;
  level?: number;
};

// Standalone stub implementations.
// If/when a real permission system is added, replace these with real logic.

export async function checkUserPermission(
  _userId: string,
  _module: string,
  _action: string,
  _app: AppName = "motocare"
): Promise<boolean> {
  return false;
}

export async function getUserRole(
  _userId: string,
  _app: AppName = "motocare"
): Promise<PermissionRole | null> {
  return null;
}

export async function getUserPermissions(
  _userId: string,
  _app: AppName = "motocare"
): Promise<Array<{ module: string; action: string }> | null> {
  return null;
}
