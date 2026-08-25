import AppChrome from "@/components/nav/AppChrome";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppChrome>{children}</AppChrome>;
}
