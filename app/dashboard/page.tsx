"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/web/contexts/AuthContext";
import { DashboardCard } from "@/web/components/DashboardCard";

function DeviceSearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
      <rect x="8" y="9" width="6" height="4" rx="1" />
      <path d="M8 13v2M16 13v2" />
    </svg>
  );
}

function NetworkVisualizerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="5" rx="1" />
      <rect x="1" y="15" width="6" height="5" rx="1" />
      <rect x="17" y="15" width="6" height="5" rx="1" />
      <path d="M12 7v4M4 15V9a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6" />
    </svg>
  );
}

function NetworkMapIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="6"  cy="8"  r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="15" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PerformanceReportsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-4 4 4 4-7" />
    </svg>
  );
}

function DataModelIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 10h16M4 14h10M4 18h6" />
      <circle cx="19" cy="16" r="3" />
      <path d="m21.5 18.5-1.5-1.5" />
    </svg>
  );
}

const FEATURES = [
  {
    title: "Device Search",
    description: "Search for a subscriber and view all devices connected to their home WiFi network.",
    icon: <DeviceSearchIcon />,
    href: "/devices",
  },
  {
    title: "Performance Reports",
    description: "Tenant-wide analytics reports: reboots, congestion, noise, coverage, cloud disconnections, and more.",
    icon: <PerformanceReportsIcon />,
    href: "/reports",
  },
  {
    title: "Home Network Visualizer",
    description: "Graphically view the access points and topology of a subscriber's home WiFi mesh network.",
    icon: <NetworkVisualizerIcon />,
    href: "/network-visualizer",
  },
  {
    title: "Network Map",
    description: "Global map of every managed WiFi network — online and offline — plotted by geographic location.",
    icon: <NetworkMapIcon />,
    href: "/network-map",
  },
  {
    title: "Device Data Model Browser",
    description: "Explore and configure the complete USP TR-369 data model for any managed device.",
    icon: <DataModelIcon />,
    href: "/device-browser",
  },
];

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">Select a tool to get started.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <DashboardCard key={f.href} {...f} />
        ))}
      </div>
    </main>
  );
}
