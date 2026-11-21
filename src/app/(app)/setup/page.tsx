import { headers } from "next/headers";
import { PageHeader } from "@/components/AppShell";
import { requireUser } from "@/lib/users";
import { isManyChatConfigured } from "@/lib/manychat";
import { getIgAccount, hasIgToken } from "@/lib/instagram";
import { lastInstagramSync } from "@/lib/instagramSync";
import { saveInstagramToken } from "@/app/actions";
import { InstagramImport } from "@/components/InstagramImport";
import { fmtIST } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Setup" };

const BODY = `{
  "subscriber_id": "{{user_id}}",
  "name": "{{full_name}}",
  "ig_username": "{{ig_username}}",
  "email": "{{email}}",
  "phone": "{{phone}}",
  "message": "{{last_input_text}}",
  "source": "Reel - Free Guide"
}`;

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ ig_ok?: string; ig_error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
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

  // Instagram connection status
  // Instagram check aur last sync time ek saath (pehle ek ke baad ek)
  const [ig, igLastSync] = await Promise.all([
    hasIgToken().then(async (set): Promise<{ set: boolean; account: string | null; error: string | null }> => {
      if (!set) return { set, account: null, error: null };
      try {
        const a = await getIgAccount();
        return { set, account: a.username ?? a.id, error: null };
      } catch (e) {
        return { set, account: null, error: e instanceof Error ? e.message : String(e) };
      }
    }),
    lastInstagramSync(),
  ]);
  const { set: igTokenSet, account: igAccount, error: igError } = ig;

  return (
    <>
      <PageHeader title="Setup" sub="Instagram DMs aur ManyChat webhook connect karo." />

      <div className="card mb-6 space-y-5 p-5 text-sm leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold">Instagram DMs se leads (purani + chhooti hui)</h2>
          <p className="text-slate-600">
            Ye seedha Instagram ke DMs padhta hai — jo leads ManyChat webhook se miss ho gayi, wo bhi yahan se aa jayengi. Har chat ka
            banda lead banega (pehle se CRM me hai to usi me jud jayega) aur uske last messages lead page par dikhenge.
          </p>
        </div>

        <ul className="space-y-1">
          <li>
            {igAccount ? "✅" : "⚠️"}{" "}
            {igAccount ? (
              <>Instagram connected: <b>@{igAccount}</b></>
            ) : igTokenSet ? (
              <>Token kaam nahi kar raha: <span className="text-red-600">{igError}</span> — naya token daalo</>
            ) : (
              "Instagram token abhi set nahi hai (neeche steps dekho)"
            )}
          </li>
          <li>🕒 Last sync: {igLastSync ? fmtIST(igLastSync) : "kabhi nahi"}</li>
          <li>
            {process.env.CRON_SECRET ? "✅" : "⚠️"} Auto-sync (roz raat 12 baje IST){" "}
            {!process.env.CRON_SECRET && <span className="text-slate-500">— Vercel env me CRON_SECRET daalo</span>}
          </li>
        </ul>

        {sp.ig_ok && <div className="alert-ok">✓ Token save ho gaya — @{sp.ig_ok} connected</div>}
        {sp.ig_error && <div className="alert-error">Token save nahi hua: {sp.ig_error}</div>}

        <InstagramImport disabled={!igAccount} />

        <details className="rounded-xl border border-slate-200 p-4" open={!igAccount}>
          <summary className="cursor-pointer font-medium">Instagram token kaise banaye (ek baar ka kaam)</summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-700">
            <li>
              Instagram app me account <b>Professional (Business/Creator)</b> hona chahiye. Phir Instagram → <b>Settings → Messages and calls →
              Connected tools → &quot;Allow access to messages&quot;</b> ON karo.
            </li>
            <li>
              <a className="text-indigo-600 underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
                developers.facebook.com/apps
              </a>{" "}
              → <b>Create app</b> → use case <b>&quot;Manage messaging &amp; content on Instagram&quot;</b> → app type <b>Business</b>.
            </li>
            <li>
              App ke andar <b>Instagram → API setup with Instagram login</b> → <b>Generate access tokens</b> → <b>Add account</b> → apne
              Instagram (herbalmaza.com_) se login karo → <b>Generate token</b> → token copy karo.
            </li>
            <li>Token neeche paste karke Save karo. App ko &quot;Development&quot; mode me hi rehne do — apne account ke liye review nahi chahiye.</li>
            <li>Token 60 din chalta hai, CRM use apne aap refresh karta rehta hai. Kabhi &quot;token kaam nahi kar raha&quot; dikhe to naya bana ke yahan daal do.</li>
          </ol>
        </details>

        {isAdmin ? (
          <form action={saveInstagramToken} className="flex flex-col gap-2 sm:flex-row">
            <input name="token" type="password" className="input sm:max-w-xl sm:flex-1" placeholder="Instagram access token (IGAA…)" autoComplete="off" />
            <button className="btn-primary">Save token</button>
          </form>
        ) : (
          <p className="text-slate-500">Token sirf Admin save kar sakta hai.</p>
        )}
      </div>

      <h2 className="mb-4 text-lg font-semibold">ManyChat</h2>

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
          Jis automation se lead aati hai (comment → DM, story reply, keyword), usme <b>trigger ke turant baad, sabse pehle</b> →{" "}
          <b>+ Action → Dev Tools → External Request</b>. Agar ye sirf flow ke end me ho (phone/email milne ke baad), to jo log beech me
          chhod dete hain wo CRM me kabhi nahi aate.
          <div className="alert-warn mt-2">
            ⚠️ Har automation (har reel / keyword / story / DM flow) me ye External Request alag se lagana padta hai. Jis flow me nahi
            laga, uski leads CRM me nahi aayengi. Phone/email baad me mile to flow ke end me ek aur External Request laga do — same
            lead update ho jayegi.
          </div>
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
    </>
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
      <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs break-all whitespace-pre-wrap text-slate-100 sm:break-normal sm:whitespace-pre">{children}</pre>
    </div>
  );
}
