import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'
import ToastViewport from './ToastViewport'
import toastReducer, { showToast } from '../features/toast/toastSlice'
import { LanguageProvider } from '../i18n'

function setup() {
  const store = configureStore({ reducer: { toast: toastReducer } })
  store.dispatch(showToast({ message: 'İletildi', variant: 'success' }))
  render(
    <Provider store={store}>
      <LanguageProvider>
        <ToastViewport />
      </LanguageProvider>
    </Provider>,
  )
  return store
}

describe('ToastViewport', () => {
  it('shows a toast and removes it when dismissed', () => {
    const store = setup()

    expect(screen.getByText('İletildi')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Bildirimi kapat' }))

    expect(store.getState().toast.toasts).toHaveLength(0)
    expect(screen.queryByText('İletildi')).not.toBeInTheDocument()
  })
})
