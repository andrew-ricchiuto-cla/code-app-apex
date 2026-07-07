import { RevealDashboard } from '@/screens/RevealDashboard/RevealDashboard'

export function ObserverView() {
  return (
    <div>
      <div className="border-b border-amber-200 bg-amber-50 px-8 py-2 text-center text-sm text-amber-700">
        Observer Mode — Read Only
      </div>
      <RevealDashboard />
    </div>
  )
}
