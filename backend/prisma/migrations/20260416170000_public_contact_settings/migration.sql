CREATE TABLE "public_contact_settings" (
    "id" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsappNumber" TEXT,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_contact_settings_pkey" PRIMARY KEY ("id")
);
