export function Avatar({ src, name, size = 36 }: { src: string | null; name: string | null; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} referrerPolicy="no-referrer" />;
  }
  return (
    <div className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-400 to-indigo-500 font-medium text-white" style={{ width: size, height: size }}>
      {(name ?? "?").charAt(0).toUpperCase()}
    </div>
  );
}
