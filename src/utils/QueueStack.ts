
interface Handler<A> {
  (item: A): Promise<any>
}

export default <A>(items: A[], concurrent: number, handler: Handler<A>,) => {
  concurrent = concurrent > items.length ? items.length : concurrent

  return new Promise((resolve, reject) => {
    const queue: Promise<any>[] = []

    const next = (index: number) => {
      if (items.length === 0) {
        return
      }

      const item = items.pop()!
      queue[index] = handler(item).then(() => next(index)).catch(reject)
    }

    for (let i = 0; i < concurrent; i++) {
      next(i)
    }

    Promise.all(queue).then(resolve).catch(reject)
  })
}
