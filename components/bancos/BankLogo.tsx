import { brandInitials, getBankBrand } from "@/lib/pluggy/brands";

function isGenericPluggyImage(url?: string | null) {
  if (!url) return true;
  return /pluggy/i.test(url);
}

export function BankLogo({
  name,
  imageUrl,
  size = "md",
}: {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const brand = getBankBrand(name);
  const box =
    size === "sm" ? "h-5 w-5 rounded-md" : size === "lg" ? "h-9 w-9 rounded-lg" : "h-11 w-11 rounded-xl";
  const logo = brand?.logo;
  const remote = !isGenericPluggyImage(imageUrl) ? imageUrl : null;

  if (logo || remote) {
    const src = logo ? `${logo}?v=2` : (remote ?? "");
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={`${box} shrink-0 overflow-hidden object-contain`} />
    );
  }

  if (brand) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center text-xs font-bold tracking-tight ${box}`}
        style={{ backgroundColor: brand.bg, color: brand.fg }}
      >
        {brandInitials(name)}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center bg-zinc-800 text-xs font-semibold text-zinc-200 ${box}`}>
      {brandInitials(name)}
    </div>
  );
}
