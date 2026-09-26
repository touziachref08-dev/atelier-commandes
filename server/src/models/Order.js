import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true },
    title: { type: String, required: true },
    image: { type: String, required: true },
    quantity: { type: Number, default: 1, min: 1, max: 99 },
    unitPriceMillimes: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true, maxlength: 120 },
    firstName: { type: String, trim: true, maxlength: 80 },
    lastName: { type: String, trim: true, maxlength: 80 },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    items: { type: [orderItemSchema], required: true, validate: (items) => items.length > 0 },
    subtotalMillimes: { type: Number, required: true, min: 0 },
    deliveryFeeMillimes: { type: Number, required: true, default: 8000, min: 0 },
    totalMillimes: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['nouvelle', 'en préparation', 'terminée', 'annulée'],
      default: 'nouvelle'
    }
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);
