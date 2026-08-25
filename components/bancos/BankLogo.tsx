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
    size === "sm" ? "h-5 w-5 rounded-md" : size === "lg" ? "h-14 w-14 rounded-2xl" : "h-11 w-11 rounded-xl";
  const initials = size === "lg" ? "text-sm" : "text-xs";
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
        className={`flex shrink-0 items-center justify-center font-bold tracking-tight ${initials} ${box}`}
        style={{ backgroundColor: brand.bg, color: brand.fg }}
      >
        {brandInitials(name)}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center bg-zinc-800 font-semibold text-zinc-200 ${initials} ${box}`}>
      {brandInitials(name)}
    </div>
  );
}
