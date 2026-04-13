-- CreateEnum
CREATE TYPE "NotificationFrequency" AS ENUM ('NONE', 'IMMEDIATE', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "user_notification_preferences" (
    "userId" TEXT NOT NULL,
    "notifyOnAudio" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnArticles" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "NotificationFrequency" NOT NULL DEFAULT 'NONE',
    "lastImmediateContentAt" TIMESTAMP(3),
    "lastWeeklyDigestSentAt" TIMESTAMP(3),
    "lastMonthlyDigestSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "notification_schedule_settings" (
    "id" INTEGER NOT NULL,
    "immediateHourUtc" INTEGER NOT NULL DEFAULT 9,
    "weeklyHourUtc" INTEGER NOT NULL DEFAULT 9,
    "weeklyDayOfWeek" INTEGER NOT NULL DEFAULT 1,
    "monthlyHourUtc" INTEGER NOT NULL DEFAULT 9,
    "monthlyDayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_schedule_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
