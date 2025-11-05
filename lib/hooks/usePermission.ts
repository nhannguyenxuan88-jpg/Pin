import { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { checkUserPermission } from '@/lib/permissions';

interface UsePermissionOptions {
  app?: 'motocare' | 'pincorp';
  autoCheck?: boolean;
}

/**
 * Hook để kiểm tra quyền hạn của người dùng hiện tại
 */
export function usePermission(
  module: string,
  action: string,
  options: UsePermissionOptions = {}
) {
  const { app = 'motocare', autoCheck = true } = options;
  const { currentUser: user } = useAppContext();
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkPermissionCallback = useCallback(async () => {
    if (!user?.id) {
      setHasPermission(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const hasAccess = await checkUserPermission(user.id, module, action, app);
      setHasPermission(hasAccess);
    } catch (err) {
      console.error('Error checking permission:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setHasPermission(false);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, module, action, app]);

  useEffect(() => {
    if (autoCheck) {
      checkPermissionCallback();
    }
  }, [autoCheck, checkPermissionCallback]);

  return { hasPermission, isLoading, error, checkPermission: checkPermissionCallback };
}

/**
 * Hook để kiểm tra xem người dùng có role nào không
 */
export function useRole(requiredLevel: number = 0, app: 'motocare' | 'pincorp' = 'motocare') {
  const { currentUser: user } = useAppContext();
  const [userLevel, setUserLevel] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      if (!user?.id) {
        setUserLevel(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const { getUserRole } = await import('@/lib/permissions');
        const role = await getUserRole(user.id, app);

        const level = role?.level ?? 0;
        setUserLevel(level);
      } catch (err) {
        console.error('Error checking role:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setUserLevel(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkRole();
  }, [user?.id, app]);

  const hasRole = userLevel !== null && userLevel >= requiredLevel;

  return { hasRole, userLevel, isLoading, error };
}

/**
 * Hook để kiểm tra multiple quyền hạn cùng một lúc
 */
export function useMultiplePermissions(
  permissions: Array<{ module: string; action: string }>,
  app: 'motocare' | 'pincorp' = 'motocare',
  requireAll: boolean = false
) {
  const { currentUser: user } = useAppContext();
  const [results, setResults] = useState<Map<string, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!user?.id) {
        setResults(new Map());
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const permissionResults = new Map<string, boolean>();

        await Promise.all(
          permissions.map(async (perm) => {
            const key = `${perm.module}:${perm.action}`;
            const hasAccess = await checkUserPermission(user.id, perm.module, perm.action, app);
            permissionResults.set(key, hasAccess);
          })
        );

        setResults(permissionResults);
      } catch (err) {
        console.error('Error checking permissions:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setResults(new Map());
      } finally {
        setIsLoading(false);
      }
    };

    checkPermissions();
  }, [user?.id, app, permissions]);

  const hasAll = Array.from(results.values()).every((v) => v);
  const hasAny = Array.from(results.values()).some((v) => v);

  return { results, hasAll, hasAny, isLoading, error };
}

/**
 * Hook để lấy tất cả quyền hạn của người dùng
 */
export function useUserPermissions(app: 'motocare' | 'pincorp' = 'motocare') {
  const { currentUser: user } = useAppContext();
  const [permissions, setPermissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user?.id) {
        setPermissions([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const { getUserPermissions } = await import('@/lib/permissions');
        const userPerms = await getUserPermissions(user.id, app);
        setPermissions(userPerms || []);
      } catch (err) {
        console.error('Error fetching permissions:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setPermissions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPermissions();
  }, [user?.id, app]);

  return { permissions, isLoading, error };
}
