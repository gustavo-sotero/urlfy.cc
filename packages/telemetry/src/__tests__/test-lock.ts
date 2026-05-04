type TelemetryTestLockState = {
  tail: Promise<void>;
};

type TelemetryTestLockHost = typeof globalThis & {
  __urlfyTelemetryTestLockState__?: TelemetryTestLockState;
};

function getTelemetryTestLockState(): TelemetryTestLockState {
  const host = globalThis as TelemetryTestLockHost;

  host.__urlfyTelemetryTestLockState__ ??= {
    tail: Promise.resolve()
  };

  return host.__urlfyTelemetryTestLockState__;
}

export async function acquireTelemetryTestLock(): Promise<() => void> {
  const state = getTelemetryTestLockState();
  const previous = state.tail.catch(() => undefined);

  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });

  state.tail = previous.then(() => current);
  await previous;

  return () => {
    releaseCurrent();
  };
}
