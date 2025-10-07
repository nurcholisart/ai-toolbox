import React, { useMemo, useRef } from 'react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualTable({ columns, data, emptyMessage = 'No rows to display', height = 320 }) {
  const tableColumns = useMemo(() => columns, [columns])
  const tableData = useMemo(() => data, [data])
  const table = useReactTable({
    columns: tableColumns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
  })
  const containerRef = useRef(null)
  const rows = table.getRowModel().rows
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 36,
    overscan: 12,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom = virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0

  return (
    <div
      ref={containerRef}
      className='border-2 border-black rounded-lg bg-white overflow-auto'
      style={{ height }}
      role='region'
      aria-live='polite'
    >
      <table className='min-w-full border-collapse text-sm'>
        <thead className='sticky top-0 bg-white border-b-2 border-black shadow-sm'>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope='col'
                  className='text-left font-semibold px-3 py-2 border-r last:border-r-0 border-black'
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {virtualRows.length === 0 && (
            <tr>
              <td className='px-3 py-4 text-center text-gray-500' colSpan={columns.length}>{emptyMessage}</td>
            </tr>
          )}
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index]
            return (
              <tr key={row.id} className='border-b border-gray-200 last:border-b-0'>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className='px-3 py-2 border-r last:border-r-0 border-gray-200 align-top'>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default VirtualTable
