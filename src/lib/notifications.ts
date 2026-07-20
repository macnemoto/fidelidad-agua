import { toast } from 'sonner'

export const toastId = {
  client: 'client-operation',
  clientLoad: 'client-load',
  dashboard: 'dashboard-load',
  directory: 'directory-load',
  export: 'card-export',
  reward: 'reward-confirmation',
  session: 'session-operation',
} as const

export function showSuccess(message: string, id?: string) {
  toast.success(message, { id })
}

export function showError(message: string, id?: string) {
  toast.error(message, { id, duration: 6000 })
}

export function showInfo(message: string, id?: string) {
  toast.info(message, { id })
}

export function showLoading(message: string, id: string) {
  toast.loading(message, { id, duration: Infinity })
}

export function dismissToast(id: string) {
  toast.dismiss(id)
}

export function confirmReward(onConfirm: () => void) {
  toast.warning('¿Confirmar canje del beneficio?', {
    id: toastId.reward,
    description: 'Se aplicará el descuento de un tanque y el progreso volverá a 0.',
    duration: Infinity,
    action: { label: 'Canjear', onClick: () => onConfirm() },
    cancel: { label: 'Cancelar', onClick: () => undefined },
  })
}
