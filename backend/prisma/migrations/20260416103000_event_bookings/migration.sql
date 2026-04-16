-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'EVENT_BOOKING_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'EVENT_BOOKING_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'EVENT_BOOKING_RESTORED';
ALTER TYPE "AuditAction" ADD VALUE 'EVENT_BOOKING_RECONCILED';

-- CreateEnum
CREATE TYPE "EventBookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "events"
ADD COLUMN "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "bookingCapacity" INTEGER,
ADD COLUMN "bookingReservedSeats" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "bookingOpensAt" TIMESTAMP(3),
ADD COLUMN "bookingClosesAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_notification_preferences"
ADD COLUMN "notifyOnEvents" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "event_booking_invitations" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_booking_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_bookings" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "status" "EventBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "bookerFirstName" TEXT NOT NULL,
    "bookerLastName" TEXT NOT NULL,
    "bookerPhone" TEXT NOT NULL,
    "seatsReserved" INTEGER NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_booking_participants" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "isBooker" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_booking_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_booking_invitations_tokenHash_key" ON "event_booking_invitations"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "event_booking_invitations_eventId_recipientEmail_key" ON "event_booking_invitations"("eventId", "recipientEmail");

-- CreateIndex
CREATE INDEX "event_booking_invitations_eventId_recipientEmail_idx" ON "event_booking_invitations"("eventId", "recipientEmail");

-- CreateIndex
CREATE INDEX "event_booking_invitations_eventId_expiresAt_idx" ON "event_booking_invitations"("eventId", "expiresAt");

-- CreateIndex
CREATE INDEX "event_booking_invitations_userId_idx" ON "event_booking_invitations"("userId");

-- CreateIndex
CREATE INDEX "event_booking_invitations_revokedAt_expiresAt_idx" ON "event_booking_invitations"("revokedAt", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "event_bookings_invitationId_key" ON "event_bookings"("invitationId");

-- CreateIndex
CREATE INDEX "event_bookings_eventId_status_createdAt_idx" ON "event_bookings"("eventId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "event_booking_participants_bookingId_isBooker_idx" ON "event_booking_participants"("bookingId", "isBooker");

-- CreateIndex
CREATE INDEX "events_bookingEnabled_idx" ON "events"("bookingEnabled");

-- AddForeignKey
ALTER TABLE "event_booking_invitations" ADD CONSTRAINT "event_booking_invitations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_booking_invitations" ADD CONSTRAINT "event_booking_invitations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "event_booking_invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_booking_participants" ADD CONSTRAINT "event_booking_participants_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "event_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "events" ADD CONSTRAINT "events_booking_capacity_check"
CHECK (
  NOT "bookingEnabled"
  OR (
    "bookingCapacity" IS NOT NULL
    AND "bookingCapacity" > 0
  )
);

-- AddCheckConstraint
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_seats_reserved_check"
CHECK ("seatsReserved" >= 1 AND "seatsReserved" <= 5);

-- AddCheckConstraint
ALTER TABLE "events" ADD CONSTRAINT "events_booking_reserved_seats_check"
CHECK ("bookingReservedSeats" >= 0);
