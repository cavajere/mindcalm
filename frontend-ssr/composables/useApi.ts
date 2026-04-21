export function useApi<T>(path: string, opts: Parameters<typeof useFetch<T>>[1] = {}) {
  const config = useRuntimeConfig()
  const headers: Record<string, string> = {}

  if (import.meta.server && config.ssrInternalToken) {
    headers['x-internal-ssr-token'] = String(config.ssrInternalToken)
  }

  return useFetch<T>(path, {
    baseURL: config.public.apiBase,
    ...opts,
    headers: {
      ...headers,
      ...(opts.headers as Record<string, string> | undefined),
    },
  })
}
