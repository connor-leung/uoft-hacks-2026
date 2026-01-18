import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    itemQuery: { type: String },
    itemCategory: { type: String, index: true },
    productUrl: { type: String },
    productRank: { type: Number },
    createdAt: { type: Date, default: Date.now, index: true },
    latencyMs: { type: Number },
  },
  {
    versionKey: false,
  }
);

eventSchema.index({ type: 1, createdAt: -1 });
eventSchema.index({ itemCategory: 1, createdAt: -1 });

export const Event = mongoose.model('Event', eventSchema);
