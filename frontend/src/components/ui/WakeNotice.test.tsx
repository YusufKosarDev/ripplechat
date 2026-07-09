import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WakeNotice from './WakeNotice'
import { LanguageProvider } from '../../i18n'

function renderNotice(show: boolean) {
  return render(
    <LanguageProvider>
      <WakeNotice show={show} />
    </LanguageProvider>,
  )
}

describe('WakeNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when hidden', () => {
    const { container } = renderNotice(false)
    expect(container).toBeEmptyDOMElement()
  })

  it('starts with the short message', () => {
    renderNotice(true)
    expect(screen.getByText(/Sunucu uyanıyor/)).toBeInTheDocument()
  })

  it('switches to the honest slow message with elapsed time after 30 s', () => {
    renderNotice(true)

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByText(/birkaç dakika sürebilir/)).toBeInTheDocument()
    expect(screen.getByText(/\(30 sn\)/)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByText(/\(1 dk 30 sn\)/)).toBeInTheDocument()
  })
})
