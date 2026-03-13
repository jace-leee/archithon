import type { Step } from '../types';

interface StepWizardProps {
  currentStep: Step;
  completedSteps: Set<number>;
  onStepClick: (step: Step) => void;
}

const steps: { num: Step; label: string }[] = [
  { num: 1, label: '공간 스캔' },
  { num: 2, label: '가구 스캔' },
  { num: 3, label: 'AI 배치' },
  { num: 4, label: '3D 시각화' },
  { num: 5, label: '이사 견적' },
];

export default function StepWizard({ currentStep, completedSteps, onStepClick }: StepWizardProps) {
  return (
    <div className="flex items-center justify-center w-full px-4 py-6">
      {steps.map((step, index) => {
        const isActive = step.num === currentStep;
        const isCompleted = completedSteps.has(step.num);
        const isClickable = isCompleted || step.num <= currentStep;

        return (
          <div key={step.num} className="flex items-center">
            <div
              className={`flex flex-col items-center cursor-pointer group ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              onClick={() => isClickable && onStepClick(step.num)}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200
                  ${isActive ? 'bg-blue-500 text-white ring-4 ring-blue-500/30 scale-110' : ''}
                  ${isCompleted && !isActive ? 'bg-green-500 text-white' : ''}
                  ${!isActive && !isCompleted ? 'bg-gray-700 text-gray-400' : ''}
                  ${isClickable ? 'group-hover:scale-105' : ''}
                `}
              >
                {isCompleted && !isActive ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.num
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium whitespace-nowrap
                  ${isActive ? 'text-blue-400' : ''}
                  ${isCompleted && !isActive ? 'text-green-400' : ''}
                  ${!isActive && !isCompleted ? 'text-gray-500' : ''}
                `}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-2 mb-5 transition-colors duration-300
                  ${completedSteps.has(step.num) ? 'bg-green-500' : 'bg-gray-700'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
