const mongoose = require('mongoose');

const UsageSchema = new mongoose.Schema({
    date: {
        type: String, // Format: YYYY-MM-DD
        required: true,
        unique: true
    },
    count: {
        type: Number,
        default: 0
    },
    lastNotifiedAt: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('Usage', UsageSchema);
