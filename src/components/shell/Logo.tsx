import { logoUrl } from "@/lib/logos";

/**
 * Logo redondo (o cuadrado redondeado) de un banco, billetera o comercio.
 * Si no tenemos el logo, muestra el ícono de Material Symbols que se pase.
 */
export function Logo({
  domain,
  icon,
  size = 40,
  radius = "50%",
  className,
  iconColor = "var(--mut)",
  iconBg = "var(--sel)",
}: {
  domain: string | null | undefined;
  icon: string;
  size?: number;
  radius?: string | number;
  className?: string;
  iconColor?: string;
  iconBg?: string;
}) {
  const url = logoUrl(domain);
  const base = { width: size, height: size, borderRadius: radius, flex: "none" as const, overflow: "hidden" as const };
  if (url) {
    return <span role="img" aria-hidden className={className} style={{ ...base, display: "block", background: `#fff url(${url}) center/cover no-repeat` }} />;
  }
  return (
    <span
      aria-hidden
      className={`material-symbols-rounded ${className ?? ""}`}
      style={{ ...base, display: "grid", placeItems: "center", background: iconBg, color: iconColor, fontSize: Math.round(size / 2) }}
    >
      {icon}
    </span>
  );
}
