import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import Spreadsheet from './Spreadsheet.jsx'

const STORAGE_KEY = 'spreadsheet:sheetV2'

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

  it('pastes multi-cell clipboard data across the grid', () => {
    render(<Spreadsheet />)
    const startCell = screen.getByLabelText('Cell B2')

    fireEvent.paste(startCell, {
      clipboardData: {
        getData: () => '1\t2\n3\t4',
      },
    })

    expect(screen.getByLabelText('Cell B2')).toHaveValue('1')
    expect(screen.getByLabelText('Cell C2')).toHaveValue('2')
    expect(screen.getByLabelText('Cell B3')).toHaveValue('3')
    expect(screen.getByLabelText('Cell C3')).toHaveValue('4')
  })

  it('adds rows and columns from in-grid buttons', () => {
    render(<Spreadsheet />)

    fireEvent.click(screen.getByRole('button', { name: /row/i }))
    fireEvent.click(screen.getByRole('button', { name: /column/i }))

    expect(screen.getByLabelText('Cell A9')).toBeInTheDocument()
    expect(screen.getByLabelText('Cell G1')).toBeInTheDocument()
  })

  it('removes a row via the context menu', () => {
    render(<Spreadsheet />)

    const rowHeader = screen.getByText('1')
    fireEvent.contextMenu(rowHeader, { clientX: 10, clientY: 10 })

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    expect(screen.queryByLabelText('Cell A8')).not.toBeInTheDocument()
  })

  it('removes a column via the context menu', () => {
    render(<Spreadsheet />)

    const columnHeader = screen.getByText('A')
    fireEvent.contextMenu(columnHeader, { clientX: 12, clientY: 12 })

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    expect(screen.queryByLabelText('Cell F1')).not.toBeInTheDocument()
  })
})
