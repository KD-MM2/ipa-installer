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
        const buildId = searchParams.get('buildId');

        if (!jobId && !buildId) {
            return NextResponse.json({ success: false, error: 'jobId or buildId is required' }, { status: 400 });
        }

        const response: any = {};

        // Get job status if jobId provided
        if (jobId) {
            const jobStatus = await getJobStatus(jobId, QUEUE_NAMES.IPA_PROCESS);
            response.job = jobStatus;
        }

        // Get build info if buildId provided
        if (buildId) {
            const build = await prisma.build.findUnique({
                where: { buildId },
                select: {
                    id: true,
                    buildId: true,
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

            if (build) {
                const urls = UrlUtils.getAllUrls(build.buildId, build.originalFilename, build.hasIcon);
                response.build = {
                    ...build,
                    fileSize: build.fileSize.toString(), // Convert BigInt to string for JSON
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
