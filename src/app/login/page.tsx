export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const configured = Boolean(process.env.CRM_PASSWORD && process.env.AUTH_SECRET);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form action="/api/auth/login" method="post" className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <h1 className="text-xl font-semibold">Lead CRM</h1>
          <p className="text-sm text-slate-500">ManyChat Instagram leads</p>
        </div>
        {!configured && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            .env me <code>CRM_PASSWORD</code> aur <code>AUTH_SECRET</code> set karo, phir server restart karo.
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Galat password.</p>}
        <input type="hidden" name="next" value={next ?? "/"} />
        <input className="input" type="password" name="password" placeholder="Password" autoFocus required />
        <button className="btn-primary w-full">Login</button>
      </form>
    </div>
  );
}
