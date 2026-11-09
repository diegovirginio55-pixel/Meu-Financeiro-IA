type PageResult = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

const PAGE_SIZE = 1000;
const MAX_ROWS = 50_000;

/**
 * O Supabase devolve no máximo 1000 linhas por consulta (max_rows). Sem
 * paginar, telas com muitos lançamentos perdiam dados em silêncio. Esta
 * função busca página a página até acabar.
 *
 * `build(from, to)` deve devolver a consulta já com `.range(from, to)` e
 * com uma ordenação estável (ex.: `.order("date").order("id")`), senão as
 * páginas podem repetir ou pular linhas.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PageResult,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}
