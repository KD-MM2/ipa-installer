import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../prisma/prisma';

const prisma = new PrismaClient();

// GET /api/download?appId=nF2VZ9
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const appId = searchParams.get('appId');

        if (!appId) {
            return NextResponse.json({ success: false, error: 'appId is required' }, { status: 400 });
        }

        // Get app info
        const app = await prisma.app.findUnique({
            where: { appId },
            select: {
                id: true,
                appId: true,
                appName: true,
                version: true,
                buildNumber: true,
                status: true,
                expiresAt: true
            }
        });

        if (!app) {
            return NextResponse.json({ success: false, error: 'App not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: app });
    } catch (error) {
        console.error('Error fetching app info:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { appId } = await request.json();

        if (!appId) {
            return NextResponse.json({ success: false, error: 'appId is required' }, { status: 400 });
        }

        // Get current app info
        const app = await prisma.app.findUnique({
            where: { appId },
            select: {
                id: true,
                appId: true,
                downloadCount: true,
                maxDownloads: true,
                status: true,
                expiresAt: true
            }
        });

        if (!app) {
            return NextResponse.json({ success: false, error: 'App not found' }, { status: 404 });
        }

        // Check if app is still downloadable
        const now = new Date();
        const isExpired = app.expiresAt && app.expiresAt < now;
        const isOverLimit = app.maxDownloads && app.downloadCount >= app.maxDownloads;

        if (app.status !== 'active' || isExpired || isOverLimit) {
            return NextResponse.json({ success: false, error: 'App is no longer available for download' }, { status: 403 });
        }

        // Increment download count
        const updatedApp = await prisma.app.update({
            where: { id: app.id },
            data: {
                downloadCount: app.downloadCount + 1
            },
            select: {
                appId: true,
                downloadCount: true,
                maxDownloads: true
            }
        });

        return NextResponse.json({
            success: true,
            downloadCount: updatedApp.downloadCount,
            remainingDownloads: updatedApp.maxDownloads ? updatedApp.maxDownloads - updatedApp.downloadCount : null,
            message: 'Download count incremented'
        });
    } catch (error) {
        console.error('Error incrementing download count:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
