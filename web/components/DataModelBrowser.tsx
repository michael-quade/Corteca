"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/web/lib/utils";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { SupportedObj } from "@/web/lib/corteca/usp";
import { SetParameterModal, type SetParamTarget } from "@/web/components/modals/SetParameterModal";

const COMMON_PATHS = [
  "Device.DeviceInfo.", "Device.WiFi.", "Device.Ethernet.",
  "Device.Hosts.", "Device.IP.", "Device.DHCPv4.", "Device.Firewall.",
];

function lastSegment(path: string): string {
  const s = path.endsWith(".") ? path.slice(0, -1) : path;
  return s.slice(s.lastIndexOf(".") + 1);
}

function pathDepth(path: string, allPaths: string[]): number {
  return allPaths.filter((p) => p !== path && path.startsWith(p)).length;
}

function directParent(path: string, allPaths: string[]): string | null {
  const candidates = allPaths.filter((p) => p !== path && path.startsWith(p));
  return candidates.length ? candidates.reduce((a, b) => (a.length > b.length ? a : b)) : null;
}

interface Props { deviceId: string }

export function DataModelBrowser({ deviceId }: Props) {
  const [activePath, setActivePath]   = useState("Device.WiFi.");
  const [customPath, setCustomPath]   = useState("");
  const [schema, setSchema]           = useState<SupportedObj[]>([]);
  const [values, setValues]           = useState<Record<string, string>>({});
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());
  const [loadingSchema, setLS]        = useState(false);
  const [loadingValues, setLV]        = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [editTarget, setEditTarget]   = useState<SetParamTarget | null>(null);

  const allPaths = useMemo(() => schema.map((o) => o.supportedObjPath), [schema]);

  const loadSchema = useCallback(async (path: string) => {
    setLS(true); setError(null); setSchema([]); setValues({}); setExpanded(new Set([path]));
    try {
      const r = await fetchWithAuth(
        `/api/network/${deviceId}/datamodel?path=${encodeURIComponent(path)}&firstLevelOnly=false`
      );
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
      setSchema(json.schema ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLS(false); }
  }, [deviceId]);

  const loadValues = useCallback(async () => {
    setLV(true);
    try {
      const r = await fetchWithAuth(
        `/api/network/${deviceId}/datamodel?path=${encodeURIComponent(activePath)}&firstLevelOnly=false&values=true`
      );
      const json = await r.json();
      setValues(json.values ?? {});
    } finally { setLV(false); }
  }, [deviceId, activePath]);

  function toggle(path: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });
  }

  function isVisible(obj: SupportedObj): boolean {
    const parent = directParent(obj.supportedObjPath, allPaths);
    if (!parent) return true;
    return expanded.has(parent) && isVisible({ ...obj, supportedObjPath: parent } as SupportedObj);
  }

  const hasChildren = (path: string) => allPaths.some((p) => p !== path && p.startsWith(path));

  const queryPath = customPath || activePath;

  return (
    <div className="space-y-4">
      {/* Path selector */}
      <div className="flex flex-wrap gap-2">
        {COMMON_PATHS.map((p) => (
          <button key={p} type="button"
            onClick={() => { setActivePath(p); setCustomPath(""); loadSchema(p); }}
            className={cn(
              "rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors",
              activePath === p && !customPath
                ? "border-blue-400 bg-blue-50 text-blue-700"
                : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            )}
          >{p}</button>
        ))}
        <input type="text" placeholder="Custom path…" value={customPath}
          onChange={(e) => setCustomPath(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && customPath) { setActivePath(customPath); loadSchema(customPath); } }}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 font-mono text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => loadSchema(queryPath)} disabled={loadingSchema}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
          {loadingSchema ? "Loading…" : "Load Schema"}
        </button>
        {schema.length > 0 && (
          <button type="button" onClick={loadValues} disabled={loadingValues}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
            {loadingValues ? "Fetching…" : "Get Current Values"}
          </button>
        )}
        {schema.length > 0 && <span className="text-xs text-neutral-400">{schema.length} objects</span>}
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}

      {/* Tree */}
      {schema.length > 0 && (
        <div className="overflow-auto rounded-xl border border-neutral-200 bg-white text-xs">
          {schema.filter(isVisible).map((obj) => {
            const depth  = pathDepth(obj.supportedObjPath, allPaths);
            const isExp  = expanded.has(obj.supportedObjPath);
            const hasKids = hasChildren(obj.supportedObjPath);
            const seg    = lastSegment(obj.supportedObjPath) + (obj.isMultiInstance ? ".{i}." : ".");
            return (
              <div key={obj.supportedObjPath}>
                <div onClick={() => toggle(obj.supportedObjPath)}
                  className="flex cursor-pointer items-center gap-2 border-b border-neutral-100 py-2 pr-4 hover:bg-neutral-50"
                  style={{ paddingLeft: `${16 + depth * 16}px` }}>
                  <span className="w-3 shrink-0 text-neutral-400">{hasKids ? (isExp ? "▾" : "▸") : "·"}</span>
                  <span className="font-mono font-semibold text-neutral-800">{seg}</span>
                  {obj.isMultiInstance && <span className="rounded bg-purple-100 px-1 text-[10px] text-purple-600">multi</span>}
                  {obj.access === "readWrite" && <span className="rounded bg-green-100 px-1 text-[10px] text-green-600">rw</span>}
                  <span className="ml-auto text-[10px] text-neutral-300">{obj.supportedParams.length} params</span>
                </div>
                {isExp && obj.supportedParams.map((param) => {
                  const fullPath = `${obj.supportedObjPath}${param.paramName}`;
                  const val = values[fullPath];
                  return (
                    <div key={param.paramName}
                      className="flex items-center gap-3 border-b border-neutral-100 bg-neutral-50/60 py-1.5 pr-4"
                      style={{ paddingLeft: `${32 + depth * 16}px` }}>
                      <span className="font-mono text-neutral-700">{param.paramName}</span>
                      <span className="shrink-0 text-[10px] text-neutral-400">{param.valueType}</span>
                      {val !== undefined && <span className="font-mono text-blue-700">{val || "(empty)"}</span>}
                      {param.access === "readOnly"
                        ? <span className="ml-auto shrink-0 text-[10px] text-neutral-300">ro</span>
                        : <button type="button"
                            onClick={() => setEditTarget({ deviceId, objPath: obj.supportedObjPath, param, currentValue: val })}
                            className="ml-auto shrink-0 rounded border border-neutral-200 px-2 py-0.5 text-[10px] text-neutral-500 hover:border-blue-300 hover:text-blue-600">
                            Edit
                          </button>
                      }
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <SetParameterModal target={editTarget} onClose={() => setEditTarget(null)}
        onSuccess={(param, val) => {
          if (editTarget) setValues((prev) => ({ ...prev, [`${editTarget.objPath}${param}`]: val }));
        }}
      />
    </div>
  );
}
