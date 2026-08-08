import React from 'react'
import PresentNavigationOverlay from './PresentNavigationOverlay'
import { fireEvent, render, screen, act } from '@testing-library/react'

vi.useFakeTimers()

describe('PresentNavigationOverlay component', () => {
  test('simple render', () => {
    const dispatchMedia = vi.fn()
    const showInfo = vi.fn()
    render(
      <PresentNavigationOverlay
        dispatchMedia={dispatchMedia}
        onShowInfo={showInfo}
      />
    )

    expect(screen.getByLabelText('Previous image')).toBeInTheDocument()
    expect(screen.getByLabelText('Next image')).toBeInTheDocument()
    expect(screen.getByLabelText('Exit presentation mode')).toBeInTheDocument()
    expect(screen.getByLabelText('Open photo details')).toBeInTheDocument()
    expect(screen.getByLabelText('Exit presentation mode')).toHaveClass('hide')
    expect(screen.getByLabelText('Open photo details')).toHaveClass('hide')
  })

  test('click buttons', () => {
    const dispatchMedia = vi.fn()
    render(<PresentNavigationOverlay dispatchMedia={dispatchMedia} />)

    expect(dispatchMedia).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Next image'))
    expect(dispatchMedia).lastCalledWith({ type: 'nextImage' })

    fireEvent.click(screen.getByLabelText('Previous image'))
    expect(dispatchMedia).lastCalledWith({ type: 'previousImage' })
  })

  test('mouse move, show and hide', () => {
    const dispatchMedia = vi.fn()
    const { container } = render(
      <PresentNavigationOverlay
        dispatchMedia={dispatchMedia}
        onShowInfo={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Next image')).toHaveClass('hide')
    expect(screen.getByLabelText('Open photo details')).toHaveClass('hide')

    fireEvent.mouseMove(container.firstChild!)
    expect(screen.getByLabelText('Next image')).not.toHaveClass('hide')
    expect(screen.getByLabelText('Open photo details')).not.toHaveClass('hide')

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByLabelText('Next image')).toHaveClass('hide')
    expect(screen.getByLabelText('Open photo details')).toHaveClass('hide')
  })

  test('a light tap reveals controls and info uses the supplied callback', () => {
    const dispatchMedia = vi.fn()
    const showInfo = vi.fn()

    render(
      <PresentNavigationOverlay
        dispatchMedia={dispatchMedia}
        onShowInfo={showInfo}
      >
        {showControls => <button onClick={showControls}>Photo surface</button>}
      </PresentNavigationOverlay>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Photo surface' }))

    expect(screen.getByLabelText('Exit presentation mode')).not.toHaveClass(
      'hide'
    )
    expect(screen.getByLabelText('Open photo details')).not.toHaveClass('hide')

    fireEvent.click(screen.getByLabelText('Open photo details'))

    expect(showInfo).toHaveBeenCalledTimes(1)
    expect(dispatchMedia).not.toHaveBeenCalled()
  })
})
