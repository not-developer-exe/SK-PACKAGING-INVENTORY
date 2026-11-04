const Party = require('./../models/Party.model');

// Get all parties with optional filtering
exports.getParties = async (req, res) => {
  try {
    const { type, search } = req.query;
    let query = {};

    if (type && type !== 'all') {
      query.partyType = type;
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const parties = await Party.find(query).sort({ name: 1 });
    res.json({ parties });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching parties', error: error.message });
  }
};

// Create a new party
exports.createParty = async (req, res) => {
  try {
    const { name, partyType, gstin, phone, address } = req.body;
    
    if (!name || !partyType) {
      return res.status(400).json({ message: 'Party name and type are required.' });
    }

    const party = await Party.create({
      name,
      partyType,
      gstin,
      phone,
      address
    });

    res.status(201).json({ message: 'Party created successfully', party });
  } catch (error) {
    res.status(500).json({ message: 'Error creating party', error: error.message });
  }
};

// Toggle active status
exports.togglePartyStatus = async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ message: 'Party not found' });

    party.isActive = !party.isActive;
    await party.save();

    res.json({ message: 'Party status updated', party });
  } catch (error) {
    res.status(500).json({ message: 'Error updating party status', error: error.message });
  }
};