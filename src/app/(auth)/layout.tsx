export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>{children}</main>;
}
