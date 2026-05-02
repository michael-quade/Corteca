"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/web/contexts/AuthContext";
import { SubscriberSearch } from "@/web/components/SubscriberSearch";
import { NetworkMembersTable } from "@/web/components/tables/NetworkMembersTable";
import { cn } from "@/web/lib/utils";
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
      const res = await fetch(`/api/networks/${networkId}/members`);
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

  if (isLoading) {
    return (
      <main className="p-8">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-2">
        <p className="text-sm text-neutral-500">
          Sign in to search subscriber devices.
        </p>
      </main>
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
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 8H3M7 4l-4 4 4 4" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-xl font-semibold text-neutral-900">Device Search</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Search for a subscriber to view the devices in their home network.
        </p>
      </div>

      <SubscriberSearch
        onSelect={handleSubscriberSelect}
        selectedId={selectedSubscriber?.customer_id ?? selectedSubscriber?.uuid}
      />

      {selectedSubscriber && (
        <div className="mt-8">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">
                {fullName ?? "Unknown Subscriber"}
              </h2>
              {selectedSubscriber.email && fullName !== selectedSubscriber.email && (
                <p className="mt-0.5 text-sm text-neutral-500">{selectedSubscriber.email}</p>
              )}
              {networkId && (
                <p className="mt-0.5 font-mono text-xs text-neutral-400">
                  Network ID: {networkId}
                </p>
              )}
            </div>
            {networkId && (
              <span
                className={cn(
                  "flex items-center gap-1.5 text-sm",
                  online ? "text-green-700" : "text-neutral-400"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    online ? "bg-green-500" : "bg-neutral-300"
                  )}
                />
                {online ? "Gateway online" : "Gateway offline"}
              </span>
            )}
          </div>

          {loadingMembers && (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
              Loading devices…
            </div>
          )}

          {membersError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {membersError}
            </p>
          )}

          {!loadingMembers && !membersError && (
            <>
              {members.length > 0 && (
                <p className="mb-3 text-xs text-neutral-400">
                  {members.length} device{members.length !== 1 ? "s" : ""} found
                </p>
              )}
              <NetworkMembersTable members={members} />
            </>
          )}
        </div>
      )}
    </main>
  );
}
