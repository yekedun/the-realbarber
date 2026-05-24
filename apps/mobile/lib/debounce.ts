export function createDebounce(fn: () => void, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
}
