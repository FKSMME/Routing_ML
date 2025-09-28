interface MasterDataItemInputProps {
  onApply: (codes: string[]) => void;
}

export function MasterDataItemInput({ onApply }: MasterDataItemInputProps) {
  const placeholder = ["ITEM-001", "ITEM-002", "ITEM-105"].join("\n");

  const handleApply = (formData: FormData) => {
    const raw = (formData.get("item-codes") as string | null) ?? "";
    const codes = raw
      .split(/\r?\n|,|;|\t/)
      .map((code) => code.trim())
      .filter(Boolean);
    onApply(codes);
  };

  return (
    <section className="panel-card interactive-card master-input">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">Item Codes</h2>
          <p className="panel-subtitle">Enter one or more item codes to open reference data.</p>
        </div>
      </header>
      <form
        className="master-input__form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          handleApply(data);
        }}
      >
        <textarea name="item-codes" placeholder={placeholder} className="master-input__textarea" rows={6} />
        <p className="master-input__hint">Separate by newline, comma, or semicolon (max 10 codes recommended).</p>
        <button type="submit" className="btn-primary w-full">
          Add to tabs
        </button>
      </form>
    </section>
  );
}
