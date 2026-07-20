import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'

function detectIOS() {
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function safeFileName(name: string) {
  return name.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 60) || 'cliente'
}

export function useCardExport(cardRef: RefObject<HTMLDivElement | null>, name: string, validate: () => boolean, onError: (message: string) => void = () => undefined) {
  const [busy, setBusy] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const preparedFile = useRef<File | null>(null)
  const isIOS = useMemo(detectIOS, [])

  const clearPrepared = useCallback(() => {
    setImageUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    preparedFile.current = null
  }, [])

  useEffect(() => clearPrepared, [clearPrepared])

  const generate = useCallback(async () => {
    if (!validate() || !cardRef.current) return null
    const canvas = await html2canvas(cardRef.current, { useCORS: true, scale: 3, backgroundColor: '#ffffff', logging: false })
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('No se pudo crear la imagen PNG.')), 'image/png')
    })
    return new File([blob], `tarjeta_fidelidad_${safeFileName(name)}.png`, { type: 'image/png' })
  }, [cardRef, name, validate])

  const showPrepared = useCallback((file: File) => {
    clearPrepared()
    preparedFile.current = file
    setImageUrl(URL.createObjectURL(file))
  }, [clearPrepared])

  const canShareFile = useCallback((file: File) => {
    try {
      return window.isSecureContext && typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
    } catch {
      return false
    }
  }, [])

  const sharePrepared = useCallback(async () => {
    const file = preparedFile.current
    if (!file || !canShareFile(file)) return
    try {
      await navigator.share({ files: [file] })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      onError(error instanceof Error ? error.message : 'No se pudo compartir la imagen.')
    }
  }, [canShareFile, onError])

  const prepareDownload = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const file = await generate()
      if (!file) return
      showPrepared(file)
      if (!isIOS) {
        const url = URL.createObjectURL(file)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 0)
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'No se pudo preparar la descarga.')
    } finally {
      setBusy(false)
    }
  }, [busy, generate, isIOS, onError, showPrepared])

  const prepareShare = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const file = await generate()
      if (!file) return
      if (isIOS || !canShareFile(file)) showPrepared(file)
      else await navigator.share({ files: [file] })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) onError(error instanceof Error ? error.message : 'No se pudo compartir la imagen.')
    } finally {
      setBusy(false)
    }
  }, [busy, canShareFile, generate, isIOS, onError, showPrepared])

  return {
    busy,
    imageUrl,
    isIOS,
    canSharePrepared: preparedFile.current ? canShareFile(preparedFile.current) : false,
    prepareDownload,
    prepareShare,
    sharePrepared,
    closeModal: clearPrepared,
  }
}
