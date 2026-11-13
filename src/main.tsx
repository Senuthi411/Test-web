import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { App } from './app/App'
import { ConfigurationError } from './app/ConfigurationError'
import { readConfig } from './app/composition/config'
import { createContainer } from './app/composition/container'

const root = createRoot(document.getElementById('root')!)
const result = readConfig(import.meta.env)

if (!result.ok) {
  root.render(<ConfigurationError problems={result.problems} />)
} else {
  createContainer(result.config).then(
    (container) =>
      root.render(
        <StrictMode>
          <App container={container} />
        </StrictMode>,
      ),
    (error: unknown) =>
      root.render(<ConfigurationError problems={[`The application failed to start: ${String(error)}`]} />),
  )
}
