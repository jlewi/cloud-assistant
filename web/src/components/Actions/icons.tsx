export const PlayIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3.24182 2.32181C3.3919 2.23132 3.5784 2.22601 3.73338 2.30781L12.7334 7.05781C12.8974 7.14436 13 7.31457 13 7.5C13 7.68543 12.8974 7.85564 12.7334 7.94219L3.73338 12.6922C3.5784 12.774 3.3919 12.7687 3.24182 12.6782C3.09175 12.5877 3 12.4252 3 12.25V2.75C3 2.57476 3.09175 2.4123 3.24182 2.32181ZM4 3.57925V11.4207L11.4338 7.5L4 3.57925Z"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      stroke="currentColor"
      strokeWidth="0.5"
    />
  </svg>
)

export const SpinnerIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7.5 1.5C4.5 1.5 2 4 2 7C2 8.9 3 10.5 4.5 11.5L4 12.5C2 11.5 1 9.2 1 7C1 3.5 4 0.5 7.5 0.5C11 0.5 14 3.5 14 7C14 9.2 13 11.5 11 12.5L10.5 11.5C12 10.5 13 8.9 13 7C13 4 10.5 1.5 7.5 1.5Z"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
    />
  </svg>
)

export const SuccessIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
      fill="#22c55e"
      fillRule="evenodd"
      clipRule="evenodd"
    />
  </svg>
)

interface ErrorIconProps {
  exitCode: number
}

export const ErrorIcon = ({ exitCode }: ErrorIconProps) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="20" fill="#ef4444" fillOpacity="0.3" />
    <text
      x="50%"
      y="50%"
      dominantBaseline="middle"
      textAnchor="middle"
      fill="#ef4444"
      fontSize="10"
      fontWeight="bold"
    >
      {exitCode}
    </text>
  </svg>
)
