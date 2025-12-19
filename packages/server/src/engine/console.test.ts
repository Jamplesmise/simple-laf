import { describe, it, expect, beforeEach } from 'vitest'
import { FunctionConsole } from './console.js'

describe('FunctionConsole', () => {
  let console: FunctionConsole

  beforeEach(() => {
    console = new FunctionConsole()
  })

  describe('log', () => {
    it('should capture string log', () => {
      console.log('hello world')
      expect(console.getLogs()).toEqual(['hello world'])
    })

    it('should capture multiple arguments', () => {
      console.log('hello', 'world', 123)
      expect(console.getLogs()).toEqual(['hello world 123'])
    })

    it('should capture object as JSON', () => {
      console.log({ name: 'test', value: 42 })
      expect(console.getLogs()).toEqual(['{\n  "name": "test",\n  "value": 42\n}'])
    })

    it('should capture null and undefined', () => {
      console.log(null, undefined)
      expect(console.getLogs()).toEqual(['null undefined'])
    })
  })

  describe('info', () => {
    it('should add [INFO] prefix', () => {
      console.info('message')
      expect(console.getLogs()).toEqual(['[INFO] message'])
    })
  })

  describe('warn', () => {
    it('should add [WARN] prefix', () => {
      console.warn('warning message')
      expect(console.getLogs()).toEqual(['[WARN] warning message'])
    })
  })

  describe('error', () => {
    it('should add [ERROR] prefix', () => {
      console.error('error message')
      expect(console.getLogs()).toEqual(['[ERROR] error message'])
    })
  })

  describe('debug', () => {
    it('should add [DEBUG] prefix', () => {
      console.debug('debug info')
      expect(console.getLogs()).toEqual(['[DEBUG] debug info'])
    })
  })

  describe('getLogs', () => {
    it('should return copy of logs', () => {
      console.log('test')
      const logs = console.getLogs()
      logs.push('modified')
      expect(console.getLogs()).toEqual(['test'])
    })
  })

  describe('clear', () => {
    it('should clear all logs', () => {
      console.log('one')
      console.log('two')
      console.clear()
      expect(console.getLogs()).toEqual([])
    })
  })

  describe('multiple logs', () => {
    it('should capture logs in order', () => {
      console.log('first')
      console.info('second')
      console.warn('third')
      console.error('fourth')

      expect(console.getLogs()).toEqual([
        'first',
        '[INFO] second',
        '[WARN] third',
        '[ERROR] fourth',
      ])
    })
  })
})
