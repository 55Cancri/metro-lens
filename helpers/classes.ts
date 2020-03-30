// import { performance } from 'perf_hooks'
import performance from 'performance-now'

export class StopWatch {
  startTime = 0
  stopTime = 0
  running = false
  performance = performance

  currentTime = () =>
    this.performance ? this.performance.now() : new Date().getTime()

  start = () => {
    this.startTime = this.currentTime()
    this.running = true
  }

  stop = () => {
    this.stopTime = this.currentTime()
    this.running = false
  }

  getElapsedMilliseconds = () => {
    if (this.running) {
      this.stopTime = this.currentTime()
    }

    return this.stopTime - this.startTime
  }

  logElapsedMilliseconds = () => {
    if (this.running) {
      this.stopTime = this.currentTime()
    }

    const elapsedMilliseconds = this.stopTime - this.startTime

    console.log('Elapsed time (ms): ' + elapsedMilliseconds)
  }

  getElapsedSeconds = () => this.getElapsedMilliseconds() / 1000

  logElapsedSeconds = () => {
    const elapsedSeconds = this.getElapsedMilliseconds() / 1000
    console.log('Elapsed time (s): ' + elapsedSeconds.toFixed(1))
  }
}
