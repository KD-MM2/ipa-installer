import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../../prisma/prisma';
import { UrlUtils } from '@/lib/url-utils';

const prisma = new PrismaClient();

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
            where.OR = [{ appName: { contains: search, mode: 'insensitive' } }, { bundleId: { contains: search, mode: 'insensitive' } }, { buildId: { contains: search, mode: 'insensitive' } }, { version: { contains: search, mode: 'insensitive' } }];
        }

        // Get total count
        const total = await prisma.build.count({ where });

        // Get builds
        const builds = await prisma.build.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
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

        // Convert BigInt to string and add URLs for JSON serialization
        const buildsFormatted = builds.map((build: any) => {
            const urls = UrlUtils.getAllUrls(build.buildId, build.originalFilename, build.hasIcon);
            return {
                ...build,
                fileSize: build.fileSize.toString(),
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
            data: buildsFormatted,
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
        console.error('Error getting builds:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

// Update build (disable, set expiry, etc.)
export async function PATCH(request: NextRequest) {
    try {
        const { buildId, updates } = await request.json();

        if (!buildId) {
            return NextResponse.json({ success: false, error: 'buildId is required' }, { status: 400 });
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

        const updatedBuild = await prisma.build.update({
            where: { buildId },
            data: filteredUpdates,
            select: {
                id: true,
                buildId: true,
                appName: true,
                status: true,
                maxDownloads: true,
                expiresAt: true,
                updatedAt: true
            }
        });

        return NextResponse.json({
            success: true,
            build: updatedBuild,
            message: 'Build updated successfully'
        });
    } catch (error) {
        console.error('Error updating build:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

// Delete build permanently from database
export async function DELETE(request: NextRequest) {
    try {
        const { buildId, buildIds } = await request.json();

        if (!buildId && !buildIds) {
            return NextResponse.json({ success: false, error: 'buildId or buildIds is required' }, { status: 400 });
        }

        // Handle bulk delete
        if (buildIds && Array.isArray(buildIds)) {
            // Delete multiple builds
            const deleteResult = await prisma.build.deleteMany({
                where: {
                    buildId: {
                        in: buildIds
                    }
                }
            });

            // Schedule cleanup jobs for file system cleanup
            const { addCleanupJob } = await import('@/lib/queue');
            for (const id of buildIds) {
                await addCleanupJob(id);
            }

            return NextResponse.json({
                success: true,
                message: `${deleteResult.count} builds deleted successfully`,
                deletedCount: deleteResult.count
            });
        }

        // Handle single delete
        if (buildId) {
            // First check if build exists
            const existingBuild = await prisma.build.findUnique({
                where: { buildId }
            });

            if (!existingBuild) {
                return NextResponse.json({ success: false, error: 'Build not found' }, { status: 404 });
            }

            // Delete the build from database
            await prisma.build.delete({
                where: { buildId }
            });

            // Schedule cleanup job for file system cleanup
            const { addCleanupJob } = await import('@/lib/queue');
            await addCleanupJob(buildId);

            return NextResponse.json({
                success: true,
                message: 'Build deleted successfully'
            });
        }

        return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    } catch (error) {
        console.error('Error deleting build:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
