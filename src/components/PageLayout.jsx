import React from 'react'
import { Link } from 'react-router-dom'
import { IconArrowLeft } from '@tabler/icons-react'

import { cn } from '../lib/utils.js'
import { Button } from './ui/button.jsx'

export default function PageLayout({
  title,
  description,
  backLink = '/',
  backLabel = 'Back to tools',
  actions,
  contentClassName = '',
  children,
}) {
  return (
    <div className='w-full px-6 py-10'>
      <div className='flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'>
        <div className='space-y-4'>
          {backLink && (
            <Button variant='ghost' asChild className='w-fit px-0 text-muted-foreground hover:text-foreground'>
              <Link to={backLink} className='inline-flex items-center gap-2'>
                <IconArrowLeft size={18} />
                {backLabel}
              </Link>
            </Button>
          )}
          <div className='space-y-2'>
            <h1 className='text-4xl font-bold tracking-tight'>{title}</h1>
            {description ? (
              <p className='max-w-3xl text-base text-muted-foreground'>{description}</p>
            ) : null}
          </div>
        </div>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
          {actions}
        </div>
      </div>
      <div className={cn('mt-10 space-y-10', contentClassName)}>{children}</div>
    </div>
  )
}
