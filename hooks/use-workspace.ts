'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  type WorkspacePermissions,
  type WorkspaceRole,
  DEFAULT_WORKSPACE_PERMISSIONS,
  parseWorkspacePermissions,
  getPermissionKeyForRoute,
} from '@/lib/workspace';

interface WorkspaceState {
  /** The effective owner user ID (owner's ID if member, own ID otherwise) */
  workspaceUserId: string | null;
  /** 'owner' if the user is the workspace owner, otherwise their role */
  workspaceRole: 'owner' | WorkspaceRole;
  /** Parsed permissions — all true for owners */
  permissions: WorkspacePermissions;
  /** True if the workspace data is still loading */
  loading: boolean;
  /** Check if current user has access to a given route */
  hasPermission: (pathname: string) => boolean;
  /** Reload workspace state */
  refresh: () => void;
}

export function useWorkspace(): WorkspaceState {
  const { user } = useAuth();
  const [workspaceUserId, setWorkspaceUserId] = useState<string | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<'owner' | WorkspaceRole>('owner');
  const [permissions, setPermissions] = useState<WorkspacePermissions>(DEFAULT_WORKSPACE_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setWorkspaceUserId(null);
      setWorkspaceRole('owner');
      setPermissions({ ...DEFAULT_WORKSPACE_PERMISSIONS });
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('workspace_memberships')
      .select('owner_user_id, role, permissions')
      .eq('member_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (data) {
      setWorkspaceUserId(data.owner_user_id);
      setWorkspaceRole(data.role as WorkspaceRole);
      setPermissions(parseWorkspacePermissions(data.permissions));
    } else {
      setWorkspaceUserId(user.id);
      setWorkspaceRole('owner');
      setPermissions({ ...DEFAULT_WORKSPACE_PERMISSIONS });
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasPermission = useCallback(
    (pathname: string): boolean => {
      if (workspaceRole === 'owner' || workspaceRole === 'admin') return true;
      const key = getPermissionKeyForRoute(pathname);
      if (!key) return true;
      return permissions[key];
    },
    [workspaceRole, permissions],
  );

  return {
    workspaceUserId,
    workspaceRole,
    permissions,
    loading,
    hasPermission,
    refresh: load,
  };
}
