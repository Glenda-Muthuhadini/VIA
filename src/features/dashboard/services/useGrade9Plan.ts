import { useCallback, useEffect, useRef, useState } from 'react'
import { defaultGrade9Plan, loadGrade9Plan, saveGrade9Plan, type Grade9Plan, type Grade9PlanPatch } from './grade9-plan'

type PlanState = { userId: string; plan: Grade9Plan | null; error: string | null; saving: boolean }

// The database response is the source of completion. A failed save never marks
// a planning action complete, and queued writes cannot cross an account change.
export function useGrade9Plan(userId: string | undefined, initialIds: string[] = []) {
  const [state, setState] = useState<PlanState | null>(null)
  const [attempt, setAttempt] = useState(0)
  const owner = useRef(userId)
  const latest = useRef<Grade9Plan | null>(null)
  const generation = useRef(0)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const failedPatch = useRef<Grade9PlanPatch | null>(null)
  const initialKey = JSON.stringify(initialIds)

  useEffect(() => {
    const version = ++generation.current
    owner.current = userId
    latest.current = null
    failedPatch.current = null
    queue.current = Promise.resolve()
    if (!userId) return
    void loadGrade9Plan(userId).then(plan => {
      if (owner.current !== userId || generation.current !== version) return
      const loaded = plan ?? { ...defaultGrade9Plan(JSON.parse(initialKey) as string[]), user_id: userId }
      latest.current = loaded
      setState({ userId, plan: loaded, error: null, saving: false })
    }).catch(error => {
      if (owner.current === userId && generation.current === version) setState({ userId, plan: null, error: error instanceof Error ? error.message : 'We could not load your plan. Retry when you are connected.', saving: false })
    })
    return () => { generation.current = version + 1 }
  }, [userId, attempt, initialKey])

  const update = useCallback((patch: Grade9PlanPatch): Promise<void> => {
    const version = generation.current
    const request = queue.current.catch(() => {}).then(async () => {
      if (!userId || owner.current !== userId || version !== generation.current) throw new Error('Your account changed. Reload your plan before saving.')
      if (!latest.current) throw new Error('Wait for your plan to load, then retry.')
      setState(current => current?.userId === userId ? { ...current, saving: true, error: null } : current)
      try {
        const saved = await saveGrade9Plan(userId, patch, latest.current.revision)
        if (owner.current !== userId || version !== generation.current) return
        latest.current = saved
        failedPatch.current = null
        setState({ userId, plan: saved, saving: false, error: null })
      } catch (error) {
        if (owner.current === userId && version === generation.current) {
          failedPatch.current = patch
          setState(current => current?.userId === userId ? { ...current, saving: false, error: error instanceof Error ? error.message : 'Your change was not saved. Please retry.' } : current)
        }
        throw error
      }
    })
    queue.current = request
    return request
  }, [userId])

  const retry = useCallback(() => {
    if (!userId || owner.current !== userId) return
    const patch = failedPatch.current
    if (!patch) { setState(null); setAttempt(value => value + 1); return }
    const version = generation.current
    setState(current => current?.userId === userId ? { ...current, saving: true, error: null } : current)
    void loadGrade9Plan(userId).then(plan => {
      if (owner.current !== userId || version !== generation.current) return
      latest.current = plan ?? { ...defaultGrade9Plan(JSON.parse(initialKey) as string[]), user_id: userId }
      return update(patch)
    }).catch(error => {
      if (owner.current === userId && version === generation.current) setState(current => current?.userId === userId ? { ...current, saving: false, error: error instanceof Error ? error.message : 'We could not reload your plan. Please retry.' } : current)
    })
  }, [userId, update, initialKey])

  const current = state?.userId === userId ? state : null
  return { plan: current?.plan ?? null, loading: !!userId && !current?.plan && !current?.error, saving: current?.saving ?? false, error: current?.error ?? null, retry, update }
}
