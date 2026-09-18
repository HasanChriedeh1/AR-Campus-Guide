import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './campus-base.css'
import RhuStudentApp from './RhuStudentApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RhuStudentApp />
  </StrictMode>,
)
