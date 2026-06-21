import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'
import { LanguageProvider } from '../i18n'

function Boom(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows a fallback when a child throws', () => {
    // React logs caught errors to console.error; silence it for clean output.
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <LanguageProvider>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </LanguageProvider>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Bir şeyler ters gitti')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeInTheDocument()
  })

  it('renders children when there is no error', () => {
    render(
      <LanguageProvider>
        <ErrorBoundary>
          <p>all good</p>
        </ErrorBoundary>
      </LanguageProvider>,
    )

    expect(screen.getByText('all good')).toBeInTheDocument()
  })
})
