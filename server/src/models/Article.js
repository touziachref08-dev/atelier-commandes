import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    image: { type: String, required: true, trim: true },
    priceDT: { type: Number, required: true, min: 0, validate: Number.isFinite },
    stock: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger }
  },
  { timestamps: true }
);

export default mongoose.model('Article', articleSchema);
