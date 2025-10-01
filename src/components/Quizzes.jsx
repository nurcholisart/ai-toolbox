import React, { useEffect, useMemo, useState } from 'react'

const quizCatalog = [
  {
    id: 'agentlabs-orientation',
    title: 'AgentLabs Orientation',
    description: 'Check how well you know the AgentLabs platform.',
    questions: [
      {
        prompt: 'AgentLabs is the evolution of which previous platform?',
        options: ['Qiscus Labs', 'Dialogflow', 'Robolabs', 'Omnichannel Chat'],
        answerIndex: 2,
        hint: 'The introduction mentions the name of the predecessor platform.',
      },
      {
        prompt:
          'What makes an AgentLabs AI Agent fundamentally different from a conventional scripted chatbot?',
        options: [
          'It only replies using a fixed script',
          'It understands context and can take proactive action',
          'It cannot integrate with external systems',
          'It needs human supervision 24/7',
        ],
        answerIndex: 1,
        hint: 'Focus on how AgentLabs describes proactive behaviour.',
      },
      {
        prompt: 'Which option is NOT listed as a way to start a project in AgentLabs?',
        options: [
          'Integrating with Dialogflow',
          'Building an LLM-based agent',
          'Using a custom bot engine',
          'Importing templates from social media',
        ],
        answerIndex: 3,
        hint: 'Only three official starting methods are documented.',
      },
      {
        prompt:
          'Which feature acts as the “brain” of an AI Agent and can be trained with multiple information sources?',
        options: ['Conversation Flow', 'AI Persona', 'Knowledge Base', 'Smart Handover'],
        answerIndex: 2,
        hint: 'Look for the feature that aggregates company knowledge.',
      },
      {
        prompt: 'How does AgentLabs define the personality of an AI Agent so it matches a brand?',
        options: [
          'By using Monitoring and Analytics',
          'By configuring AI Persona & Character',
          'By connecting to an external API',
          'By training it with Excel files',
        ],
        answerIndex: 1,
        hint: 'Check the feature that sets tone, name, and interaction rules.',
      },
      {
        prompt: 'Which feature lets an AI Agent interpret user intent automatically?',
        options: ['External API', 'Knowledge Base', 'Conversation Flow', 'Smart Handover Agent'],
        answerIndex: 2,
        hint: 'It is the feature dedicated to intent recognition and flow control.',
      },
      {
        prompt: 'What happens when an AgentLabs AI Agent detects a conversation that needs human help?',
        options: [
          'It ends the conversation',
          'It shows an error message',
          'It hands the chat to a human agent (Smart Handover)',
          'It asks the user to repeat the question',
        ],
        answerIndex: 2,
        hint: 'Smart Handover Agent is designed for this exact scenario.',
      },
      {
        prompt:
          'Which feature enables an AI Agent to exchange data with other systems in real time?',
        options: ['AI Persona', 'Knowledge Base', 'Monitoring', 'External API integrations'],
        answerIndex: 3,
        hint: 'Think about booking reservations or tracking deliveries via API.',
      },
      {
        prompt: 'Which information source is NOT mentioned as Knowledge Base training material?',
        options: ['PDF documents', 'WordPress articles', 'YouTube videos', 'Excel spreadsheets'],
        answerIndex: 2,
        hint: 'Review the list of supported document types.',
      },
      {
        prompt: 'What is the main purpose of the Monitoring and Analytics feature?',
        options: [
          'Design an agent personality',
          'Monitor agent activity for improvements',
          'Build a conversation flow from scratch',
          'Chat live with the AI agent',
        ],
        answerIndex: 1,
        hint: 'It provides insights to improve agent performance.',
      },
    ],
  },
]

const baseFont = {
  fontFamily:
    '\'Inter\', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
}

function computeScore(questions, answers) {
  if (!questions?.length) return 0
  return questions.reduce((total, question, index) => {
    if (answers[index] === question.answerIndex) {
      return total + 1
    }
    return total
  }, 0)
}

