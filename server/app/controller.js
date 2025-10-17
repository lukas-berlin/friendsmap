const locations = {};

const cleanOldLocations = () => {
  const now = Date.now();
  for (const [key, value] of Object.entries(locations)) {
    if (now - value.lastSeen > 1000 * 60 * 5) {
      delete locations[key];
    }
  }
};

exports.getLocations = (req, res) => {
  cleanOldLocations();
  res.json(locations);
};

exports.storeLocation = (req, res) => {
  const { name, location } = req.body;
  cleanOldLocations();
  locations[name] = { location, lastSeen: Date.now() };
  res.json(locations);
};
