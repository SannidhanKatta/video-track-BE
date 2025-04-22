import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import progressRoutes from './routes/progress';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.CLIENT_URL
        : 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/progress', progressRoutes);

// Basic health check route
app.get('/api/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Create HTTP server
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? process.env.CLIENT_URL
            : 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
    },
    path: '/socket.io'
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });

    socket.on('progress-update', async (data) => {
        try {
            socket.broadcast.emit(`video-progress-${data.videoId}`, {
                userId: data.userId,
                progress: data.progress
            });
        } catch (error) {
            console.error('Progress update error:', error);
        }
    });
});

// MongoDB connection with retry
const connectDB = async (retries = 5) => {
    try {
        const mongoURI = process.env.MONGODB_URI;
        if (!mongoURI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB');

        // Start server only after successful DB connection
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('MongoDB connection error:', err);
        if (retries > 0) {
            console.log(`Retrying connection... (${retries} attempts left)`);
            setTimeout(() => connectDB(retries - 1), 5000);
        } else {
            console.error('Failed to connect to MongoDB after multiple attempts');
            process.exit(1);
        }
    }
};

// Start the connection process
connectDB(); 