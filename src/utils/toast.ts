const TOAST_VISIBLE_MS = 4000

function getToastElement(): HTMLElement {
  let toast = document.querySelector<HTMLElement>('#cbsToast')

  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'cbsToast'
    toast.className = 'cbs-toast'
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    document.body.appendChild(toast)
  }

  return toast
}

export function showSuccessToast(message: string): void {
  const toast = getToastElement()
  toast.textContent = message
  toast.classList.add('cbs-toast--visible')

  window.setTimeout(() => {
    toast.classList.remove('cbs-toast--visible')
  }, TOAST_VISIBLE_MS)
}
