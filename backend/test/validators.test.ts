import type { Request } from 'express'
import { validationResult, type ValidationChain } from 'express-validator'
import { describe, expect, it } from 'vitest'
import {
  forgotPasswordValidation,
  registerWithInviteCodeValidation,
  bootstrapAdminSetupValidation,
  userCreateValidation,
  userUpdateValidation,
} from '../src/utils/validators'

async function getValidationErrors(chains: ValidationChain[], body: Record<string, unknown>) {
  const req = { body, query: {}, params: {} } as Request

  for (const chain of chains) {
    await chain.run(req)
  }

  return validationResult(req).array()
}

describe('validators', () => {
  it('accetta la creazione utente senza telefono', async () => {
    const errors = await getValidationErrors(userCreateValidation, {
      email: 'utente@example.com',
      firstName: 'Mario',
      lastName: 'Rossi',
      phone: '',
      role: 'STANDARD',
      sendInvite: true,
      inviteBaseUrl: 'http://localhost:5473',
      isActive: true,
    })

    expect(errors).toEqual([])
  })

  it('accetta la creazione utente con invito senza inviteBaseUrl esplicito', async () => {
    const errors = await getValidationErrors(userCreateValidation, {
      email: 'utente2@example.com',
      firstName: 'Mario',
      lastName: 'Rossi',
      role: 'STANDARD',
      sendInvite: true,
      isActive: true,
    })

    expect(errors).toEqual([])
  })

  it('accetta l’update utente con telefono vuoto', async () => {
    const errors = await getValidationErrors(userUpdateValidation, {
      phone: '',
    })

    expect(errors).toEqual([])
  })

  it('accetta il bootstrap admin senza telefono', async () => {
    const errors = await getValidationErrors(bootstrapAdminSetupValidation, {
      email: 'admin@mindcalm.com',
      firstName: 'Admin',
      lastName: 'Mindcalm',
      phone: '',
      password: 'Password123',
    })

    expect(errors).toEqual([])
  })

  it('accetta il reset password senza resetBaseUrl esplicito', async () => {
    const errors = await getValidationErrors(forgotPasswordValidation, {
      email: 'utente@example.com',
    })

    expect(errors).toEqual([])
  })

  it('accetta la registrazione con codice senza verificationBaseUrl esplicito', async () => {
    const errors = await getValidationErrors(registerWithInviteCodeValidation, {
      code: 'ABC1234',
      email: 'utente@example.com',
      firstName: 'Mario',
      lastName: 'Rossi',
      phone: '+39 333 123 4567',
      password: 'Password123',
    })

    expect(errors).toEqual([])
  })

  it('accetta la registrazione con consensi comunicazione espliciti', async () => {
    const errors = await getValidationErrors(registerWithInviteCodeValidation, {
      code: 'ABC1234',
      email: 'utente@example.com',
      firstName: 'Mario',
      lastName: 'Rossi',
      phone: '+39 333 123 4567',
      password: 'Password123',
      consents: [
        {
          formulaId: '123e4567-e89b-12d3-a456-426614174000',
          value: 'YES',
        },
      ],
    })

    expect(errors).toEqual([])
  })
})
