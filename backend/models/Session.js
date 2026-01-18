import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    videoId: { type: String },
    timestampSec: { type: Number },
    frameHash: { type: String, required: true, index: true },
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
    results: { type: [mongoose.Schema.Types.Mixed], default: [] },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    versionKey: false,
  }
);

sessionSchema.index({ videoId: 1, timestampSec: 1 });
sessionSchema.index({ createdAt: -1 });

export const Session = mongoose.model('Session', sessionSchema);
