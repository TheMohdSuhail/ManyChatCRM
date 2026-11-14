import { headers } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { isManyChatConfigured } from "@/lib/manychat";

export const dynamic = "force-dynamic";

const BODY = `{
  "subscriber_id": "{{user_id}}",
  "name": "{{full_name}}",
  "ig_username": "{{ig_username}}",
  "email": "{{email}}",
  "phone": "{{phone}}",
  "message": "{{last_input_text}}",
  "source": "Reel - Free Guide"
}`;

export default async function SetupPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = process.env.APP_URL?.replace(/\/$/, "") || `${proto}://${host}`;
  const webhookUrl = `${base}/api/webhooks/manychat`;

  const checks = [
    { ok: isManyChatConfigured(), label: "MANYCHAT_API_TOKEN set hai", hint: "Optional, par recommended — isse poori profile, tags, custom fields aate hain." },
    { ok: Boolean(process.env.WEBHOOK_SECRET), label: "WEBHOOK_SECRET set hai", hint: "Zaroori — iske bina webhook har request reject karega." },
    { ok: !base.includes("localhost"), label: "Public URL (localhost nahi)", hint: "ManyChat localhost tak nahi pahuch sakta. Deploy karo ya ngrok / cloudflared tunnel use karo." },
  ];

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">ManyChat Setup</h1>

      <div className="card mb-6 p-5">
        <h2 className="mb-3 font-medium">Status</h2>
        <ul className="space-y-2 text-sm">
          {checks.map((c) => (
            <li key={c.label} className="flex gap-2">
              <span>{c.ok ? "✅" : "⚠️"}</span>
              <div>
                <div className="font-medium">{c.label}</div>
                {!c.ok && <div className="text-slate-500">{c.hint}</div>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card space-y-5 p-5 text-sm leading-relaxed">
        <Step n={1} title="API token banao">
          ManyChat → <b>Settings → API</b> → <b>Generate your API Key</b>. Token ko <code>.env</code> me{" "}
          <code>MANYCHAT_API_TOKEN</code> me paste karo aur server restart karo.
        </Step>

        <Step n={2} title="Flow me External Request action add karo">
          Jis automation se lead aati hai (comment → DM, story reply, keyword), uske end me (jab user ne phone/email de diya ho) →{" "}
          <b>+ Action → Dev Tools → External Request</b>.
        </Step>

        <Step n={3} title="Request configure karo">
          <div className="mt-2 space-y-3">
            <Code label="Request type">POST</Code>
            <Code label="Request URL">{webhookUrl}</Code>
            <Code label="Headers">{`x-webhook-secret: ${process.env.WEBHOOK_SECRET ? "<.env wala WEBHOOK_SECRET>" : "(pehle .env me WEBHOOK_SECRET set karo)"}`}</Code>
            <Code label="Body (JSON)">{BODY}</Code>
          </div>
          <p className="mt-2 text-slate-500">
            Body me <code>{"{{...}}"}</code> values ManyChat ke <b>&quot;+ Add Variable&quot;</b> button se daalo (System Fields → User Id, Full Name,
            Instagram Username, Email, Phone, Last Text Input). Sirf <code>subscriber_id</code> zaroori hai — baaki sab token se API se aa jayega.{" "}
            <code>source</code> me har automation ka alag naam likho taaki pata chale lead kahan se aayi.
          </p>
        </Step>

        <Step n={4} title="Test karo">
          External Request ke <b>Test the Request</b> button se check karo — response me <code>{`"ok": true`}</code> aana chahiye aur lead
          Leads page pe dikhegi. Response se <code>status_label</code> ko ManyChat custom field me map bhi kar sakte ho.
        </Step>

        <Step n={5} title="Same user dobara aaye to?">
          Lead <code>subscriber_id</code> se unique hai — duplicate nahi banegi, sirf update hogi aur Activity me entry aayegi.
        </Step>
      </div>
    </AppShell>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{n}</div>
      <div className="min-w-0 flex-1">
        <h3 className="font-medium">{title}</h3>
        <div className="text-slate-700">{children}</div>
      </div>
    </div>
  );
}

function Code({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <div className="mb-1 text-xs text-slate-500">{label}</div>
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{children}</pre>
    </div>
  );
}
