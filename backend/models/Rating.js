const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  rideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: true
  },
  raterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ratedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review: { type: String, trim: true, maxlength: 500 },
  tags: [{ type: String, enum: ['cleanliness', 'safety', 'punctuality', 'driving', 'behaviour', 'communication'] }]
}, {
  timestamps: true
});

ratingSchema.index({ rideId: 1 });
ratingSchema.index({ raterId: 1 });
ratingSchema.index({ ratedUserId: 1 });

module.exports = mongoose.model('Rating', ratingSchema);
