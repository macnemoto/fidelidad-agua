interface ShareModalProps {
  imageUrl: string | null
  canShare: boolean
  isIOS: boolean
  onShare: () => void
  onClose: () => void
}

export function ShareModal({ imageUrl, canShare, isIOS, onShare, onClose }: ShareModalProps) {
  if (!imageUrl) return null

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Imagen generada">
      <p className="modal-instruction">
        {isIOS
          ? canShare
            ? 'La imagen está lista. Pulsa el botón y selecciona WhatsApp o Guardar imagen.'
            : 'Mantén presionada la imagen, elige Guardar en Fotos y luego compártela por WhatsApp.'
          : 'La imagen está lista. Puedes guardarla o compartirla.'}
      </p>
      <div className="modal-content">
        <img className="modal-img" src={imageUrl} alt="Tarjeta de fidelidad lista" />
        {canShare && (
          <button className="btn btn-whatsapp" type="button" onClick={onShare}>
            📤 {isIOS ? 'Compartir o guardar en iPhone' : 'Compartir imagen'}
          </button>
        )}
        <button className="btn-close-modal" type="button" onClick={onClose}>Volver a editar</button>
      </div>
    </div>
  )
}
