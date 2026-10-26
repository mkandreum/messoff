import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { haptic } from '../lib/haptics'
import { usePlanner } from '../state'

export function Toast() {
  const { toast, dismissToast } = usePlanner()

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          className="toast"
          role="status"
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.99 }}
          transition={{ type: 'spring', stiffness: 500, damping: 36 }}
        >
          <span className="toast__dot" aria-hidden="true" />
          <p className="toast__msg">{toast.message}</p>
          {toast.actionLabel && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                haptic('light')
                toast.onAction?.()
                dismissToast()
              }}
            >
              {toast.actionLabel}
            </button>
          )}
          <button
            type="button"
            className="toast__close"
            onClick={dismissToast}
            aria-label="Cerrar aviso"
          >
            <X size={14} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
