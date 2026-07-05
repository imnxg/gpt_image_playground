import WalmartPlanner from './components/WalmartPlanner'

export default function WalmartStudio() {
  return (
    <main data-home-main className="pb-48 lg:pb-10">
      <div className="safe-area-x max-w-7xl mx-auto lg:!px-6">
        <WalmartPlanner />
      </div>
    </main>
  )
}

export function isWalmartStudioHash(hash = window.location.hash) {
  return hash === '#walmart'
}

export function openWalmartStudio() {
  window.location.hash = 'walmart'
}

export function closeWalmartStudio() {
  if (window.location.hash === '#walmart') {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }
}
