import { useEffect } from 'react'
import { useAppStore } from './store/appStore'
import { FreePlayView } from './views/FreePlayView'

export default function App(): React.JSX.Element {
  const bootstrap = useAppStore((s) => s.bootstrap)
  const bootstrapped = useAppStore((s) => s.bootstrapped)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (!bootstrapped) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-900">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-ink-600 border-t-brand-500" />
          <p className="text-sm text-ink-300">Starting up…</p>
        </div>
      </div>
    )
  }

  return <FreePlayView />
}
