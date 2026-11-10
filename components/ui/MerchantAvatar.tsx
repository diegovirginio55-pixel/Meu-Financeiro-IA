import { merchantBrand } from "@/lib/finance/merchants";
import { CATEGORY_ICONS, categoryColor } from "@/lib/finance/categories";

/**
 * Ícone redondo do lançamento: cor e sigla da marca (iFood, Uber, Netflix…)
 * quando reconhece o estabelecimento; senão, o emoji da categoria na cor dela.
 */
export function MerchantAvatar({
  description,
  category,
  size = 36,
}: {
  description: string;
  category: string;
  size?: number;
}) {
  const brand = merchantBrand(description);
  const style = { width: size, height: size, minWidth: size };

  if (brand) {
    return (
      <span
        aria-hidden
        title={brand.name}
        style={{ ...style, background: brand.background, color: brand.color, fontSize: Math.round(size * 0.36) }}
        className="inline-flex items-center justify-center rounded-full font-bold leading-none tracking-tight ring-1 ring-white/10"
      >
        {brand.label}
      </span>
    );
  }

  const color = categoryColor(category);
  return (
    <span
      aria-hidden
      title={category}
      style={{ ...style, background: `${color}26`, fontSize: Math.round(size * 0.46) }}
      className="inline-flex items-center justify-center rounded-full leading-none ring-1 ring-white/5"
    >
      {CATEGORY_ICONS[category] ?? "🔖"}
    </span>
  );
}
