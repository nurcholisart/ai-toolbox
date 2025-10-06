import React from 'react'
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

test('renders Toolbox heading', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: /toolbox/i })).toBeInTheDocument()
})

test('lists at least one tool card', () => {
  render(<App />)
  expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0)
})

test('shows the Spreadsheet tool card', () => {
  render(<App />)
  expect(screen.getByRole('heading', { level: 2, name: 'Spreadsheet' })).toBeInTheDocument()
})
