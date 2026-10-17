"use client";

import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { useState } from "react";
import { useAuth } from "@/web/contexts/AuthContext";
import { CortecaPage, CortecaLoading } from "@/web/components/corteca/CortecaPage";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { StatusPill } from "@/web/components/corteca/StatusPill";
import { Notice } from "@/web/components/corteca/Notice";
import { SubscriberSearch } from "@/web/components/SubscriberSearch";
import { NetworkMembersTable } from "@/web/components/tables/NetworkMembersTable";
import type { Subscriber, Member } from "@/web/lib/corteca/types";

export default function DevicesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  async function handleSubscriberSelect(subscriber: Subscriber) {
    setSelectedSubscriber(subscriber);
    setMembers([]);
    setMembersError(null);

    const networkId = subscriber.home_wifis?.[0]?.id;
    if (!networkId) {
      setMembersError("No network ID found for this subscriber.");
      return;
    }

    setLoadingMembers(true);
    try {
      const res = await fetchWithAuth(`/api/networks/${networkId}/members`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch devices.");
      const list: Member[] = Array.isArray(data)
        ? data
        : (data.members ?? data.content ?? []);
      setMembers(list);
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : "Failed to fetch devices.");
    } finally {
      setLoadingMembers(false);
    }
  }

  if (isLoading) return <CortecaLoading />;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#f5f7fa]">
        <p className="text-sm text-neutral-500">Sign in to search subscriber devices.</p>
      </div>
    );
  }

  const networkId = selectedSubscriber?.home_wifis?.[0]?.id;
  const online = selectedSubscriber?.home_wifis?.[0]?.status?.online;
  const fullName = selectedSubscriber
    ? (selectedSubscriber.name ||
        `${selectedSubscriber.first_name ?? ""} ${selectedSubscriber.last_name ?? ""}`.trim() ||
        selectedSubscriber.email ||
        selectedSubscriber.customer_id)
    : null;

  return (
    <CortecaPage title="Device Search" meta="Search for a subscriber to view the devices in their home network." width="max-w-6xl">
      <CortecaCard title="Find a subscriber">
        <SubscriberSearch
          onSelect={handleSubscriberSelect}
          selectedId={selectedSubscriber?.customer_id ?? selectedSubscriber?.uuid}
        />
      </CortecaCard>

      {selectedSubscriber && (
        <CortecaCard
          title={fullName ?? "Unknown Subscriber"}
          actions={networkId && (
            <StatusPill tone={online ? "good" : "neutral"}>{online ? "Gateway online" : "Gateway offline"}</StatusPill>
          )}
        >
          <div className="-mt-3 mb-4 space-y-0.5">
            {selectedSubscriber.email && fullName !== selectedSubscriber.email && (
              <p className="text-sm text-neutral-500">{selectedSubscriber.email}</p>
            )}
            {networkId && <p className="font-mono text-xs text-neutral-400">Network ID: {networkId}</p>}
          </div>

          {loadingMembers && (
            <div className="flex items-center gap-2 py-6 text-sm text-neutral-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
              Loading devices…
            </div>
          )}

          {membersError && <Notice tone="error" title="Couldn't load devices">{membersError}</Notice>}

          {!loadingMembers && !membersError && (
            <>
              {members.length > 0 && (
                <p className="mb-3 text-xs text-neutral-500">
                  {members.length} device{members.length !== 1 ? "s" : ""} found
                </p>
              )}
              <NetworkMembersTable members={members} />
            </>
          )}
        </CortecaCard>
      )}
    </CortecaPage>
  );
}
