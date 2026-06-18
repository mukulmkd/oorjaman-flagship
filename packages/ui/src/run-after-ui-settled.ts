type UiSettledHandle = {
  cancel: () => void;
};

function scheduleWhenIdle(task: () => void): UiSettledHandle {
  const requestIdle = globalThis.requestIdleCallback;
  if (typeof requestIdle === "function") {
    const id = requestIdle(task);
    return {
      cancel: () => {
        const cancelIdle = globalThis.cancelIdleCallback;
        if (typeof cancelIdle === "function") cancelIdle(id);
      },
    };
  }

  const timeoutId = setTimeout(task, 0);
  return { cancel: () => clearTimeout(timeoutId) };
}

/** Run work after the current UI transition / interaction frame settles. */
export function runAfterUiSettled(task: () => void): UiSettledHandle {
  return scheduleWhenIdle(task);
}

/** Promise helper for awaiting UI settle, optionally with an extra delay. */
export function waitAfterUiSettled(delayMs = 0): Promise<void> {
  return new Promise((resolve) => {
    scheduleWhenIdle(() => {
      if (delayMs > 0) setTimeout(resolve, delayMs);
      else resolve();
    });
  });
}
