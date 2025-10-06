import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import Spreadsheet from './Spreadsheet.jsx'

const STORAGE_KEY = 'spreadsheet:sheetV1'

describe('Spreadsheet', () => {
  beforeEach(() => {
    window.localStorage.clear()
    cleanup()
  })

  it('allows editing a cell inline', () => {
    render(<Spreadsheet />)
    const cellInput = screen.getByLabelText('Cell A1')
    fireEvent.change(cellInput, { target: { value: '42' } })
    expect(cellInput).toHaveValue('42')
    const cellContainer = cellInput.closest('td')
    expect(cellContainer).not.toBeNull()
    const display = within(cellContainer).getByText('42')
    expect(display).toBeInTheDocument()
  })

  it('computes formulas referencing other cells', () => {
    render(<Spreadsheet />)
    const cellA1 = screen.getByLabelText('Cell A1')
    const cellB1 = screen.getByLabelText('Cell B1')

    fireEvent.change(cellA1, { target: { value: '10' } })
    fireEvent.change(cellB1, { target: { value: '=A1*2' } })

    const cellContainer = cellB1.closest('td')
    expect(cellContainer).not.toBeNull()
    const result = within(cellContainer).getByText('20')
    expect(result).toBeInTheDocument()
  })

  it('persists values to localStorage and restores them', async () => {
    const { unmount } = render(<Spreadsheet />)
    const cellA1 = screen.getByLabelText('Cell A1')
    fireEvent.change(cellA1, { target: { value: '64' } })

    await waitFor(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      expect(stored).toContain('64')
    })

    unmount()

    render(<Spreadsheet />)
    const restoredCell = screen.getByLabelText('Cell A1')
    expect(restoredCell).toHaveValue('64')
  })
})
