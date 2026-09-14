import { create } from "zustand";

/**
 * Single source of scroll truth for the cinematic experience.
 *
 * Deliberately minimal: this store holds the RAW scroll progress only.
 * It never holds a rotation, a camera position, or any other rendered
 * value — those are damped per-frame inside the render loop (see
 * TowerScene) and must not round-trip through React state, or every
 * frame would re-render the tree.
 *
 * Read it from inside useFrame with `useScrollStory.getState().progress`
 * (no subscription, no re-render). Use the hook form only in DOM
 * components that genuinely need to re-render on change — and even then,
 * prefer a coarse derived value (see `useActIndex`) over raw progress.
 */
interface ScrollStoryState {
  /** 0 at the top of the story container, 1 at the bottom. */
  progress: number;
  setProgress: (progress: number) => void;
}

export const useScrollStory = create<ScrollStoryState>((set) => ({
  progress: 0,
  setProgress: (progress) => set({ progress }),
}));

/**
 * Attaches a passive scroll listener that writes normalised progress into
 * the store. Returns the cleanup. Called once by the page that owns the
 * scroll container.
 *
 * Progress is measured against `scrollHeight - innerHeight` rather than a
 * hardcoded page height, so changing the container's vh in CSS does not
 * silently desynchronise the narrative from the scrollbar.
 */
export function observeScrollProgress(): () => void {
  const { setProgress } = useScrollStory.getState();
  let frame = 0;

  function read() {
    frame = 0;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    // A container shorter than the viewport has no meaningful progress;
    // reporting 0 keeps the opening frame composed rather than NaN.
    const next = scrollable > 0 ? window.scrollY / scrollable : 0;
    setProgress(Math.min(1, Math.max(0, next)));
  }

  function onScroll() {
    // Coalesce bursts of scroll events into one write per animation
    // frame. The render loop reads this value every frame anyway, so
    // writing more often than that is pure waste.
    if (frame === 0) frame = requestAnimationFrame(read);
  }

  read();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  return () => {
    if (frame !== 0) cancelAnimationFrame(frame);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  };
}
