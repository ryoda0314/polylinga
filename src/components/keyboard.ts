/**
 * Once a phone's keyboard is up, show the sentences to borrow from (the element with `refId`, right above the field)
 * together with the field being typed in: from the top of the sentences, when both fit above the keyboard. When they
 * do not, the browser has already put the field just above the keyboard with the last of the sentences above it, and
 * that stays. Nothing moves on a PC, or where the sentences sit beside the field.
 */
export function keepSentencesInView(refId: string, field: HTMLElement) {
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  window.setTimeout(() => {
    const ref = document.getElementById(refId)?.getBoundingClientRect();
    const view = window.visualViewport;
    const box = field.getBoundingClientRect();
    if (!ref || !view || ref.bottom > box.top) return;
    if (box.bottom - ref.top <= view.height - 16) document.getElementById(refId)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, 350);
}
