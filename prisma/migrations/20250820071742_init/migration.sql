-- CreateTable
CREATE TABLE "builds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildId" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "buildNumber" TEXT NOT NULL,
    "displayName" TEXT,
    "minOSVersion" TEXT,
    "ipaPath" TEXT NOT NULL,
    "iconPath" TEXT,
    "plistPath" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxDownloads" INTEGER,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "autoDelete" BOOLEAN NOT NULL DEFAULT true,
    "tag" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "downloads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "downloadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "downloads_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "builds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "builds_buildId_key" ON "builds"("buildId");

-- CreateIndex
CREATE UNIQUE INDEX "processing_jobs_buildId_key" ON "processing_jobs"("buildId");

-- CreateIndex
CREATE UNIQUE INDEX "processing_jobs_jobId_key" ON "processing_jobs"("jobId");
