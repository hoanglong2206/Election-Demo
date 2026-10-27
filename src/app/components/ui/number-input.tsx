import * as React from 'react'
import { ChevronUp, ChevronDown, Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'prefix'> {
  value: string | number
  onChange?: (value: string) => void
  onValueChange?: (numValue: number) => void
  min?: number
  max?: number
  step?: number
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  stepperType?: 'chevrons' | 'buttons' | 'none'
  sizeVariant?: 'sm' | 'md' | 'lg'
  containerClassName?: string
}

function countDecimals(val: number): number {
  if (Math.floor(val) === val) return 0
  const str = val.toString()
  if (str.indexOf('.') !== -1) {
    return str.split('.')[1].length
  }
  return 0
}

function roundToStep(val: number, step: number): number {
  const decimals = Math.max(countDecimals(val), countDecimals(step))
  return parseFloat(val.toFixed(decimals))
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      containerClassName,
      value,
      onChange,
      onValueChange,
      min = -Infinity,
      max = Infinity,
      step = 1,
      prefix,
      suffix,
      stepperType = 'chevrons',
      sizeVariant = 'sm',
      disabled = false,
      placeholder,
      id,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null)

    // Merge refs
    React.useImperativeHandle(ref, () => inputRef.current!)

    const numValue = React.useMemo(() => {
      if (value === '' || value === undefined || value === null) return NaN
      return typeof value === 'number' ? value : parseFloat(value)
    }, [value])

    const handleStep = (direction: 'up' | 'down') => {
      if (disabled) return
      let next: number
      if (isNaN(numValue)) {
        next = min !== -Infinity ? min : 0
      } else {
        const delta = direction === 'up' ? step : -step
        next = roundToStep(numValue + delta, step)
      }

      if (min !== undefined && next < min) next = min
      if (max !== undefined && next > max) next = max

      const stringVal = String(next)
      onChange?.(stringVal)
      onValueChange?.(next)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      onChange?.(raw)
      const parsed = parseFloat(raw)
      if (!isNaN(parsed)) {
        onValueChange?.(parsed)
      }
    }

    const sizeStyles = {
      sm: 'h-7 text-xs',
      md: 'h-8 text-xs',
      lg: 'h-9 text-sm',
    }[sizeVariant]

    const buttonSizeStyles = {
      sm: 'w-6 h-6',
      md: 'w-7 h-7',
      lg: 'w-8 h-8',
    }[sizeVariant]

    return (
      <div
        className={cn(
          'relative flex items-center rounded-lg bg-black/40 border border-white/15 transition-all duration-150',
          'hover:border-white/25 focus-within:border-violet-500/60 focus-within:ring-1 focus-within:ring-violet-500/30',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          containerClassName
        )}
      >
        {/* Buttons Stepper: Left (-) */}
        {stepperType === 'buttons' && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => handleStep('down')}
            disabled={disabled || (!isNaN(numValue) && numValue <= min)}
            className={cn(
              'flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors rounded-l-md border-r border-white/10 shrink-0 select-none disabled:opacity-30 disabled:hover:bg-transparent',
              buttonSizeStyles
            )}
            title="Giảm"
          >
            <Minus className="w-3 h-3" />
          </button>
        )}

        {/* Optional Prefix */}
        {prefix && (
          <div className="pl-2.5 pr-1 text-white/40 text-[11px] font-mono select-none flex items-center shrink-0">
            {prefix}
          </div>
        )}

        {/* Input */}
        <input
          {...props}
          id={id}
          ref={inputRef}
          type="number"
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              handleStep('up')
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              handleStep('down')
            }
            props.onKeyDown?.(e)
          }}
          className={cn(
            'w-full bg-transparent text-white font-mono placeholder:text-white/25 focus:outline-none px-2',
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            sizeStyles,
            className
          )}
        />

        {/* Optional Suffix */}
        {suffix && (
          <div className="pr-2 pl-1 text-white/40 text-[10.5px] font-mono select-none flex items-center shrink-0">
            {suffix}
          </div>
        )}

        {/* Buttons Stepper: Right (+) */}
        {stepperType === 'buttons' && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => handleStep('up')}
            disabled={disabled || (!isNaN(numValue) && numValue >= max)}
            className={cn(
              'flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors rounded-r-md border-l border-white/10 shrink-0 select-none disabled:opacity-30 disabled:hover:bg-transparent',
              buttonSizeStyles
            )}
            title="Tăng"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}

        {/* Chevrons Stepper: Vertical Up/Down Controls on Right */}
        {stepperType === 'chevrons' && (
          <div className="flex flex-col h-full border-l border-white/10 rounded-r-md overflow-hidden shrink-0 select-none divide-y divide-white/[0.08]">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => handleStep('up')}
              disabled={disabled || (!isNaN(numValue) && numValue >= max)}
              className="flex-1 px-1.5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/15 active:bg-violet-600/30 transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
              title="Tăng"
            >
              <ChevronUp className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => handleStep('down')}
              disabled={disabled || (!isNaN(numValue) && numValue <= min)}
              className="flex-1 px-1.5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/15 active:bg-violet-600/30 transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
              title="Giảm"
            >
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </div>
    )
  }
)

NumberInput.displayName = 'NumberInput'
