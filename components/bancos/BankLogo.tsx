import { brandInitials, getBankBrand } from "@/lib/pluggy/brands";

export function BankLogo({
  name,
  imageUrl,
  size = "md",
}: {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md";
}) {
  const brand = getBankBrand(name);
  const box = size === "sm" ? "h-5 w-5 rounded-md text-[9px]" : "h-11 w-11 rounded-xl text-xs";

  if (brand) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center font-bold tracking-tight ${box}`}
        style={{ backgroundColor: brand.bg, color: brand.fg }}
      >
        {brandInitials(name)}
      </div>
    );
  }

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt="" className={`${box} bg-white object-contain p-0.5`} />
    );
  }

  return (
    <div className={`flex items-center justify-center bg-zinc-800 font-semibold text-zinc-200 ${box}`}>
      {brandInitials(name)}
    </div>
  );
}
