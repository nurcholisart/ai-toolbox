import React, { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { IconInfoCircle, IconSettings } from '@tabler/icons-react'

import PdfToMarkdown from './components/PdfToMarkdown.jsx'
import AssessmentRoast from './components/AssessmentRoast.jsx'
import AudioTranscriber from './components/AudioTranscriber.jsx'
import Mp4ToMp3 from './components/Mp4ToMp3.jsx'
import MeetingTranscription from './components/MeetingTranscription.jsx'
import PictureMe from './components/PictureMe.jsx'
import RemoveBackground from './components/RemoveBackground.jsx'
import ContextCards from './components/ContextCards.jsx'
import FlowerBouquetGenerator from './components/FlowerBouquetGenerator.jsx'
import InformationVerifier from './components/InformationVerifier.jsx'
import LockfileScanner from './components/LockfileScanner.jsx'
import MermaidValidator from './components/MermaidValidator.jsx'
import MermaidEditor from './components/MermaidEditor.jsx'
import SSEToJSON from './components/SSEToJSON.jsx'
import TokenCounter from './components/TokenCounter.jsx'
import Notable from './components/Notable.jsx'
import Promptable from './components/Promptable.jsx'
import ChromaticTuner from './components/ChromaticTuner.jsx'
import GemfileScanner from './components/GemfileScanner.jsx'
import GoSumScanner from './components/GoSumScanner.jsx'
import TailwindPaletteGenerator from './components/TailwindPaletteGenerator.jsx'
import HillChart from './components/HillChart.jsx'
import ShapeUpInfographic from './components/ShapeUpInfographic.jsx'
import Settings from './components/Settings.jsx'
import About from './components/About.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import MicrophoneTranscriber from './components/MicrophoneTranscriber.jsx'
import Quizzes from './components/Quizzes.jsx'
import QueryExplorer from './components/QueryExplorer.jsx'

import PageLayout from './components/PageLayout.jsx'
import { Button } from './components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card.jsx'
import { getApiKey } from './lib/config.js'

const toolDefinitions = [
  {
    path: '/pdf-to-markdown',
    name: 'PDF to Markdown',
    description: 'Convert PDF content into clean Markdown.',
    component: PdfToMarkdown,
  },
  {
    path: '/assessment-roast',
    name: 'Assessment Roast',
    description: 'Brutally review a project assessment.',
    component: AssessmentRoast,
  },
  {
    path: '/audio-transcriber',
    name: 'Audio Transcriber',
    description: 'Transcribe uploaded audio to Markdown.',
    component: AudioTranscriber,
  },
  {
    path: '/microphone-transcriber',
    name: 'Microphone Transcriber',
    description: 'Record directly from your mic into Markdown.',
    component: MicrophoneTranscriber,
  },
  {
    path: '/meeting-transcription',
    name: 'Meeting Transcription',
    description: 'Upload audio or video to receive a transcript.',
    component: MeetingTranscription,
  },
  {
    path: '/mp4-to-mp3',
    name: 'MP4 to MP3',
    description: 'Convert video to MP3 entirely in the browser.',
    component: Mp4ToMp3,
  },
  {
    path: '/picture-me',
    name: 'PictureMe',
    description: 'Transform photos with Gemini creative edits.',
    component: PictureMe,
    layout: { contentClassName: 'space-y-0' },
  },
  {
    path: '/remove-background',
    name: 'Remove Background',
    description: 'Erase backgrounds from product photos with AI.',
    component: RemoveBackground,
    layout: { contentClassName: 'space-y-0' },
  },
  {
    path: '/flower-bouquet',
    name: 'Flower Bouquet Generator',
    description: 'Craft a realistic bouquet photo from prompts.',
    component: FlowerBouquetGenerator,
    layout: { contentClassName: 'space-y-0' },
  },
  {
    path: '/context-cards',
    name: 'Context Cards',
    description: 'Mitigate context failure modes with targeted cards.',
    component: ContextCards,
  },
  {
    path: '/tailwind-palette',
    name: 'Tailwind Palette Generator',
    description: 'Generate Tailwind-style color palettes.',
    component: TailwindPaletteGenerator,
  },
  {
    path: '/hill-chart',
    name: 'Hill Chart',
    description: 'Track progress along the Shape Up hill.',
    component: HillChart,
  },
  {
    path: '/shape-up',
    name: 'Shape Up Infographic',
    description: 'Printable summary of Shape Up product management.',
    component: ShapeUpInfographic,
  },
  {
    path: '/information-verifier',
    name: 'Information Verifier',
    description: 'Verify claims and request citations from Gemini.',
    component: InformationVerifier,
  },
  {
    path: '/lockfile-scanner',
    name: 'Lockfile Scanner',
    description: 'Check JavaScript dependencies for vulnerabilities.',
    component: LockfileScanner,
  },
  {
    path: '/gemfile-scanner',
    name: 'Gemfile.lock Scanner',
    description: 'Scan Ruby gems for known security issues.',
    component: GemfileScanner,
  },
  {
    path: '/go-sum-scanner',
    name: 'go.sum Scanner',
    description: 'Check Go modules for vulnerabilities.',
    component: GoSumScanner,
  },
  {
    path: '/mermaid-validator',
    name: 'Mermaid Validator',
    description: 'Validate Mermaid diagrams instantly.',
    component: MermaidValidator,
  },
  {
    path: '/mermaid-editor',
    name: 'Mermaid Editor',
    description: 'Edit Mermaid diagrams with live preview and AI.',
    component: MermaidEditor,
    layout: { contentClassName: 'space-y-0' },
  },
  {
    path: '/sse-to-json',
    name: 'SSE to JSON',
    description: 'Convert Server-Sent Events streams into structured JSON.',
    component: SSEToJSON,
  },
  {
    path: '/token-counter',
    name: 'Token Counter',
    description: 'Count tokens with layered CDN fallbacks.',
    component: TokenCounter,
  },
  {
    path: '/notable',
    name: 'Notable',
    description: 'Take local notes with a rich-text editor.',
    component: Notable,
    layout: { contentClassName: 'space-y-0' },
  },
  {
    path: '/promptable',
    name: 'Promptable',
    description: 'Iterate on prompts with Gemini previews.',
    component: Promptable,
    layout: { contentClassName: 'space-y-0 px-0' },
  },
  {
    path: '/chromatic-tuner',
    name: 'Chromatic Tuner',
    description: 'Tune instruments via your microphone.',
    component: ChromaticTuner,
    layout: { contentClassName: 'space-y-0' },
  },
  {
    path: '/quizzes',
    name: 'Quizzes',
    description: 'Create embeddable knowledge quizzes.',
    component: Quizzes,
  },
  {
    path: '/tools/query-explorer',
    name: 'Query Explorer',
    description: 'Run SQL on CSV, NDJSON, or Parquet entirely offline.',
    component: QueryExplorer,
    layout: { contentClassName: 'space-y-0 px-0' },
  },
  {
    name: 'Propose new tool',
    description: 'Suggest an idea on GitHub.',
    path: 'https://github.com/nurcholisart/ai-toolbox',
    target: '_blank',
    external: true,
  },
]

function AppHeader() {
  const location = useLocation()
  const navItems = useMemo(
    () => [
      { to: '/about', label: 'About', icon: IconInfoCircle },
      { to: '/settings', label: 'Settings', icon: IconSettings },
    ],
    []
  )

  return (
    <header className='sticky top-0 z-50 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      <div className='flex w-full items-center justify-between px-6 py-4'>
        <Link to='/' className='text-xl font-semibold tracking-tight'>
          AI Toolbox
        </Link>
        <div className='flex items-center gap-2'>
          <InstallPrompt />
          {navItems.map(({ to, label, icon: Icon }) => (
            <Button
              key={to}
              variant={location.pathname === to ? 'default' : 'ghost'}
              asChild
              className='gap-2'
            >
              <NavLink to={to} className='flex items-center gap-2 text-sm font-medium'>
                <Icon size={18} />
                {label}
              </NavLink>
            </Button>
          ))}
        </div>
      </div>
    </header>
  )
}

function HomePage({ hasKey }) {
  const tools = useMemo(() => toolDefinitions.filter((tool) => !tool.external), [])
  const externalLinks = useMemo(() => toolDefinitions.filter((tool) => tool.external), [])

  return (
    <div className='w-full px-6 py-10'>
      <div className='space-y-4'>
        <h1 className='text-4xl font-bold tracking-tight'>AI Toolbox</h1>
        <p className='max-w-2xl text-lg text-muted-foreground'>
          A collection of AI-first utilities for creative, developer, and productivity workflows.
        </p>
      </div>

      {!hasKey ? (
        <Card className='mt-8 border-destructive/30 bg-destructive/10'>
          <CardContent className='flex items-start gap-3 py-4'>
            <div className='mt-1 h-2.5 w-2.5 rounded-full bg-destructive' />
            <div className='text-sm text-destructive-foreground'>
              <p className='font-medium'>Gemini API key not set.</p>
              <p>
                Open{' '}
                <Link to='/settings' className='font-medium text-destructive-foreground underline'>
                  Settings
                </Link>{' '}
                to add your key before using tools.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className='mt-12 grid gap-6 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'>
        {tools.map((tool) => (
          <Link key={tool.path} to={tool.path} className='group block h-full'>
            <Card className='flex h-full flex-col justify-between transition hover:-translate-y-1 hover:shadow-lg'>
              <CardHeader>
                <CardTitle>{tool.name}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardFooter className='pt-0'>
                <span className='text-sm font-medium text-primary group-hover:underline'>Open tool</span>
              </CardFooter>
            </Card>
          </Link>
        ))}
        {externalLinks.map((tool) => (
          <a
            key={tool.path}
            href={tool.path}
            target={tool.target}
            rel='noreferrer'
            className='group block h-full'
          >
            <Card className='flex h-full flex-col justify-between transition hover:-translate-y-1 hover:shadow-lg'>
              <CardHeader>
                <CardTitle>{tool.name}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardFooter className='pt-0'>
                <span className='text-sm font-medium text-primary group-hover:underline'>Visit link</span>
              </CardFooter>
            </Card>
          </a>
        ))}
      </div>
    </div>
  )
}

function ToolPage({ tool }) {
  const Component = tool.component
  const layoutProps = tool.layout ?? {}

  return (
    <PageLayout
      title={tool.name}
      description={tool.description}
      actions={<SettingsButton />}
      {...layoutProps}
    >
      <Component />
    </PageLayout>
  )
}

function SettingsButton({ variant = 'outline' }) {
  return (
    <Button variant={variant} asChild className='gap-2'>
      <Link to='/settings' className='flex items-center gap-2'>
        <IconSettings size={18} />
        Edit config
      </Link>
    </Button>
  )
}

function AppFooter() {
  return (
    <footer className='border-t bg-background/95 py-6'>
      <div className='px-6 text-sm text-muted-foreground'>
        Built with the default Shadcn UI theme.
      </div>
    </footer>
  )
}

function AppRoutes({ hasKey }) {
  const toolRoutes = toolDefinitions.filter((tool) => tool.component)

  return (
    <Routes>
      <Route path='/' element={<HomePage hasKey={hasKey} />} />
      {toolRoutes.map((tool) => (
        <Route key={tool.path} path={tool.path} element={<ToolPage tool={tool} />} />
      ))}
      <Route
        path='/settings'
        element={
          <PageLayout title='Settings' description='Configure your Gemini API credentials.'>
            <Card className='shadow-sm'> 
              <CardContent className='space-y-10 pt-6'>
                <Settings />
              </CardContent>
            </Card>
          </PageLayout>
        }
      />
      <Route
        path='/about'
        element={
          <PageLayout title='About' description='Learn more about the AI Toolbox project.' actions={<SettingsButton />}>
            <Card className='shadow-sm'>
              <CardContent className='space-y-6 pt-6'>
                <About />
              </CardContent>
            </Card>
          </PageLayout>
        }
      />
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  )
}

export default function App() {
  const [hasKey, setHasKey] = useState(() => !!getApiKey())

  useEffect(() => {
    const onCfg = () => setHasKey(!!getApiKey())
    window.addEventListener('ai-toolbox:config-updated', onCfg)
    window.addEventListener('storage', onCfg)
    return () => {
      window.removeEventListener('ai-toolbox:config-updated', onCfg)
      window.removeEventListener('storage', onCfg)
    }
  }, [])

  return (
    <div className='flex min-h-screen flex-col bg-background text-foreground'>
      <AppHeader />
      <main className='flex-1'>
        <AppRoutes hasKey={hasKey} />
      </main>
      <AppFooter />
    </div>
  )
}