export default function Quizzes() {
  const initialQuizId = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const requested = params.get('quiz')
    if (quizCatalog.some((quiz) => quiz.id === requested)) {
      return requested
    }
    return quizCatalog[0]?.id ?? null
  }, [])

  const [selectedQuizId, setSelectedQuizId] = useState(initialQuizId)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState(() => {
    const quiz = quizCatalog.find((item) => item.id === initialQuizId)
    return quiz ? Array(quiz.questions.length).fill(null) : []
  })
  const [isComplete, setIsComplete] = useState(false)
  const [isHintVisible, setIsHintVisible] = useState(false)
  const [isEmbedded, setIsEmbedded] = useState(false)

  const selectedQuiz = useMemo(
    () => quizCatalog.find((quiz) => quiz.id === selectedQuizId) ?? null,
    [selectedQuizId],
  )

  useEffect(() => {
    const detectEmbed = () => {
      try {
        return window.self !== window.top
      } catch (error) {
        return true
      }
    }
    setIsEmbedded(detectEmbed())
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (selectedQuizId) {
      params.set('quiz', selectedQuizId)
      const nextUrl = `${window.location.pathname}?${params.toString()}`
      window.history.replaceState({}, '', nextUrl)
    }
  }, [selectedQuizId])

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search)
      const requested = params.get('quiz')
      if (requested && quizCatalog.some((quiz) => quiz.id === requested)) {
        setSelectedQuizId(requested)
      }
    }
    window.addEventListener('popstate', onPopState, { passive: true })
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!selectedQuiz) return
    setCurrentQuestionIndex(0)
    setAnswers(Array(selectedQuiz.questions.length).fill(null))
    setIsComplete(false)
    setIsHintVisible(false)
  }, [selectedQuiz])

  const handleOptionSelect = (questionIndex, optionIndex) => {
    if (isComplete) return
    if (questionIndex !== currentQuestionIndex) return
    setAnswers((prev) => {
      const next = [...prev]
      next[questionIndex] = optionIndex
      return next
    })
  }

  const handleNext = () => {
    if (!selectedQuiz) return
    if (answers[currentQuestionIndex] === null) return
    if (currentQuestionIndex === selectedQuiz.questions.length - 1) {
      setIsComplete(true)
      return
    }
    setCurrentQuestionIndex((prev) => prev + 1)
    setIsHintVisible(false)
  }

  const handleRestart = () => {
    if (!selectedQuiz) return
    setCurrentQuestionIndex(0)
    setAnswers(Array(selectedQuiz.questions.length).fill(null))
    setIsComplete(false)
    setIsHintVisible(false)
  }

  const handleQuizChange = (event) => {
    if (isEmbedded) return
    setSelectedQuizId(event.target.value)
  }

  const score = useMemo(() => {
    if (!selectedQuiz || !isComplete) return 0
    return computeScore(selectedQuiz.questions, answers)
  }, [selectedQuiz, answers, isComplete])

  const quizLength = selectedQuiz?.questions.length ?? 0
  const progressLabel = isComplete
    ? 'Quiz complete'
    : `${currentQuestionIndex + 1} / ${quizLength}`

  const canAdvance = useMemo(() => {
    if (!selectedQuiz) return false
    if (isComplete) return false
    return answers[currentQuestionIndex] !== null
  }, [answers, currentQuestionIndex, isComplete, selectedQuiz])

  if (!selectedQuiz) {
    return (
      <div className="min-h-screen bg-white text-gray-900" style={baseFont}>
        <main className="mx-auto max-w-4xl px-4 py-16">
          <h1 className="text-3xl font-semibold tracking-tight">Quizzes</h1>
          <p className="mt-4 text-base text-gray-600">
            There are no quizzes available yet. Add a quiz definition to the catalog to get started.
          </p>
        </main>
      </div>
    )
  }

  const renderQuestionCard = (question, index) => {
    const selectedOptionIndex = answers[index]
    const isCurrent = index === currentQuestionIndex
    const isAnswered = selectedOptionIndex !== null
    const isCorrect = selectedOptionIndex === question.answerIndex
    const showStatus = isComplete && isAnswered
    const statusLabel = showStatus ? (isCorrect ? 'Correct' : 'Incorrect') : ''
    const cardBorder = isComplete
      ? isCorrect
        ? 'border-black'
        : 'border-gray-300'
      : 'border-gray-300'
    const cardBackground = isComplete && isCorrect ? 'bg-gray-100' : 'bg-white'

    return (
      <article
        key={question.prompt}
        className={`rounded-xl ${cardBorder} ${cardBackground} border p-6 transition-colors`}
        aria-live="polite"
      >
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold leading-tight text-gray-900">
            {index + 1}. {question.prompt}
          </h2>
          {statusLabel ? (
            <span className="text-sm font-medium uppercase tracking-wide text-gray-600">{statusLabel}</span>
          ) : null}
        </header>
        <div className="mt-4 space-y-3">
          {question.options.map((option, optionIndex) => {
            const isSelected = selectedOptionIndex === optionIndex
            const isCorrectOption = question.answerIndex === optionIndex
            const baseClasses = 'flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left transition-colors'
            let optionClasses = `${baseClasses} border-gray-300 bg-white`

            if (!isComplete && isCurrent && isSelected) {
              optionClasses = `${baseClasses} border-black bg-gray-100`
            }

            if (isComplete) {
              if (isCorrectOption) {
                optionClasses = `${baseClasses} border-black bg-gray-100`
              } else if (isSelected) {
                optionClasses = `${baseClasses} border-gray-300 bg-white`
              }
            }

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleOptionSelect(index, optionIndex)}
                className={optionClasses}
                disabled={isComplete || !isCurrent}
              >
                <span className="flex-1 text-left text-base text-gray-900">{option}</span>
                {isComplete && isSelected ? (
                  <span className="text-sm text-gray-600">Your answer</span>
                ) : null}
                {isComplete && isCorrectOption ? (
                  <span className="text-sm text-gray-600">Correct answer</span>
                ) : null}
                {!isComplete && isCurrent && isSelected ? (
                  <span className="text-sm text-gray-600">Selected</span>
                ) : null}
              </button>
            )
          })}
        </div>
        {isComplete && !isCorrect ? (
          <p className="mt-3 text-sm text-gray-600">
            Correct answer: {question.options[question.answerIndex]}
          </p>
        ) : null}
        {!isComplete && isCurrent && isHintVisible ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-400 bg-gray-50 p-4 text-sm text-gray-700">
            {question.hint}
          </div>
        ) : null}
      </article>
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-900" style={baseFont}>
      <div className={`${isEmbedded ? 'px-4 py-8' : 'mx-auto max-w-5xl px-6 py-16'}`}>
        {!isEmbedded ? (
          <header className="mb-12 space-y-4">
            <nav className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-lg border border-gray-900 bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100"
              >
                Back to tools
              </a>
              <a
                href="/settings"
                className="inline-flex items-center justify-center rounded-lg border border-gray-900 bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900"
              >
                Edit config
              </a>
            </nav>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Quizzes</h1>
                <p className="mt-2 max-w-2xl text-base leading-relaxed text-gray-600">
                  Build and share interactive quizzes for your knowledge base. Select a quiz, walk through the questions one at a
                  time, and embed the experience anywhere you can place an iframe.
                </p>
              </div>
              <div className="flex flex-col gap-1 text-sm text-gray-600">
                <span className="font-medium text-gray-800">Embed tips</span>
                <span>Use /quizzes?quiz=&lt;id&gt; inside your iframe.</span>
                <span>The layout expands to the full iframe width automatically.</span>
              </div>
            </div>
          </header>
        ) : null}

        <main className="space-y-8">
          <section aria-label="Quiz selection" className="flex flex-col gap-4">
            {isEmbedded ? (
              <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Quiz selection is hidden when the experience is embedded. Pass a quiz ID through the URL to choose a course.
              </p>
            ) : (
              <>
                <label className="text-sm font-medium uppercase tracking-wide text-gray-600" htmlFor="quiz-selector">
                  Choose a quiz
                </label>
                <select
                  id="quiz-selector"
                  value={selectedQuizId}
                  onChange={handleQuizChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-black focus:outline-none"
                >
                  {quizCatalog.map((quiz) => (
                    <option key={quiz.id} value={quiz.id} className="text-gray-900">
                      {quiz.title}
                    </option>
                  ))}
                </select>
              </>
            )}
            <p className="text-sm text-gray-600">{selectedQuiz.description}</p>
          </section>

          <section aria-live="polite" className="space-y-6">
            {!isComplete ? (
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span className="font-semibold text-gray-800">{progressLabel}</span>
                <button
                  type="button"
                  onClick={() => setIsHintVisible((prev) => !prev)}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400"
                >
                  {isHintVisible ? 'Hide hint' : 'Show hint'}
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                You answered {score} out of {quizLength} questions correctly.
              </div>
            )}

            {isComplete
              ? selectedQuiz.questions.map((question, index) => renderQuestionCard(question, index))
              : renderQuestionCard(selectedQuiz.questions[currentQuestionIndex], currentQuestionIndex)}
          </section>

          <section className="flex flex-col gap-4 border-t border-gray-200 pt-6">
            {!isComplete ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setIsHintVisible((prev) => !prev)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 sm:hidden"
                >
                  {isHintVisible ? 'Hide hint' : 'Show hint'}
                </button>
                <div className="text-sm text-gray-600">
                  Answer every question to unlock the summary.
                </div>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canAdvance}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-900 bg-black px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-500"
                >
                  {currentQuestionIndex === quizLength - 1 ? 'Submit quiz' : 'Next question'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-medium text-gray-700">Ready for another round?</div>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-900 bg-black px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900"
                >
                  Restart quiz
                </button>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
