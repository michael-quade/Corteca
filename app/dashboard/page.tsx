"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/web/contexts/AuthContext";
import { LandingCard } from "@/web/components/landing/LandingCard";
import { FeaturedCard } from "@/web/components/landing/FeaturedCard";
import { OtherAppsSelect } from "@/web/components/landing/OtherAppsSelect";
import { NAV_ITEMS, DASHBOARD_CARD_HREFS, DASHBOARD_FEATURED_HREF } from "@/web/lib/navItems";

const CARDS = DASHBOARD_CARD_HREFS.map((href) => NAV_ITEMS.find((i) => i.href === href)!).filter(Boolean);
const FEATURED = NAV_ITEMS.find((i) => i.href === DASHBOARD_FEATURED_HREF);
// Everything else (except the dashboard itself) goes in the "Other applications" picker.
const OTHER = NAV_ITEMS.filter((i) => i.href !== "/dashboard" && i.href !== DASHBOARD_FEATURED_HREF && !DASHBOARD_CARD_HREFS.includes(i.href));

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// "michael.quade@nokia.com" → "Michael"; "mquade" → "Mquade".
function firstName(login: string | null): string | null {
  if (!login) return null;
  const word = login.split("@")[0].split(/[._-]/)[0];
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : null;
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading, email } = useAuth();
  const router = useRouter();
  // Time of day is computed after mount so the static prerender doesn't pin it.
  const [hello, setHello] = useState("Welcome");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => { setHello(greeting()); }, []);

  if (isLoading || !isAuthenticated) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
      </main>
    );
  }

  const name = firstName(email);

  return (
    // Plain light ground like the Corteca console home (covers the global background image).
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#f7f8fa]">
      <main className="mx-auto max-w-[1520px] px-6 pb-16 pt-12 lg:px-12">
        <header className="mb-14">
          <h1 className="text-[34px] font-light tracking-tight text-neutral-900">
            {hello}{name && <>, <span className="font-semibold">{name}</span></>}
          </h1>
          {email && <p className="mt-1 text-sm text-neutral-500">Signed in as {email}</p>}
        </header>

        <section aria-labelledby="dashboards-heading">
          <h2 id="dashboards-heading" className="mb-5 text-[15px] font-semibold text-neutral-900">Corteca dashboards</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr_minmax(300px,0.72fr)]">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-2">
              {CARDS.map((c) => (
                <LandingCard key={c.href} title={c.title} description={c.description} icon={c.icon} href={c.href} />
              ))}
            </div>
            {FEATURED && <FeaturedCard title={FEATURED.title} description={FEATURED.description} href={FEATURED.href} />}
          </div>
        </section>

        {OTHER.length > 0 && (
          <section aria-labelledby="other-heading" className="mt-14">
            <h2 id="other-heading" className="mb-5 text-[15px] font-semibold text-neutral-900">Other applications</h2>
            <OtherAppsSelect items={OTHER} />
          </section>
        )}
      </main>
    </div>
  );
}
