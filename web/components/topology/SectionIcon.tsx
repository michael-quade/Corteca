// Thin outline icons for the detail-panel section headers, by section id (the title
// without a "(…)" count). Unknown ids get a plain dot.

const PATHS: Record<string, string> = {
  "Location": "M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  "Access point": "M5 12.5a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 18.5h.01",
  "AI analysis": "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z",
  "Top clients by traffic": "M4 20h16M7 16V10M12 16V5M17 16v-4",
  "Ethernet ports": "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM7 10v4M10 10v4M14 10v4M17 10v4",
  "Events": "M4 6h16M4 12h16M4 18h10",
  "Backhaul history": "M12 8v4l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5M3.5 4v4.5H8",
  "Radios": "M5 19v-4M10 19v-8M15 19V7M20 19V4",
  "Backhaul link": "M9 15l6-6M10.5 6.5l1.8-1.8a4 4 0 0 1 5.7 5.7l-1.8 1.8M13.5 17.5l-1.8 1.8a4 4 0 0 1-5.7-5.7l1.8-1.8",
  "Bands": "M3 8h18M3 12h18M3 16h18",
  "Links": "M3 8h18M3 12h18M3 16h18",
  "Connection": "M7 7h10M7 7l3-3M7 7l3 3M17 17H7M17 17l-3-3M17 17l-3 3",
  "Roaming history": "M12 8v4l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5M3.5 4v4.5H8",
  "Device": "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2",
  "Device events": "M4 6h16M4 12h16M4 18h10",
  "Inferred switch": "M3 8h18v8H3zM7 12h.01M11 12h.01M15 12h.01",
  "Beacons": "M5 12.5a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 18.5h.01",
  "Wired clients": "M4 5h16v10H4zM9 19h6M12 15v4",
  "Other hosts on the port": "M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 20a6 6 0 0 1 12 0",
  "Internet": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18",
  "WAN interface": "M4 6h16v12H4zM8 10h8M8 14h5",
  "WAN port": "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM9 10v4M12 10v4M15 10v4",
};

export function SectionIcon({ id }: { id: string }) {
  const d = PATHS[id];
  return (
    <svg className="flex-shrink-0 text-blue-600" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d ? <path d={d} /> : <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}
