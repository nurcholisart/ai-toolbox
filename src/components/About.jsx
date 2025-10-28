import React from 'react'
import { IconBrandGithub, IconInfoCircle } from '@tabler/icons-react'

import { Button } from './ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx'

const toolHighlights = [
  'PDF to Markdown: extract clean Markdown from uploaded PDFs.',
  'Assessment Roast: critique assessments with structured feedback.',
  'Audio & Meeting Transcribers: turn recordings into editable notes.',
  'MP4 to MP3: convert video to audio locally via ffmpeg.wasm.',
]

const buildNotes = [
  'Built with React, Vite, and Tailwind.',
  'Default Shadcn UI theme with Tabler icons.',
  'Gemini API requests use your locally stored key.',
  'Media conversions run entirely in your browser when possible.',
]

export default function About() {
  return (
    <div className='space-y-10'>
      <header className='space-y-3'>
        <div className='inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-secondary-foreground'>
          <IconInfoCircle size={16} />
          <span className='text-sm font-medium'>About this project</span>
        </div>
        <p className='max-w-3xl text-base leading-relaxed text-muted-foreground'>
          Toolbox is a browser-first collection of AI-powered and media-centric utilities. It favors fast, reliable workflows,
          keeps data local whenever possible, and lets you plug in your own Gemini API key so requests stay under your control.
        </p>
      </header>

      <div className='grid gap-6 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>What’s inside</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className='list-disc space-y-2 pl-5 text-sm text-muted-foreground'>
              {toolHighlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>How it’s built</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className='list-disc space-y-2 pl-5 text-sm text-muted-foreground'>
              {buildNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Privacy first</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2 text-sm text-muted-foreground'>
          <p>Your API key is stored locally in your browser (localStorage).</p>
          <p>Tools send requests directly from your device to the Gemini API.</p>
          <p>Media conversions powered by ffmpeg.wasm happen entirely client-side.</p>
        </CardContent>
      </Card>

      <div className='flex flex-wrap gap-3'>
        <Button variant='outline' asChild className='gap-2'>
          <a href='https://github.com/nurcholisart/ai-toolbox' target='_blank' rel='noopener noreferrer'>
            <IconBrandGithub size={18} />
            View on GitHub
          </a>
        </Button>
        <Button asChild variant='link'>
          <a href='/'>Back to tools</a>
        </Button>
      </div>
    </div>
  )
}
