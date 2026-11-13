const Party = require('./../models/Party.model');

// Get all parties with optional filtering
exports.getParties = async (req, res) => {
    try {
      const { type } = req.query;
      
      // Default: only fetch active parties
      let query = { isActive: true };
  
      // Smart filtering: include 'both' in case a party buys AND sells
      if (type === 'supplier') {
        query.partyType = { $in: ['supplier', 'both'] };
      } else if (type === 'customer') {
        query.partyType = { $in: ['customer', 'both'] };
      }
      // If type === 'all', the query remains just { isActive: true }
  
      const parties = await require('../models/Party.model').find(query).sort({ name: 1 });
      res.json({ parties });
    } catch (error) {
      console.error('[PARTY ERROR]', error);
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