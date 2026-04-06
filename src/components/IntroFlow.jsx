import { useState } from 'react';

function ProgressDots({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            i <= current ? 'bg-accent' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

const screens = [
  // Screen 1: Greeting
  {
    render: () => (
      <>
        <h1 className="text-5xl font-bold text-gray-900 font-logo italic">Welcome.</h1>
        <p className="text-base text-gray-400 mt-4 leading-relaxed">Your training journey starts here.</p>
      </>
    ),
    button: "Let's go",
  },

  // Screen 2: Problem
  {
    render: () => (
      <>
        <p className="text-sm text-gray-300 mb-6">Do you train hard...</p>
        <h1 className="text-4xl font-bold text-gray-900 font-logo italic">but never track it?</h1>
        <p className="text-base text-gray-400 mt-4 leading-relaxed">Most players train without knowing if they're actually improving.</p>
      </>
    ),
    button: "There's a better way",
  },

  // Screen 3: Solution
  {
    render: () => (
      <>
        <p className="text-sm text-gray-400 mb-3">The answer:</p>
        <h1 className="text-4xl font-bold text-accent font-logo italic">Intentional training.</h1>
        <p className="text-base text-gray-400 mt-4 leading-relaxed">Every session logged. Every stat tracked. Every weakness exposed.</p>
      </>
    ),
    button: 'How it works',
  },

  // Screen 4: App Reveal
  {
    render: () => (
      <>
        <p className="text-sm text-gray-400 mb-3">That's why we built</p>
        <h1 className="text-5xl text-accent font-logo italic" style={{ textShadow: '0 0 40px rgba(30,58,95,0.15)' }}>Composed</h1>
        <p className="text-base text-gray-400 mt-4 leading-relaxed">Your personal soccer training companion.</p>
      </>
    ),
    button: "See what's inside",
  },

  // Screen 5: Feature — Track
  {
    render: () => (
      <>
        <h1 className="text-3xl font-bold text-gray-900 font-logo italic">Log every session.</h1>
        <p className="text-base text-gray-400 mt-4 leading-relaxed max-w-xs">Shooting, passing, fitness, drills — all in one place. Watch your numbers climb.</p>
      </>
    ),
    button: 'What else?',
  },

  // Screen 6: Feature — AI
  {
    render: () => (
      <>
        <h1 className="text-3xl font-bold text-gray-900 font-logo italic leading-snug">AI-powered video analysis.</h1>
        <p className="text-base text-gray-400 mt-4 leading-relaxed max-w-xs">Record your session. Get instant feedback on technique, accuracy, and patterns.</p>
      </>
    ),
    button: 'One more thing',
  },

  // Screen 7: CTA
  {
    render: () => (
      <>
        <h1 className="text-5xl text-accent font-logo italic">stay composed</h1>
        <p className="text-base text-gray-400 mt-4 leading-relaxed">Train smarter. See your progress. Get better every day.</p>
      </>
    ),
    button: 'Get Started',
    primary: true,
  },
];

export function IntroFlow({ onComplete }) {
  const [step, setStep] = useState(0);

  const current = screens[step];
  const isLast = step === screens.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-6">
      {/* Dots */}
      <div className="pt-12 pb-4">
        <ProgressDots current={step} total={screens.length} />
      </div>

      {/* Content */}
      <div
        key={step}
        className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full"
        style={{ animation: 'fadeSlideUp 0.35s ease-out' }}
      >
        {current.render()}
      </div>

      {/* Button */}
      <div className="pb-12 pt-6 max-w-sm mx-auto w-full">
        <button
          onClick={handleNext}
          className={`w-full py-4 rounded-xl font-semibold text-sm transition-all ${
            current.primary
              ? 'bg-accent text-white hover:bg-accent-light'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {current.button}
        </button>
      </div>
    </div>
  );
}
