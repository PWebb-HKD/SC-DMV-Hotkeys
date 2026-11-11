/** Compute popup bounds in desktop CSS pixels, including browser frame decoration.
 * Available screen coordinates can be negative on monitors left of the primary. */
export function shortcutMenuBounds({contentWidth, contentHeight, frameWidth = 0, frameHeight = 0, availLeft = 0, availTop = 0, availWidth, availHeight}) {
  const width = Math.min(availWidth, Math.ceil(contentWidth + Math.max(0, frameWidth)));
  const height = Math.min(availHeight, Math.ceil(contentHeight + Math.max(0, frameHeight)));
  return {width, height, left: availLeft + availWidth - width, top: availTop + Math.floor((availHeight - height) / 2)};
}
