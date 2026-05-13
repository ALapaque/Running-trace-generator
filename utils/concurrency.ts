/**
 * Limiteur de concurrence simple sans dépendance externe.
 * Utilisé pour Overpass (max 3 requêtes parallèles).
 */

export function createLimiter(max: number) {
  let active = 0
  const queue: Array<() => void> = []

  function next(): void {
    if (active >= max) return
    const fn = queue.shift()
    if (!fn) return
    active++
    fn()
  }

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--
            next()
          })
      }
      queue.push(start)
      next()
    })
  }
}
