/*
  Warnings:

  - You are about to drop the `builds` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `downloads` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `processing_jobs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "builds";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "downloads";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "processing_jobs";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "apps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "buildNumber" TEXT NOT NULL,
    "displayName" TEXT,
    "minimumOSVersion" TEXT,
    "originalFilename" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "hasIcon" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "maxDownloads" INTEGER,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "apps_appId_key" ON "apps"("appId");
