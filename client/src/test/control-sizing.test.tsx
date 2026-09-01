import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PasswordField } from '../components/auth/PasswordField'
import { ProgramActionsMenu } from '../components/programs/ProgramActionsMenu'
import { failForKnownBaselineDefect } from './expected-failure'

describe('compact control sizing', () => {
  it('keeps the password visibility control at the 44px minimum', () => {
    render(
      <PasswordField
        id="password"
        label="Password"
        value=""
        onChange={vi.fn()}
      />,
    )

    const toggle = screen.getByRole('button', { name: 'Show password' })

    expect(toggle).toHaveClass('min-h-11', 'min-w-11')
  })

  it.fails('keeps every standalone program menu action at least 44px high', async () => {
    await failForKnownBaselineDefect(async () => {
      render(
        <ProgramActionsMenu
          programName="Strength Base"
          isOpen
          onToggle={vi.fn()}
          onCopy={vi.fn()}
          onRename={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      await screen.findByRole('menu', { name: 'Strength Base actions' })

      const items = screen.queryAllByRole('menuitem')
      if (items.length !== 3 || items.some((item, index) => item.textContent?.trim() !== ['Copy', 'Rename', 'Delete'][index])) {
        return
      }

      return items.every((item) => item.classList.contains('min-h-11'))
    }, 'program menu actions do not use the 44px minimum-height contract')
  })
})
