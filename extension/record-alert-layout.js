/** Fit record alerts to their current monitor's work area without shrinking status headings.
 * Browser frame pixels count toward the outer limit; no display permission is needed. */
export function fitRecordAlert() {
  // Focusing the bottom Close button must never scroll the initial status out of view.
  const resetScroll = () => window.scrollTo(0, 0);
  resetScroll();
  if (!chrome.windows?.getCurrent || !chrome.windows?.update) return () => {};
  const text = [...document.body.querySelectorAll('*')]
    .filter(el => !el.matches('h2.record-status-title') &&
      [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()))
    .map(el => ({el, size: parseFloat(getComputedStyle(el).fontSize)}));
  let running = false, pending = false, currentId, scrolling = false;
  const setScale = scale => {
    for (const {el, size} of text) el.style.fontSize = `${Math.max(Math.min(size, 12), size * scale)}px`;
  };
  const contentHeight = () => Math.ceil(document.body.getBoundingClientRect().height);
  /** Serialize native resizing and remeasure after the browser accepts its bounds. */
  async function fit() {
    if (scrolling) return;
    if (running) { pending = true; return; }
    running = true;
    delete document.body.dataset.alertFit;
    try {
      await document.fonts.ready;
      const win = await chrome.windows.getCurrent();
      if (scrolling) return;
      currentId = win.id;
      const frame = Math.max(0, win.height - innerHeight);
      const available = Number.isFinite(screen.availHeight) && screen.availHeight > frame ? screen.availHeight : win.height;
      const top = Number.isFinite(screen.availTop) ? screen.availTop : 0;
      const left = Number.isFinite(screen.availLeft) ? screen.availLeft : 0;
      setScale(1);
      const height = Math.min(available, Math.max(win.height, contentHeight() + frame + 2));
      // Anchor every status alert at this monitor's usable top-left, including short alerts.
      if (win.height !== height || win.top !== top || win.left !== left) {
        await chrome.windows.update(win.id, {height, top, left});
      }
      // Shrink supporting text only after trying the native window's available height.
      // The accepted viewport can differ from the requested bounds due to OS limits.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (scrolling) return;
      if (contentHeight() > innerHeight) {
        let low = 0, high = 1;
        setScale(0);
        if (contentHeight() <= innerHeight) {
          for (let i = 0; i < 12; i++) {
            const mid = (low + high) / 2; setScale(mid);
            if (contentHeight() <= innerHeight) low = mid; else high = mid;
          }
          setScale(low);
        }
        // If even readable minimum text will not fit, retain scrolling and the full status size.
      }
      document.body.dataset.alertFit = 'ready';
    } catch {
      // A denied or closed native window must leave the alert readable and dismissible.
      setScale(1);
    } finally {
      running = false;
      if (pending) { pending = false; void fit(); }
    }
  }
  const onBounds = win => { if (win.id === currentId) void fit(); };
  window.addEventListener('resize', fit);
  chrome.windows.onBoundsChanged?.addListener(onBounds);
  window.addEventListener('pagehide', () => {
    window.removeEventListener('resize', fit);
    chrome.windows.onBoundsChanged?.removeListener(onBounds);
  }, {once: true});
  void fit().then(() => { if (!scrolling) resetScroll(); });
  // Once details are used, restore original text sizes and leave the window scrollable.
  // The guard also prevents an already pending native resize from shrinking text again.
  return () => {
    scrolling = true;
    setScale(1);
    window.removeEventListener('resize', fit);
    chrome.windows.onBoundsChanged?.removeListener(onBounds);
    document.body.dataset.alertFit = 'ready';
  };
}
