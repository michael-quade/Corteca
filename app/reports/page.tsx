"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/web/contexts/AuthContext";
import { DashboardCard } from "@/web/components/DashboardCard";

function RebootIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
    </svg>
  );
}

function CongestionIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h5M17 12h5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M4.93 4.93 7.76 7.76M16.24 16.24l2.83 2.83M19.07 4.93l-2.83 2.83M7.76 16.24l-2.83 2.83" />
    </svg>
  );
}

function NoiseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8h4l3-5 4 14 3-7 2 3h4" />
    </svg>
  );
}

function NewDevicesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M12 10v4M10 12h4" />
    </svg>
  );
}

function CoverageIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 8.5a18 18 0 0 1 21 0" />
      <path d="M5 12a13 13 0 0 1 14 0" />
      <path d="M8.5 15.5a8 8 0 0 1 7 0" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}

function CloudDisconnectIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}

function ClaimIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function BackhaulIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="9" y="15" width="6" height="6" rx="1" />
      <path d="M6 9v3h12V9M12 12v3" />
    </svg>
  );
}

const REPORTS = [
  {
    title: "Reboot Report",
    description: "Device reboot events across all subscriber networks with daily trends and origin breakdown.",
    icon: <RebootIcon />,
    href: "/reports/reboot",
  },
  {
    title: "Congestion (OBSS)",
    description: "Overlapping BSS congestion and channel interference events across the fleet.",
    icon: <CongestionIcon />,
    href: "/reports/congestion",
  },
  {
    title: "Noise Report",
    description: "WiFi noise floor measurements and interference events across network devices.",
    icon: <NoiseIcon />,
    href: "/reports/noise",
  },
  {
    title: "New Network Devices",
    description: "Newly discovered and connected devices across all subscriber networks.",
    icon: <NewDevicesIcon />,
    href: "/reports/new-devices",
  },
  {
    title: "Coverage Report",
    description: "WiFi coverage quality scores and signal strength across the fleet.",
    icon: <CoverageIcon />,
    href: "/reports/coverage",
  },
  {
    title: "Cloud Disconnections",
    description: "Device cloud connectivity loss events and durations across all networks.",
    icon: <CloudDisconnectIcon />,
    href: "/reports/cloud-disconnections",
  },
  {
    title: "Claim Report",
    description: "Device claim and subscriber onboarding events with status breakdowns.",
    icon: <ClaimIcon />,
    href: "/reports/claim",
  },
  {
    title: "Backhaul Quality",
    description: "Mesh backhaul link quality and PHY rate measurements across the fleet.",
    icon: <BackhaulIcon />,
    href: "/reports/backhaul-quality",
  },
];

export default function PerformanceReportsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
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
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Performance Reports</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Tenant-wide analytics and event reports from the Corteca platform.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <DashboardCard key={r.href} {...r} />
        ))}
      </div>
    </main>
  );
}
