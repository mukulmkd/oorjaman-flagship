export type TabItem = { id: string; label: string };

export type TabsProps = {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  "aria-label"?: string;
};

export function Tabs({ items, activeId, onChange, "aria-label": ariaLabel }: TabsProps) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="web-tabs">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={activeId === item.id}
          className="web-tab"
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
