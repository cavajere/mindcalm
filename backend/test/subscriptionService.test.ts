import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CampaignMatchMode,
  CampaignRecipientStatus,
  CampaignStatus,
} from '@prisma/client'
import {
  listCampaigns,
  sendCampaign,
} from '../src/services/subscriptionService'

const {
  prismaConsentFindMany,
  prismaCampaignCreate,
  prismaCampaignAudienceFilterCreateMany,
  prismaCampaignRecipientCreateMany,
  prismaCampaignRecipientUpdate,
  prismaCampaignRecipientGroupBy,
  prismaCampaignFindMany,
  prismaCampaignUpdate,
  prismaUnsubscribeTokenCreate,
  sendMail,
} = vi.hoisted(() => ({
  prismaConsentFindMany: vi.fn(),
  prismaCampaignCreate: vi.fn(),
  prismaCampaignAudienceFilterCreateMany: vi.fn(),
  prismaCampaignRecipientCreateMany: vi.fn(),
  prismaCampaignRecipientUpdate: vi.fn(),
  prismaCampaignRecipientGroupBy: vi.fn(),
  prismaCampaignFindMany: vi.fn(),
  prismaCampaignUpdate: vi.fn(),
  prismaUnsubscribeTokenCreate: vi.fn(),
  sendMail: vi.fn(),
}))

const txMock = {
  campaign: {
    create: prismaCampaignCreate,
  },
  campaignAudienceFilter: {
    createMany: prismaCampaignAudienceFilterCreateMany,
  },
  campaignRecipient: {
    createMany: prismaCampaignRecipientCreateMany,
  },
}

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return input(txMock)
      }

      return Promise.all(input as Promise<unknown>[])
    }),
    consent: {
      findMany: prismaConsentFindMany,
    },
    campaign: {
      findMany: prismaCampaignFindMany,
      update: prismaCampaignUpdate,
    },
    campaignRecipient: {
      update: prismaCampaignRecipientUpdate,
      groupBy: prismaCampaignRecipientGroupBy,
    },
    unsubscribeToken: {
      create: prismaUnsubscribeTokenCreate,
    },
  },
}))

vi.mock('../src/services/cryptoService', () => ({
  generateRandomToken: vi.fn(() => 'raw-unsubscribe-token'),
  hashToken: vi.fn(() => 'hashed-unsubscribe-token'),
}))

vi.mock('../src/services/smtpService', () => ({
  sendMail,
}))

