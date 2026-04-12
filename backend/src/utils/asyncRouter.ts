import { Router } from 'express'

type NextFunction = (error?: unknown) => void
type AsyncCapableHandler = (...args: any[]) => unknown

function getNextFunction(args: any[]): NextFunction | undefined {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    if (typeof args[index] === 'function') {
      return args[index] as NextFunction
    }
  }

  return undefined
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as PromiseLike<unknown>).then === 'function',
  )
}

export function asyncHandler<T extends AsyncCapableHandler>(handler: T): T {
  const wrappedHandler = function wrappedHandler(this: unknown, ...args: any[]) {
    const next = getNextFunction(args)

    try {
      const result = handler.apply(this, args)
      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch((error: unknown) => {
          if (next) {
            next(error)
            return
          }

          throw error
        })
      }

      return result
    } catch (error) {
      if (next) {
        next(error)
        return undefined
      }

      throw error
    }
  }

  Object.defineProperty(wrappedHandler, 'length', {
    configurable: true,
    value: handler.length,
  })

  return wrappedHandler as T
}

function wrapRouterArgument(argument: any): any {
  if (Array.isArray(argument)) {
    return argument.map((entry) => wrapRouterArgument(entry))
  }

  if (typeof argument === 'function') {
    return asyncHandler(argument as AsyncCapableHandler)
  }

  return argument
}

const ROUTER_METHODS = [
  'all',
  'delete',
  'get',
  'head',
  'options',
  'patch',
  'post',
  'put',
  'use',
  'param',
] as const

export function createAsyncRouter() {
  const router = Router()
  const mutableRouter = router as any

  for (const method of ROUTER_METHODS) {
    const original = mutableRouter[method].bind(router)

    mutableRouter[method] = ((...args: any[]) => {
      return original(...args.map((argument) => wrapRouterArgument(argument)))
    }) as any
  }

  return router
}
