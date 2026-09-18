import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './campus-base.css'
import CampusMateApp from './CampusMateApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CampusMateApp />
  </StrictMode>,
)
