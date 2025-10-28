import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from './App.jsx'

function renderApp(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>
  )
}

test('renders Toolbox heading', () => {
  renderApp()
  expect(screen.getByRole('heading', { name: /ai toolbox/i })).toBeInTheDocument()
})

test('lists at least one tool card', () => {
  renderApp()
  expect(screen.getByText('PDF to Markdown')).toBeInTheDocument()
})
