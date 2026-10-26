import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import { App } from './App'
import { AuthProvider, useAuth } from './auth'
import { AuthScreen } from './components/AuthScreen'
import { Splash } from './components/Loading'
import { PlannerProvider } from './state'
import './styles.css'

function Root() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user) return <AuthScreen />
  return (
    <PlannerProvider user={user}>
      <App />
    </PlannerProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <Root />
      </AuthProvider>
    </MotionConfig>
  </StrictMode>,
)
