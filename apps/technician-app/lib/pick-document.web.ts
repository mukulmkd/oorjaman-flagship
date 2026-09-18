export type PickedTechnicianDocument = {
  uri: string;
  name: string;
  mime: string | null;
};

/** Web file input for KYC / onboarding document uploads. */
export async function pickTechnicianDocument(): Promise<PickedTechnicianDocument | null> {
  if (typeof document === "undefined") {
    throw new Error("Document picking requires a browser.");
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,image/*";
    input.style.display = "none";

    const cleanup = () => {
      input.remove();
    };

    input.addEventListener("change", () => {
      const file = input.files?.[0] ?? null;
      cleanup();
      if (!file) {
        resolve(null);
        return;
      }
      resolve({
        uri: URL.createObjectURL(file),
        name: file.name || "document",
        mime: file.type || null,
      });
    });
    input.addEventListener("cancel", () => {
      cleanup();
      resolve(null);
    });

    document.body.appendChild(input);
    input.click();
  });
}
