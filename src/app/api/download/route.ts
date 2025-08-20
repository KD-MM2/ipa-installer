import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../prisma/prisma';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
    try {
        const { buildId } = await request.json();

        if (!buildId) {
            return NextResponse.json({ success: false, error: 'buildId is required' }, { status: 400 });
        }

        // Get current build info
        const build = await prisma.build.findUnique({
            where: { buildId },
            select: {
                id: true,
                buildId: true,
                downloadCount: true,
                maxDownloads: true,
                status: true,
                expiresAt: true
            }
        });

        if (!build) {
            return NextResponse.json({ success: false, error: 'Build not found' }, { status: 404 });
        }

        // Check if build is still downloadable
        const now = new Date();
        const isExpired = build.expiresAt && build.expiresAt < now;
        const isOverLimit = build.maxDownloads && build.downloadCount >= build.maxDownloads;

        if (build.status !== 'active' || isExpired || isOverLimit) {
            return NextResponse.json({ success: false, error: 'Build is no longer available for download' }, { status: 403 });
        }

        // Increment download count
        const updatedBuild = await prisma.build.update({
            where: { id: build.id },
            data: {
                downloadCount: build.downloadCount + 1
            },
            select: {
                buildId: true,
                downloadCount: true,
                maxDownloads: true
            }
        });

        return NextResponse.json({
            success: true,
            downloadCount: updatedBuild.downloadCount,
            remainingDownloads: updatedBuild.maxDownloads ? updatedBuild.maxDownloads - updatedBuild.downloadCount : null,
            message: 'Download count incremented'
        });
    } catch (error) {
        console.error('Error incrementing download count:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
