import { Toaster } from 'sonner'
import { usePlanner } from '../state'

/**
 * Avisos con Sonner: se apilan, se descartan deslizando y respetan
 * el sistema visual de MessOff (clases propias, sin estilos de la librería).
 */
export function Toast() {
  const { theme } = usePlanner()
  return (
    <Toaster
      position="bottom-center"
      theme={theme === 'night' ? 'dark' : 'light'}
      offset={24}
      mobileOffset={{ bottom: 'calc(92px + env(safe-area-inset-bottom))' }}
      gap={8}
      visibleToasts={3}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'toast',
          title: 'toast__msg',
          actionButton: 'toast__action',
          closeButton: 'toast__close',
        },
      }}
    />
  )
}
