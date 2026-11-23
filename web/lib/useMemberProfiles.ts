"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { profileKey, type MemberProfile, type MemberProfiles } from "@/web/lib/memberProfiles";

/**
 * Corteca's client classification (Type / Manufacturer / Model) for a network, read in the background
 * after each load (`snapshot` changes on Refresh). Null until it arrives or when it fails; the client
 * table then falls back to the gateway's device map. A refresh keeps the previous answer meanwhile.
 */
export function useMemberProfiles(networkId: string | null | undefined, snapshot: unknown): MemberProfiles | null {
  const [state, setState] = useState<{ id: string; profiles: MemberProfiles } | null>(null);

  useEffect(() => {
    if (!networkId) return;
    let cancelled = false;
    fetchWithAuth(`/api/networks/${encodeURIComponent(networkId)}/member-profiles`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { profiles?: MemberProfile[] } | null;
        if (cancelled || !r.ok || !Array.isArray(body?.profiles)) return;
        setState({ id: networkId, profiles: new Map(body.profiles.map((p) => [profileKey(p.mac), p])) });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [networkId, snapshot]);

  return state && state.id === networkId ? state.profiles : null;
}
