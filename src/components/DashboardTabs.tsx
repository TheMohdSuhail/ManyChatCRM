"use client";

import { useState } from "react";

/**
 * Mobile / tablet: ek card me tabs (scroll kam). Desktop (lg+): dono panels side by side.
 */
export function DashboardTabs({ tabs }: { tabs: { label: string; count?: number; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-4">
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-200/60 p-1 lg:hidden" role="tablist">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            role="tab"
            aria-selected={active === i}
            onClick={() => setActive(i)}
            className={`truncate rounded-lg px-2 py-1.5 text-sm font-medium transition ${
              active === i ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1 text-xs text-slate-400">{t.count}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.label} role="tabpanel" className={active === i ? "" : "hidden lg:block"}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
