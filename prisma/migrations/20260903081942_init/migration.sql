-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GestureConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leftAction" TEXT NOT NULL DEFAULT 'trash',
    "leftLabelId" TEXT,
    "rightAction" TEXT NOT NULL DEFAULT 'keep',
    "rightLabelId" TEXT,
    "upAction" TEXT NOT NULL DEFAULT 'archive',
    "upLabelId" TEXT,
    "downEnabled" BOOLEAN NOT NULL DEFAULT false,
    "downAction" TEXT NOT NULL DEFAULT 'label',
    "downLabelId" TEXT,
    "filterType" TEXT NOT NULL DEFAULT 'inbox',
    "filterLabelId" TEXT,
    "filterQuery" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GestureConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "gmailThreadId" TEXT,
    "gesture" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "addedLabelIds" TEXT,
    "removedLabelIds" TEXT,
    "wasTrashed" BOOLEAN NOT NULL DEFAULT false,
    "undone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GmailAccount_userId_key" ON "GmailAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GmailAccount_googleSub_key" ON "GmailAccount"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "GestureConfig_userId_key" ON "GestureConfig"("userId");

-- CreateIndex
CREATE INDEX "ActionHistory_userId_createdAt_idx" ON "ActionHistory"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "GmailAccount" ADD CONSTRAINT "GmailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GestureConfig" ADD CONSTRAINT "GestureConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionHistory" ADD CONSTRAINT "ActionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
