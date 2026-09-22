/**
 * Web evidence picker.
 * - library → `<input type="file">`
 * - camera → `getUserMedia` live preview + Capture (selfie uses front / `user` facing)
 *
 * Call from a click/tap handler without awaiting dialogs first so user activation is preserved.
 */

export type JobEvidenceCameraFacing = "front" | "back";

export async function pickJobEvidenceImageUri(options?: {
  source?: "camera" | "library";
  cameraType?: JobEvidenceCameraFacing;
}): Promise<string | null> {
  if (typeof document === "undefined") {
    throw new Error("Photo capture requires a browser.");
  }

  const source = options?.source ?? "camera";
  const facing: "user" | "environment" =
    options?.cameraType != null && String(options.cameraType).toLowerCase().includes("front")
      ? "user"
      : "environment";

  if (source === "library") {
    const file = await openImageFileInput();
    if (!file) return null;
    return URL.createObjectURL(file);
  }

  return captureWithDeviceCamera(facing);
}

async function captureWithDeviceCamera(facing: "user" | "environment"): Promise<string | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser cannot open the camera. Use Choose photo, or try Chrome/Safari on HTTPS.");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 1280 },
      },
    });
  } catch (e: unknown) {
    const name = e && typeof e === "object" && "name" in e ? String((e as { name?: unknown }).name) : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      throw new Error("Camera permission was blocked. Allow camera access in the browser, then try again.");
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      throw new Error("No camera was found on this device. Use Choose photo instead.");
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      throw new Error("Camera is in use by another app. Close it and try again.");
    }
    throw e instanceof Error ? e : new Error("Could not open the camera.");
  }

  return new Promise((resolve, reject) => {
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", facing === "user" ? "Take selfie" : "Take photo");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "99999",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "16px",
      padding: "24px",
      boxSizing: "border-box",
      background: "rgba(15, 41, 56, 0.92)",
      fontFamily:
        '"Plus Jakarta Sans", Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    } as CSSStyleDeclaration);

    const videoWrap = document.createElement("div");
    Object.assign(videoWrap.style, {
      width: "min(100%, 420px)",
      aspectRatio: facing === "user" ? "3 / 4" : "4 / 3",
      borderRadius: "16px",
      overflow: "hidden",
      background: "#0f2938",
      boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
    } as CSSStyleDeclaration);

    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    Object.assign(video.style, {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: facing === "user" ? "scaleX(-1)" : "none",
    } as CSSStyleDeclaration);

    const hint = document.createElement("p");
    hint.textContent =
      facing === "user" ? "Center your face, then tap Capture." : "Frame the site, then tap Capture.";
    Object.assign(hint.style, {
      margin: "0",
      color: "#f6faf9",
      fontSize: "15px",
      textAlign: "center",
      maxWidth: "420px",
    } as CSSStyleDeclaration);

    const actions = document.createElement("div");
    Object.assign(actions.style, {
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
      justifyContent: "center",
    } as CSSStyleDeclaration);

    const captureBtn = document.createElement("button");
    captureBtn.type = "button";
    captureBtn.textContent = "Capture";
    stylePrimaryButton(captureBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    styleOutlineButton(cancelBtn);

    const cleanup = () => {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      overlay.remove();
      window.removeEventListener("keydown", onKeyDown);
    };

    const finish = (uri: string | null) => {
      cleanup();
      resolve(uri);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(null);
    };

    captureBtn.addEventListener("click", () => {
      try {
        const w = video.videoWidth || 1280;
        const h = video.videoHeight || 960;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          reject(new Error("Could not capture frame"));
          return;
        }
        // Mirror selfie so the saved image matches what the technician saw.
        if (facing === "user") {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              cleanup();
              reject(new Error("Could not encode photo"));
              return;
            }
            finish(URL.createObjectURL(blob));
          },
          "image/jpeg",
          0.88,
        );
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error("Capture failed"));
      }
    });

    cancelBtn.addEventListener("click", () => finish(null));
    window.addEventListener("keydown", onKeyDown);

    videoWrap.appendChild(video);
    actions.append(captureBtn, cancelBtn);
    overlay.append(videoWrap, hint, actions);
    document.body.appendChild(overlay);
    void video.play().catch(() => {
      /* autoplay policies usually allow muted */
    });
  });
}

function stylePrimaryButton(btn: HTMLButtonElement) {
  Object.assign(btn.style, {
    minWidth: "140px",
    padding: "14px 20px",
    border: "none",
    borderRadius: "12px",
    background: "#1f8660",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
  } as CSSStyleDeclaration);
}

function styleOutlineButton(btn: HTMLButtonElement) {
  Object.assign(btn.style, {
    minWidth: "140px",
    padding: "14px 20px",
    border: "1.5px solid rgba(246, 250, 249, 0.55)",
    borderRadius: "12px",
    background: "transparent",
    color: "#f6faf9",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
  } as CSSStyleDeclaration);
}

function openImageFileInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onWindowFocus);
      input.remove();
      resolve(file);
    };

    const onWindowFocus = () => {
      window.setTimeout(() => {
        if (!settled && !input.files?.length) finish(null);
      }, 400);
    };

    input.addEventListener("change", () => {
      finish(input.files?.[0] ?? null);
    });
    input.addEventListener("cancel", () => {
      finish(null);
    });

    document.body.appendChild(input);
    input.click();
    window.setTimeout(() => {
      if (!settled) window.addEventListener("focus", onWindowFocus);
    }, 500);
  });
}
