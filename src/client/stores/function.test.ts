import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFunctionStore, type CloudFunction } from './function'

// Mock API
vi.mock('../api/functions', () => ({
  functionApi: {
    list: vi.fn(),
    get: vi.fn(),
    getVersions: vi.fn(),
    getVersion: vi.fn(),
  },
}))

describe('function store', () => {
  const mockFunction: CloudFunction = {
    _id: 'func-1',
    name: 'testFunc',
    code: 'export default async function() { return "hello" }',
    compiled: 'compiled code',
    published: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  const mockFunction2: CloudFunction = {
    _id: 'func-2',
    name: 'testFunc2',
    code: 'export default async function() { return "world" }',
    compiled: 'compiled code 2',
    published: false,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  }

  beforeEach(() => {
    // 重置store状态
    useFunctionStore.setState({
      functions: [],
      current: null,
      openTabs: [],
      loading: false,
      lastPublishedCodes: {},
    })
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have empty initial state', () => {
      const state = useFunctionStore.getState()

      expect(state.functions).toEqual([])
      expect(state.current).toBeNull()
      expect(state.openTabs).toEqual([])
      expect(state.loading).toBe(false)
    })
  })

  describe('setFunctions', () => {
    it('should set functions list', () => {
      const { setFunctions } = useFunctionStore.getState()

      setFunctions([mockFunction, mockFunction2])

      const state = useFunctionStore.getState()
      expect(state.functions).toHaveLength(2)
      expect(state.functions[0].name).toBe('testFunc')
    })
  })

  describe('setCurrent', () => {
    it('should set current function', () => {
      const { setCurrent } = useFunctionStore.getState()

      setCurrent(mockFunction)

      const state = useFunctionStore.getState()
      expect(state.current).toEqual(mockFunction)
    })

    it('should set current to null', () => {
      const { setCurrent } = useFunctionStore.getState()

      setCurrent(mockFunction)
      setCurrent(null)

      const state = useFunctionStore.getState()
      expect(state.current).toBeNull()
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      const { setLoading } = useFunctionStore.getState()

      setLoading(true)
      expect(useFunctionStore.getState().loading).toBe(true)

      setLoading(false)
      expect(useFunctionStore.getState().loading).toBe(false)
    })
  })

  describe('updateCurrent', () => {
    it('should update current function fields', () => {
      useFunctionStore.setState({ current: mockFunction, openTabs: [mockFunction] })

      const { updateCurrent } = useFunctionStore.getState()

      updateCurrent({ code: 'updated code', published: false })

      const state = useFunctionStore.getState()
      expect(state.current?.code).toBe('updated code')
      expect(state.current?.published).toBe(false)
      // 原始字段保持不变
      expect(state.current?.name).toBe('testFunc')
    })

    it('should also update in openTabs', () => {
      useFunctionStore.setState({ current: mockFunction, openTabs: [mockFunction] })

      const { updateCurrent } = useFunctionStore.getState()

      updateCurrent({ code: 'new code' })

      const state = useFunctionStore.getState()
      expect(state.openTabs[0].code).toBe('new code')
    })

    it('should do nothing when current is null', () => {
      const { updateCurrent } = useFunctionStore.getState()

      updateCurrent({ code: 'test' })

      expect(useFunctionStore.getState().current).toBeNull()
    })
  })

  describe('tab management', () => {
    describe('openTab', () => {
      it('should add function to openTabs and set as current', () => {
        const { openTab } = useFunctionStore.getState()

        openTab(mockFunction)

        const state = useFunctionStore.getState()
        expect(state.openTabs).toHaveLength(1)
        expect(state.openTabs[0]).toEqual(mockFunction)
        expect(state.current).toEqual(mockFunction)
      })

      it('should not duplicate tab if already open', () => {
        const { openTab } = useFunctionStore.getState()

        openTab(mockFunction)
        openTab(mockFunction)

        const state = useFunctionStore.getState()
        expect(state.openTabs).toHaveLength(1)
      })

      it('should set as current even if already in tabs', () => {
        useFunctionStore.setState({ openTabs: [mockFunction, mockFunction2] })

        const { openTab } = useFunctionStore.getState()
        openTab(mockFunction)

        expect(useFunctionStore.getState().current).toEqual(mockFunction)
      })
    })

    describe('closeTab', () => {
      it('should remove function from openTabs', () => {
        useFunctionStore.setState({
          openTabs: [mockFunction, mockFunction2],
          current: mockFunction,
        })

        const { closeTab } = useFunctionStore.getState()
        closeTab(mockFunction2._id)

        const state = useFunctionStore.getState()
        expect(state.openTabs).toHaveLength(1)
        expect(state.openTabs[0]._id).toBe(mockFunction._id)
      })

      it('should switch to last tab when closing current', () => {
        useFunctionStore.setState({
          openTabs: [mockFunction, mockFunction2],
          current: mockFunction2,
        })

        const { closeTab } = useFunctionStore.getState()
        closeTab(mockFunction2._id)

        const state = useFunctionStore.getState()
        expect(state.current?._id).toBe(mockFunction._id)
      })

      it('should set current to null when closing last tab', () => {
        useFunctionStore.setState({
          openTabs: [mockFunction],
          current: mockFunction,
        })

        const { closeTab } = useFunctionStore.getState()
        closeTab(mockFunction._id)

        const state = useFunctionStore.getState()
        expect(state.openTabs).toHaveLength(0)
        expect(state.current).toBeNull()
      })
    })

    describe('closeOtherTabs', () => {
      it('should keep only specified tab', () => {
        useFunctionStore.setState({
          openTabs: [mockFunction, mockFunction2],
          current: mockFunction,
        })

        const { closeOtherTabs } = useFunctionStore.getState()
        closeOtherTabs(mockFunction._id)

        const state = useFunctionStore.getState()
        expect(state.openTabs).toHaveLength(1)
        expect(state.openTabs[0]._id).toBe(mockFunction._id)
      })
    })

    describe('closeAllTabs', () => {
      it('should close all tabs and clear current', () => {
        useFunctionStore.setState({
          openTabs: [mockFunction, mockFunction2],
          current: mockFunction,
        })

        const { closeAllTabs } = useFunctionStore.getState()
        closeAllTabs()

        const state = useFunctionStore.getState()
        expect(state.openTabs).toHaveLength(0)
        expect(state.current).toBeNull()
      })
    })
  })

  describe('hasUnpublishedChanges', () => {
    it('should return true when code differs from last published', () => {
      const modifiedFunc = { ...mockFunction, code: 'modified code' }
      useFunctionStore.setState({
        openTabs: [modifiedFunc],
        lastPublishedCodes: { [mockFunction._id]: 'original code' },
      })

      const { hasUnpublishedChanges } = useFunctionStore.getState()
      expect(hasUnpublishedChanges(mockFunction._id)).toBe(true)
    })

    it('should return false when code matches last published', () => {
      useFunctionStore.setState({
        openTabs: [mockFunction],
        lastPublishedCodes: { [mockFunction._id]: mockFunction.code },
      })

      const { hasUnpublishedChanges } = useFunctionStore.getState()
      expect(hasUnpublishedChanges(mockFunction._id)).toBe(false)
    })

    it('should return true when never published', () => {
      useFunctionStore.setState({
        openTabs: [mockFunction],
        lastPublishedCodes: {},
      })

      const { hasUnpublishedChanges } = useFunctionStore.getState()
      expect(hasUnpublishedChanges(mockFunction._id)).toBe(true)
    })

    it('should return false for non-existent tab', () => {
      const { hasUnpublishedChanges } = useFunctionStore.getState()
      expect(hasUnpublishedChanges('non-existent')).toBe(false)
    })
  })
})
