import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from './store/appStore'
import { MidiStatusBar } from './components/MidiStatusBar'
import { HomeView } from './views/HomeView'
import { LessonView } from './views/LessonView'
import { FreePlayView } from './views/FreePlayView'
import { SettingsView } from './views/SettingsView'
import { getLesson } from './lessons/curriculum'

type Route =
  | { name: 'home' }
  | { name: 'lesson'; lessonId: string }
  | { name: 'freeplay' }
  | { name: 'settings' }

const TABS: Array<{ id: Route['name']; label: string }> = [
  { id: 'home', label: 'Lessons' },
  { id: 'freeplay', label: 'Free play' },
  { id: 'settings', label: 'Settings' }
]

export default function App(): React.JSX.Element {
  const bootstrap = useAppStore((s) => s.bootstrap)
  const bootstrapped = useAppStore((s) => s.bootstrapped)
  const [route, setRoute] = useState<Route>({ name: 'home' })

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const openLesson = useCallback((lessonId: string) => {
    setRoute({ name: 'lesson', lessonId })
  }, [])

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

  // A lesson takes over the whole window — it has its own header and keyboard.
  if (route.name === 'lesson') {
    const lesson = getLesson(route.lessonId)
    if (!lesson) {
      setRoute({ name: 'home' })
      return <div className="h-full bg-ink-900" />
    }
    return (
      <LessonView
        key={lesson.id}
        lesson={lesson}
        onExit={() => setRoute({ name: 'home' })}
        onAdvance={openLesson}
      />
    )
  }

  if (route.name === 'freeplay') {
    return <FreePlayView onExit={() => setRoute({ name: 'home' })} />
  }

  return (
    <div className="flex h-full flex-col bg-ink-900">
      <MidiStatusBar />

      <nav className="flex gap-1 border-b border-ink-700 bg-ink-850 px-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setRoute({ name: tab.id } as Route)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm ${
              route.name === tab.id
                ? 'border-brand-500 font-medium text-ink-100'
                : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto">
        {route.name === 'home' && <HomeView onOpenLesson={openLesson} />}
        {route.name === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}
