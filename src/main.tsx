import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-center"
      richColors
      closeButton
      visibleToasts={3}
      mobileOffset={16}
      toastOptions={{ classNames: { toast: 'app-toast', title: 'app-toast-title', description: 'app-toast-description', actionButton: 'app-toast-action', cancelButton: 'app-toast-cancel' } }}
    />
  </StrictMode>,
)
