import mongoose from 'mongoose';

const analyticsEventSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    category: { type: String, index: true },
    query: { type: String, index: true },
    productId: { type: String },
    productUrl: { type: String },
    userId: { type: String },
    requestId: { type: String, index: true },
    ts: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

analyticsEventSchema.index({ category: 1, query: 1, ts: -1 });

export const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);