describe('subscriptionService', () => {
  beforeEach(() => {
    prismaConsentFindMany.mockReset()
    prismaCampaignCreate.mockReset()
    prismaCampaignAudienceFilterCreateMany.mockReset()
    prismaCampaignRecipientCreateMany.mockReset()
    prismaCampaignRecipientUpdate.mockReset()
    prismaCampaignRecipientGroupBy.mockReset()
    prismaCampaignFindMany.mockReset()
    prismaCampaignUpdate.mockReset()
    prismaUnsubscribeTokenCreate.mockReset()
    sendMail.mockReset()
  })

  it('invia la comunicazione via SMTP, aggiorna i recipient e registra i failure', async () => {
    prismaConsentFindMany.mockResolvedValue([
      {
        contactId: 'contact-1',
        contact: { id: 'contact-1', email: 'anna@example.com', status: 'ACTIVE' },
      },
      {
        contactId: 'contact-2',
        contact: { id: 'contact-2', email: 'luca@example.com', status: 'ACTIVE' },
      },
    ])
    prismaCampaignCreate.mockResolvedValue({
      id: 'campaign-1',
      name: 'Aggiornamento aprile',
      subject: 'Nuove comunicazioni MindCalm',
      htmlBody: '<p>Ciao {{unsubscribe_url}}</p>',
      matchMode: CampaignMatchMode.ANY,
      status: CampaignStatus.DRAFT,
      sentAt: null,
      createdByUserId: 'admin-1',
      createdAt: new Date('2026-04-14T18:00:00.000Z'),
      updatedAt: new Date('2026-04-14T18:00:00.000Z'),
    })
    prismaCampaignUpdate.mockResolvedValue({
      id: 'campaign-1',
      status: CampaignStatus.SENT,
      sentAt: new Date('2026-04-14T18:05:00.000Z'),
    })
    prismaCampaignAudienceFilterCreateMany.mockResolvedValue({ count: 1 })
    prismaCampaignRecipientCreateMany.mockResolvedValue({ count: 2 })
    prismaUnsubscribeTokenCreate.mockResolvedValue({})
    prismaCampaignRecipientUpdate.mockResolvedValue({})
    sendMail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('SMTP temporarily unavailable'))

    const result = await sendCampaign({
      name: 'Aggiornamento aprile',
      subject: 'Nuove comunicazioni MindCalm',
      htmlBody: '<p>Ciao {{unsubscribe_url}}</p>',
      filters: [{ formulaId: 'formula-1' }],
      matchMode: CampaignMatchMode.ANY,
      createdByUserId: 'admin-1',
    })

    expect(prismaCampaignCreate).toHaveBeenCalledWith({
      data: {
        name: 'Aggiornamento aprile',
        subject: 'Nuove comunicazioni MindCalm',
        htmlBody: '<p>Ciao {{unsubscribe_url}}</p>',
        matchMode: CampaignMatchMode.ANY,
        status: CampaignStatus.DRAFT,
        createdByUserId: 'admin-1',
      },
    })

    expect(sendMail).toHaveBeenCalledTimes(2)
    expect(sendMail.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      to: 'anna@example.com',
      subject: 'Nuove comunicazioni MindCalm',
    }))
    expect(sendMail.mock.calls[0]?.[0]?.html).toContain('http://localhost:5473/unsubscribe?token=raw-unsubscribe-token')
    expect(sendMail.mock.calls[0]?.[0]?.text).toContain('http://localhost:5473/unsubscribe?token=raw-unsubscribe-token')

    expect(prismaCampaignRecipientUpdate).toHaveBeenNthCalledWith(1, {
      where: {
        campaignId_contactId: {
          campaignId: 'campaign-1',
          contactId: 'contact-1',
        },
      },
      data: {
        status: CampaignRecipientStatus.SENT,
        sentAt: expect.any(Date),
        error: null,
      },
    })
    expect(prismaCampaignRecipientUpdate).toHaveBeenNthCalledWith(2, {
      where: {
        campaignId_contactId: {
          campaignId: 'campaign-1',
          contactId: 'contact-2',
        },
      },
      data: {
        status: CampaignRecipientStatus.FAILED,
        error: 'SMTP temporarily unavailable',
      },
    })
    expect(prismaCampaignUpdate).toHaveBeenCalledWith({
      where: { id: 'campaign-1' },
      data: {
        status: CampaignStatus.SENT,
        sentAt: expect.any(Date),
      },
    })

    expect(result.recipientsCount).toBe(2)
    expect(result.sentCount).toBe(1)
    expect(result.failedCount).toBe(1)
  })

  it('restituisce lo storico con i contatori aggregati dei recipient', async () => {
    prismaCampaignFindMany.mockResolvedValue([
      {
        id: 'campaign-1',
        name: 'Aprile',
        subject: 'Comunicazione aprile',
        htmlBody: '<p>Body</p>',
        matchMode: CampaignMatchMode.ALL,
        status: CampaignStatus.SENT,
        sentAt: new Date('2026-04-14T18:00:00.000Z'),
        createdByUserId: 'admin-1',
        createdAt: new Date('2026-04-14T17:00:00.000Z'),
        updatedAt: new Date('2026-04-14T18:00:00.000Z'),
        createdByUser: { id: 'admin-1', name: 'Admin', email: 'admin@example.com' },
        filters: [
          {
            id: 'filter-1',
            consentFormulaId: 'formula-1',
            formulaVersionIds: ['version-1'],
            consentFormula: { id: 'formula-1', code: 'newsletter' },
          },
        ],
        _count: { recipients: 3 },
      },
    ])
    prismaCampaignRecipientGroupBy.mockResolvedValue([
      { campaignId: 'campaign-1', status: CampaignRecipientStatus.SENT, _count: { status: 2 } },
      { campaignId: 'campaign-1', status: CampaignRecipientStatus.FAILED, _count: { status: 1 } },
    ])

    const history = await listCampaigns(20)

    expect(history).toHaveLength(1)
    expect(history[0]).toEqual(expect.objectContaining({
      id: 'campaign-1',
      recipientsCount: 3,
      sentCount: 2,
      failedCount: 1,
      pendingCount: 0,
    }))
  })
})
