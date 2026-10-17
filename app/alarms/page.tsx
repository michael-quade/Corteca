"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/web/contexts/AuthContext";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { AlarmTable } from "@/web/components/tables/AlarmTable";
import { AlarmCrossRefTable } from "@/web/components/tables/AlarmCrossRefTable";
import type { AlarmsResponse, AlarmEntry } from "@/app/api/alarms/route";
import { useToast } from "@/web/contexts/ToastContext";
import { CortecaPage, CortecaLoading } from "@/web/components/corteca/CortecaPage";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { Notice } from "@/web/components/corteca/Notice";
import { AlarmQueryForm } from "@/web/components/alarms/AlarmQueryForm";
import { AlarmSeverityChips } from "@/web/components/alarms/AlarmSeverityChips";
import type { Severity } from "@/web/components/alarms/severity";

function toUtcString(localDatetimeValue: string): string {
  if (!localDatetimeValue) return "";
  // datetime-local gives yyyy-MM-ddTHH:mm — append :00 and convert to UTC
  const d = new Date(`${localDatetimeValue}:00`);
  if (isNaN(d.getTime())) return localDatetimeValue.replace("T", " ");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T` +
         `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
}

function defaultStart(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

function defaultEnd(): string {
  return new Date().toISOString().slice(0, 16);
}

function countBySeverity(alarms: AlarmEntry[]): Record<string, number> {
  return alarms.reduce<Record<string, number>>((acc, a) => {
    const s = (a.severity ?? "unknown").toLowerCase();
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
}

export default function AlarmsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [dateStart, setDateStart] = useState(defaultStart);
  const [dateEnd,   setDateEnd]   = useState(defaultEnd);
  const [selectedSeverities, setSelectedSeverities] = useState<Set<Severity>>(new Set(["critical", "major", "minor"]));
  const [deviceMac, setDeviceMac] = useState("");
  const [customAlarms, setCustomAlarms] = useState(false);

  const [data,    setData]    = useState<AlarmsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<Set<string>>(new Set());

  const [crossRefRows,    setCrossRefRows]    = useState<Record<string, string>[] | null>(null);
  const [crossRefLoading, setCrossRefLoading] = useState(false);
  const [crossRefError,   setCrossRefError]   = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isAuthenticated, isLoading, router]);

  function toggleSeverity(s: Severity) {
    setSelectedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  const canFetch = dateStart !== "" && dateEnd !== "" && selectedSeverities.size > 0;

  function toggleFilter(sev: string) {
    setActiveFilter((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev); else next.add(sev);
      return next;
    });
  }

  const handleFetch = useCallback(async () => {
    if (!canFetch) return;
    setLoading(true);
    setError(null);
    setData(null);
    setActiveFilter(new Set());
    setCrossRefRows(null);
    setCrossRefError(null);
    try {
      const params = new URLSearchParams({
        date_start: toUtcString(dateStart),
        date_end:   toUtcString(dateEnd),
        severities: Array.from(selectedSeverities).join(","),
      });
      if (deviceMac.trim()) params.set("device_mac", deviceMac.trim());
      params.set("isCustomAlarm", customAlarms ? "True" : "False");

      const res = await fetchWithAuth(`/api/alarms?${params.toString()}`);
      const json = await res.json() as unknown;
      const body = json as Record<string, unknown>;
      if (!res.ok) throw new Error((body.error as string) ?? `Error ${res.status}`);
      setData(json as AlarmsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed.");
    } finally {
      setLoading(false);
    }
  }, [canFetch, dateStart, dateEnd, selectedSeverities, deviceMac, customAlarms]);

  const handleCrossRef = async () => {
    setCrossRefLoading(true);
    setCrossRefError(null);
    setCrossRefRows(null);
    try {
      const res = await fetchWithAuth("/api/reboot-report");
      const json = await res.json() as unknown;
      if (!res.ok) throw new Error((json as Record<string, string>).error ?? `Error ${res.status}`);
      const rows = Array.isArray(json) ? (json as Record<string, string>[]) : [];
      setCrossRefRows(rows);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to fetch reboot report.";
      setCrossRefError(message);
      toast.error(`Cross-reference failed: ${message}`);
    } finally {
      setCrossRefLoading(false);
    }
  };

  if (isLoading) return <CortecaLoading />;
  if (!isAuthenticated) return null;

  const counts = data ? countBySeverity(data.alarms) : null;

  return (
    <CortecaPage
      title="Network Alarms"
      meta="Query open alarms across the fleet via the ouife fault manager. Times are converted to UTC before submission."
    >
      <AlarmQueryForm
        dateStart={dateStart} onDateStart={setDateStart}
        dateEnd={dateEnd} onDateEnd={setDateEnd}
        severities={selectedSeverities} onToggleSeverity={toggleSeverity}
        deviceMac={deviceMac} onDeviceMac={setDeviceMac}
        customAlarms={customAlarms} onCustomAlarms={setCustomAlarms}
        canFetch={canFetch} loading={loading} onFetch={() => void handleFetch()}
        hasResults={!!data}
        crossRefLoading={crossRefLoading}
        crossRefActive={!!crossRefRows}
        onCrossRef={() => void handleCrossRef()}
        onClearCrossRef={() => { setCrossRefRows(null); setCrossRefError(null); }}
      />

      {crossRefError && <Notice tone="error" title="Reboot report error">{crossRefError}</Notice>}
      {error && <Notice tone="error" title="Couldn't fetch alarms">{error}</Notice>}

      {data && (
        <CortecaCard
          title={crossRefRows ? "Alarms × reboots" : `Alarms (${data.total})`}
          actions={counts && !crossRefRows && (
            <AlarmSeverityChips counts={counts} active={activeFilter} onToggle={toggleFilter} onClear={() => setActiveFilter(new Set())} />
          )}
        >
          <div className="flex min-h-[400px] flex-col">
            {crossRefRows ? (
              <AlarmCrossRefTable alarms={data.alarms} rebootRows={crossRefRows} />
            ) : (
              <AlarmTable alarms={data.alarms} severityFilter={activeFilter} />
            )}
          </div>
        </CortecaCard>
      )}
    </CortecaPage>
  );
}
