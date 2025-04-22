import { Router, Request, Response } from 'express';
import { Progress } from '../models/Progress';

const router = Router();

// Get progress for a specific video and user
router.get('/:videoId', async (req: Request, res: Response) => {
    try {
        const { videoId } = req.params;
        const userId = req.headers['user-id'] as string;

        if (!userId) {
            return res.status(401).json({ error: 'User ID is required' });
        }

        let progress = await Progress.findOne({ userId, videoId });

        if (!progress) {
            progress = new Progress({
                userId,
                videoId,
                intervals: [],
                lastPosition: 0,
                totalWatched: 0,
                videoDuration: 0
            });
            await progress.save();
        }

        res.json(progress);
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
});

// Update progress for a video
router.post('/:videoId', async (req: Request, res: Response) => {
    try {
        const { videoId } = req.params;
        const userId = req.headers['user-id'] as string;
        const { interval, lastPosition } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'User ID is required' });
        }

        if (!interval || typeof interval.start !== 'number' || typeof interval.end !== 'number') {
            return res.status(400).json({ error: 'Invalid interval format' });
        }

        let progress = await Progress.findOne({ userId, videoId });

        if (!progress) {
            progress = new Progress({
                userId,
                videoId,
                intervals: [],
                lastPosition: 0,
                totalWatched: 0,
                videoDuration: interval.end // Use the end time as duration if not set
            });
        }

        // Add new interval and update last position
        progress.addInterval(interval.start, interval.end, lastPosition);
        await progress.save();

        res.json(progress);
    } catch (error) {
        console.error('Error updating progress:', error);
        res.status(500).json({ error: 'Failed to update progress' });
    }
});

// Reset progress for a video
router.delete('/:videoId', async (req: Request, res: Response) => {
    try {
        const { videoId } = req.params;
        const userId = req.headers['user-id'] as string;

        if (!userId) {
            return res.status(401).json({ error: 'User ID is required' });
        }

        await Progress.findOneAndDelete({ userId, videoId });
        res.json({ message: 'Progress reset successfully' });
    } catch (error) {
        console.error('Error resetting progress:', error);
        res.status(500).json({ error: 'Failed to reset progress' });
    }
});

export default router; 