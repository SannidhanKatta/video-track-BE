import mongoose, { Schema, Document } from 'mongoose';

export interface IInterval {
    start: number;
    end: number;
}

export interface IProgress extends Document {
    userId: string;
    videoId: string;
    intervals: IInterval[];
    lastPosition: number;
    totalWatched: number;
    videoDuration: number;
    lastWatchedAt: Date;
    isCompleted: boolean;
    mergeIntervals: () => number;
    addInterval: (start: number, end: number, currentTime: number) => boolean;
    isIntervalWatched: (start: number, end: number) => boolean;
}

const ProgressSchema: Schema = new Schema({
    userId: { type: String, required: true },
    videoId: { type: String, required: true },
    intervals: [{
        start: { type: Number, required: true },
        end: { type: Number, required: true }
    }],
    lastPosition: { type: Number, default: 0 },
    totalWatched: { type: Number, default: 0 },
    videoDuration: { type: Number, required: true },
    lastWatchedAt: { type: Date, default: Date.now },
    isCompleted: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Create a compound index for efficient queries
ProgressSchema.index({ userId: 1, videoId: 1 }, { unique: true });

// Method to check if an interval has been watched
ProgressSchema.methods.isIntervalWatched = function (start: number, end: number): boolean {
    return this.intervals.some((interval: IInterval) =>
        start >= interval.start && end <= interval.end
    );
};

// Method to merge intervals and calculate total watched time
ProgressSchema.methods.mergeIntervals = function () {
    if (!this.intervals.length) return 0;

    // Sort intervals by start time
    const sorted = [...this.intervals].sort((a: IInterval, b: IInterval) => a.start - b.start);
    const merged: IInterval[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const last = merged[merged.length - 1];

        // Check for overlapping or consecutive intervals (within 1 second)
        if (current.start <= last.end + 1) {
            // Merge overlapping or consecutive intervals
            last.end = Math.max(last.end, current.end);
        } else {
            // Add non-overlapping interval
            merged.push(current);
        }
    }

    // Calculate total watched time
    this.intervals = merged;
    this.totalWatched = merged.reduce((sum: number, interval: IInterval) =>
        sum + (interval.end - interval.start), 0);

    // Check if video is completed (95% watched)
    this.isCompleted = (this.totalWatched / this.videoDuration) >= 0.95;

    return this.totalWatched;
};

// Method to add a new interval
ProgressSchema.methods.addInterval = function (start: number, end: number, currentTime: number): boolean {
    // Basic validation
    if (end <= start || start < 0 || end > this.videoDuration) return false;

    // Prevent large skips (more than 10 seconds)
    const lastPos = this.lastPosition;
    if (Math.abs(start - lastPos) > 10 && this.totalWatched > 0) {
        return false;
    }

    // Check if this interval is mostly unwatched
    let newWatchTime = 0;
    let intervalStart = start;

    while (intervalStart < end) {
        let isWatched = false;
        for (const interval of this.intervals) {
            if (intervalStart >= interval.start && intervalStart < interval.end) {
                intervalStart = interval.end;
                isWatched = true;
                break;
            }
        }

        if (!isWatched) {
            newWatchTime += 1;
            intervalStart += 1;
        }
    }

    // Only add interval if at least 50% is new content
    if (newWatchTime >= (end - start) * 0.5) {
        // Update last position and timestamp
        this.lastPosition = currentTime;
        this.lastWatchedAt = new Date();

        // Add the new interval
        this.intervals.push({ start, end });

        // Merge intervals and update total watched time
        this.mergeIntervals();
        return true;
    }

    return false;
};

export const Progress = mongoose.model<IProgress>('Progress', ProgressSchema); 