/**
 * DOM adapter executed inside the website, not inside the extension. Chrome serializes
 * pageOperation: helpers, literals, and origin checks inside it must be self-contained.
 * Do not replace its URL literals with imports: imported bindings are unavailable there.
 */
// Runs in the page's MAIN world so native setters and framework listeners see changes.
export function pageOperation(op, args = {}) {
  // These helpers must remain inside the serialized function to run in the website context.
  const visible = el => el && (el.getClientRects().length > 0) && getComputedStyle(el).visibility !== 'hidden';
  const find = selector => { const el = document.querySelector(selector); if (!el) throw new Error(`Page control not found: ${selector}`); return el; };
  // Return only control availability and visible errors; never scrape login field values.
  if (op === 'state') {
    const control = args.selector ? document.querySelector(args.selector) : null;
    return {
      url: location.href,
      errors: [...new Set([...document.querySelectorAll(args.errorSelector || '.iFormsValidationSummary li span, #ContentPlaceHolder1_errorMessagePublicText')].filter(visible).map(x => x.textContent.trim()).filter(Boolean))],
      portalError: location.origin === 'https://www.scdmvonline.com' && !!visible(document.querySelector('#ContentPlaceHolder1_errorMessagePublicText')),
      present: !!control,
      enabled: !!control && !control.disabled,
      presentSelectors: args.selectors ? args.selectors.map(selector => !!document.querySelector(selector)) : []
    };
  }
  if (op === 'notifyInputs') {
    // Notify delegated form/framework listeners after related controls have
    // been populated. Preserve each control's existing value.
    const inputs = args.selectors.map(find);
    for (const el of inputs) {
      el.dispatchEvent(new Event('input', {bubbles: true}));
      el.dispatchEvent(new Event('change', {bubbles: true}));
      el.dispatchEvent(new KeyboardEvent('keyup', {key: 'Tab', code: 'Tab', bubbles: true}));
      el.dispatchEvent(new Event('blur', {bubbles: true}));
    }
    return true;
  }
  // Reassert extension-owned credentials before submit so browser autofill cannot switch accounts.
  if (op === 'extensionLogin') {
    if (location.origin === 'https://www.scdmvonline.com' && !/^\/SCTRNS\/Member\/logon\.aspx$/i.test(location.pathname)) return true;
    if (location.origin !== 'https://www.scdmvonline.com' || !/^\/SCTRNS\/Member\/logon\.aspx$/i.test(location.pathname)) {
      throw new Error('Extension credentials may only be filled on the SCDMV login page.');
    }
    const values = [args.credentials?.user, args.credentials?.password];
    if (!values.every(value => typeof value === 'string' && value.length > 0)) throw new Error('Extension User ID and password are required.');
    const inputs = args.selectors.map(find);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (let index = 0; index < inputs.length; index++) {
      const el = inputs[index], value = values[index];
      if (el.disabled || el.readOnly) throw new Error('The website has disabled a login field.');
      if (args.submit && el.value === value) continue;
      el.setAttribute('autocomplete', 'off');
      el.focus({preventScroll: true});
      setter.call(el, value);
      el.dispatchEvent(new Event('input', {bubbles: true}));
      el.dispatchEvent(new Event('change', {bubbles: true}));
      el.blur();
    }
    if (!inputs.every((el, index) => el.value === values[index])) throw new Error('The website did not retain the extension login values.');
    if (args.submit) {
      const button = find(args.button);
      if (!visible(button) || button.disabled) throw new Error('The website login button is not ready.');
      button.click();
    }
    return true;
  }
  // Native setters and bubbling events keep the portal framework synchronized with the filled value.
  if (op === 'fill') {
    const el = find(args.selector);
    if (el.disabled || el.readOnly) throw new Error('The website has disabled this input.');
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, args.value);
    for (const type of ['keydown', 'keypress']) el.dispatchEvent(new KeyboardEvent(type, {key: 'Tab', code: 'Tab', bubbles: true}));
    el.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText', data: args.value}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
    el.dispatchEvent(new KeyboardEvent('keyup', {key: 'Tab', code: 'Tab', bubbles: true}));
    el.dispatchEvent(new Event('blur', {bubbles: true}));
    return true;
  }
  if (op === 'click') { const el = find(args.selector); if (!visible(el) || el.disabled) throw new Error('The website control is not ready.'); el.click(); return true; }
  // Fetch only same-origin attachment bytes and reject HTML/login responses before decoding.
  if (op === 'fetchPdf') return (async () => {
    if (location.origin !== 'https://www.scdmvonline.com') throw new Error('PDF fetch must use the DMV session.');
    const u = new URL(args.url);
    if (u.origin !== location.origin || !/\/ViewAttachment\.aspx$/i.test(u.pathname)) throw new Error('Unexpected PDF URL.');
    const response = await fetch(u.href, {credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(25000)});
    if (!response.ok) throw new Error(`PDF request failed (${response.status}).`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 24 * 1024 * 1024) throw new Error('This PDF exceeds the 24 MB extraction limit.');
    if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-')) throw new Error('The server returned a login page or non-PDF response. Sign in and run the search again.');
    let binary = '';
    for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
    return btoa(binary);
  })();
  throw new Error('Unknown page operation.');
}
