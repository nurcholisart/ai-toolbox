import React from 'react'
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

test('renders AI Toolbox heading', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: /ai toolbox/i })).toBeInTheDocument()
})

test('lists at least one tool card', () => {
  render(<App />)
  expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0)
})

