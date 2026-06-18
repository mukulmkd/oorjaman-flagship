import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys, supportApi } from "@oorjaman/api";
import { useSupabase } from "@oorjaman/web-ui";

type Props = {
  categorySlug?: string;
  onInsert: (body: string) => void;
};

export function SupportMacrosPicker({ categorySlug, onInsert }: Props) {
  const supabase = useSupabase();

  const macrosQ = useQuery({
    queryKey: queryKeys.support.macros(),
    queryFn: () => supportApi.listSupportMacros(supabase!),
    enabled: Boolean(supabase),
  });

  const createMut = useMutation({
    mutationFn: (input: { title: string; body: string }) =>
      supportApi.createSupportMacro(supabase!, { ...input, category_slug: categorySlug }),
    onSuccess: () => void macrosQ.refetch(),
  });

  const macros = (macrosQ.data ?? []).filter(
    (m) => !m.category_slug || !categorySlug || m.category_slug === categorySlug,
  );

  return (
    <div className="support-macros">
      <span className="support-macros-label">Macros</span>
      <div className="support-macros-list">
        {macros.map((m) => (
          <button
            key={m.id}
            type="button"
            className="support-macros-chip"
            title={m.body}
            onClick={() => onInsert(m.body)}
          >
            {m.title}
          </button>
        ))}
        {macros.length === 0 && !macrosQ.isPending ? (
          <span className="support-inbox-muted">No macros yet</span>
        ) : null}
      </div>
      <button
        type="button"
        className="support-macros-add"
        onClick={() => {
          const title = window.prompt("Macro title");
          if (!title?.trim()) return;
          const body = window.prompt("Macro message");
          if (!body?.trim()) return;
          createMut.mutate({ title: title.trim(), body: body.trim() });
        }}
      >
        + Save reply
      </button>
    </div>
  );
}
