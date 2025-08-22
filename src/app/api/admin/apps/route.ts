import { prisma } from '@/lib/prisma';
import { UrlUtils } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};

        if (status && status !== 'all') {
            where.status = status;
        }

        if (search) {
            where.OR = [{ appName: { contains: search, mode: 'insensitive' } }, { bundleId: { contains: search, mode: 'insensitive' } }, { appId: { contains: search, mode: 'insensitive' } }, { version: { contains: search, mode: 'insensitive' } }];
        }

        // Get total count
        const total = await prisma.app.count({ where });

        // Get apps
        const apps = await prisma.app.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
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

        // Convert BigInt to string and add URLs for JSON serialization
        const appsFormatted = apps.map((app: any) => {
            const urls = UrlUtils.getAllUrls(app.appId, app.originalFilename, app.hasIcon);
            return {
                ...app,
                fileSize: app.fileSize.toString(),
                iconUrl: urls.iconUrl,
                ipaUrl: urls.ipaUrl,
                plistUrl: urls.plistUrl,
                installationUrl: urls.installationUrl,
                appDetailUrl: urls.appDetailUrl
            };
        });

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            success: true,
            data: appsFormatted,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error getting apps:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

// Update app (disable, set expiry, etc.)
export async function PATCH(request: NextRequest) {
    try {
        const { appId, updates } = await request.json();

        if (!appId) {
            return NextResponse.json({ success: false, error: 'appId is required' }, { status: 400 });
        }

        // Validate allowed updates
        const allowedUpdates = ['status', 'maxDownloads', 'expiresAt'];
        const filteredUpdates: any = {};

        for (const [key, value] of Object.entries(updates)) {
            if (allowedUpdates.includes(key)) {
                filteredUpdates[key] = value;
            }
        }

        if (Object.keys(filteredUpdates).length === 0) {
            return NextResponse.json({ success: false, error: 'No valid updates provided' }, { status: 400 });
        }

        // Convert date strings to Date objects
        if (filteredUpdates.expiresAt) {
            filteredUpdates.expiresAt = new Date(filteredUpdates.expiresAt);
        }

        const updatedApp = await prisma.app.update({
            where: { appId },
            data: filteredUpdates,
            select: {
                id: true,
                appId: true,
                appName: true,
                status: true,
                maxDownloads: true,
                expiresAt: true,
                updatedAt: true
            }
        });

        return NextResponse.json({
            success: true,
            app: updatedApp,
            message: 'App updated successfully'
        });
    } catch (error) {
        console.error('Error updating app:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

// Delete app permanently from database
export async function DELETE(request: NextRequest) {
    try {
        const { appId, appIds } = await request.json();

        if (!appId && !appIds) {
            return NextResponse.json({ success: false, error: 'appId or appIds is required' }, { status: 400 });
        }

        // Handle bulk delete
        if (appIds && Array.isArray(appIds)) {
            // Delete multiple apps
            const deleteResult = await prisma.app.deleteMany({
                where: {
                    appId: {
                        in: appIds
                    }
                }
            });

            // // Schedule cleanup jobs for file system cleanup
            const { addCleanupJob } = await import('@/lib/queue');
            for (const id of appIds) {
                await addCleanupJob(id);
            }

            return NextResponse.json({
                success: true,
                message: `${deleteResult.count} apps deleted successfully`,
                deletedCount: deleteResult.count
            });
        }

        // Handle single delete
        if (appId) {
            // First check if app exists
            const existingApp = await prisma.app.findUnique({
                where: { appId }
            });

            if (!existingApp) {
                return NextResponse.json({ success: false, error: 'App not found' }, { status: 404 });
            }

            // Delete the app from database
            await prisma.app.delete({
                where: { appId }
            });

            // Schedule cleanup job for file system cleanup
            const { addCleanupJob } = await import('@/lib/queue');
            await addCleanupJob(appId);

            return NextResponse.json({
                success: true,
                message: 'App deleted successfully'
            });
        }

        return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    } catch (error) {
        console.error('Error deleting app:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
