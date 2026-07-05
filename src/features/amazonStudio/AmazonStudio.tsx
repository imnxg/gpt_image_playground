import AmazonPlanner from './components/AmazonPlanner'

export default function AmazonStudio() {
  return (
    <main data-home-main className="pb-48 lg:pb-10">
      <div className="safe-area-x max-w-7xl mx-auto lg:!px-6">
        <AmazonPlanner />
      </div>
    </main>
  )
}

export function isAmazonStudioHash(hash = window.location.hash) {
  return hash === '#amazon'
}

export function openAmazonStudio() {
  window.location.hash = 'amazon'
}

export function closeAmazonStudio() {
  if (window.location.hash === '#amazon') {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }
}
