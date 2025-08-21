import { NextRequest, NextResponse } from 'next/server';
import { getJobStatus } from '@/lib/queue';
import { QUEUE_NAMES } from '@/types/queue';
import { PrismaClient } from '../../../../prisma/prisma';
import { UrlUtils } from '@/lib/url-utils';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('jobId');
        const appId = searchParams.get('appId');

        if (!jobId && !appId) {
            return NextResponse.json({ success: false, error: 'jobId or appId is required' }, { status: 400 });
        }

        const response: any = {};

        // Get job status if jobId provided
        if (jobId) {
            const jobStatus = await getJobStatus(jobId, QUEUE_NAMES.IPA_PROCESS);
            response.job = jobStatus;
        }

        // Get app info if appId provided
        if (appId) {
            const app = await prisma.app.findUnique({
                where: { appId },
                select: {
                    id: true,
                    appId: true,
                    appName: true,
                    bundleId: true,
                    version: true,
                    buildNumber: true,
                    displayName: true,
                    minimumOSVersion: true,
                    originalFilename: true,
                    fileSize: true,
                    hasIcon: true,
                    status: true,
                    maxDownloads: true,
                    downloadCount: true,
                    expiresAt: true,
                    createdAt: true,
                    updatedAt: true
                }
            });

            if (app) {
                const urls = UrlUtils.getAllUrls(app.appId, app.originalFilename, app.hasIcon);
                response.app = {
                    ...app,
                    fileSize: app.fileSize.toString(), // Convert BigInt to string for JSON
                    iconUrl: urls.iconUrl,
                    ipaUrl: urls.ipaUrl,
                    plistUrl: urls.plistUrl,
                    installationUrl: urls.installationUrl,
                    appDetailUrl: urls.appDetailUrl
                };
            }
        }

        return NextResponse.json({
            success: true,
            ...response
        });
    } catch (error) {
        console.error('Error getting status:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
