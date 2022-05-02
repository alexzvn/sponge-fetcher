interface Handler<A> {
  (item: A): Promise<any>
}


const createQueue = <T>() => {
  return {
    cb: () => {},
    queue: {} as {[key: string]: T },

    put (key: string, item: T) {
      this.queue[key] = item
    },

    remove (key: string) {
      delete this.queue[key]
      this.cb()
    },

    watch(cb: () => any) {
      this.cb = cb as any
    },

    get length() {
      return Object.keys(this.queue).length
    }
  }
}

const ranId = () => Math.random().toString(36).substring(2, 15)

export default <A>(items: A[], concurrent: number, handler: Handler<A>,) => {
  concurrent = concurrent > items.length ? items.length : concurrent

  return new Promise((resolve, reject) => {
    const queue = createQueue()

    const handle = async () => {
      const id = ranId()
      const handling = handler(items.pop()!)

      queue.put(id, handling)

      await handling

      queue.remove(id)
    }

    for (let i = 0; i < concurrent; i++) {
      handle()
    }

    queue.watch(() => {
      if (queue.length === 0) {
        return resolve(true)
      }

      if (items.length === 0) {
        return
      }

      handle()
    })
  })
}
