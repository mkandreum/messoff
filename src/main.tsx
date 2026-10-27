import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { LazyMotion, MotionConfig } from 'motion/react'
import { App } from './App'
import { AuthProvider, useAuth } from './auth'
import { Splash } from './components/Loading'
import { PlannerProvider } from './state'
import { FocusProvider } from './focusTimer'
import './styles.css'

const loadFeatures = () => import('./lib/motionFeatures').then((mod) => mod.default)

const AuthScreen = lazy(() =>
  import('./components/AuthScreen').then((m) => ({ default: m.AuthScreen })),
)

function Root() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user)
    return (
      <Suspense fallback={<Splash />}>
        <AuthScreen />
      </Suspense>
    )
  return (
    <PlannerProvider user={user}>
      <FocusProvider>
        <App />
      </FocusProvider>
    </PlannerProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadFeatures}>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </LazyMotion>
    </MotionConfig>
  </StrictMode>,
)
