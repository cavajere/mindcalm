export function useApi<T>(path: string, opts: Parameters<typeof useFetch<T>>[1] = {}) {
  const config = useRuntimeConfig()
  return useFetch<T>(path, {
    baseURL: config.public.apiBase,
    ...opts,
  })
}
