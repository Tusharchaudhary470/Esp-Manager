const Team = require('../models/Team');
const { canWrite } = require('../middleware/permissions');

const isMaintenanceMode = () => process.env.STRATEGY_MAINTENANCE_MODE === 'true';

const isProTeam = (team) => {
  if (team.isPro) return true;
  if (team.proExpiresAt && new Date(team.proExpiresAt) > new Date()) return true;
  return false;
};

// Check maintenance status
exports.getStrategyStatus = async (req, res) => {
  res.json({
    maintenance: isMaintenanceMode(),
    message: isMaintenanceMode() 
      ? 'Cloud strategy storage is temporarily under maintenance. You can still plan tactics and share via WhatsApp or PNG.' 
      : 'Operational'
  });
};

// Get all saved strategies for a squad
exports.getStrategies = async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    // Validate active membership
    const isMember = (team.members || []).some(
      (m) => (m._id ? m._id.toString() : m.toString()) === req.userId.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied: You are not a member of this squad' });
    }

    const strategies = (team.strategies || []).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    res.json(strategies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new strategy board
exports.createStrategy = async (req, res) => {
  try {
    // 1. Check emergency maintenance kill-switch
    if (isMaintenanceMode()) {
      return res.status(503).json({
        message: 'Cloud strategy storage is temporarily in maintenance mode. You can still use the tactical board and share directly via WhatsApp or PNG export!',
        code: 'MAINTENANCE_MODE'
      });
    }

    const {
      teamId,
      title,
      game,
      mapName,
      customImage,
      notes,
      slides,
      markers,
      arrows,
      zones,
      labeledCircles,
      pencilPaths,
      textAnnotations
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Strategy title is required' });
    }

    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only squad captain or co-captains can create strategies' });
    }

    if (!team.strategies) team.strategies = [];

    // 2. Free Tier vs Pro Enforcement
    const isPro = isProTeam(team);

    if (!isPro) {
      // Quota A: Max 1 saved playbook on Free tier
      if (team.strategies.length >= 1) {
        return res.status(403).json({
          message: 'Free tier allows 1 active squad playbook. Upgrade to Rosterly Pro for unlimited playbooks, or update your existing strategy!',
          code: 'PLAYBOOK_LIMIT_REACHED'
        });
      }

      // Quota B: Max 1 slide on Free tier (multi-phase slides require Pro)
      if (Array.isArray(slides) && slides.length > 1) {
        return res.status(403).json({
          message: 'Free tier includes 1 tactical map slide. Upgrade to Rosterly Pro to add unlimited multi-phase slides!',
          code: 'SLIDE_LIMIT_REACHED'
        });
      }
    }

    const newStrategy = {
      title: title.trim(),
      game: game || 'Custom / Any Game',
      mapName: mapName || 'Bermuda',
      customImage: customImage || null,
      notes: notes ? notes.trim() : '',
      slides: Array.isArray(slides) ? slides : [],
      markers: Array.isArray(markers) ? markers : [],
      arrows: Array.isArray(arrows) ? arrows : [],
      zones: Array.isArray(zones) ? zones : [],
      labeledCircles: Array.isArray(labeledCircles) ? labeledCircles : [],
      pencilPaths: Array.isArray(pencilPaths) ? pencilPaths : [],
      textAnnotations: Array.isArray(textAnnotations) ? textAnnotations : [],
      createdBy: req.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    team.strategies.push(newStrategy);
    team.markModified('strategies');
    await team.save();

    const created = team.strategies[team.strategies.length - 1];
    res.json({
      message: 'Strategy saved to squad playbook',
      strategy: created,
      strategies: team.strategies
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update an existing strategy board
exports.updateStrategy = async (req, res) => {
  try {
    // 1. Check emergency maintenance kill-switch
    if (isMaintenanceMode()) {
      return res.status(503).json({
        message: 'Cloud strategy storage is temporarily in maintenance mode. You can still use the tactical board and share directly via WhatsApp or PNG export!',
        code: 'MAINTENANCE_MODE'
      });
    }

    const { strategyId } = req.params;
    const {
      teamId,
      title,
      game,
      mapName,
      customImage,
      notes,
      slides,
      markers,
      arrows,
      zones,
      labeledCircles,
      pencilPaths,
      textAnnotations
    } = req.body;

    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only squad captain or co-captains can update strategies' });
    }

    const strat = team.strategies.id(strategyId);
    if (!strat) return res.status(404).json({ message: 'Strategy not found' });

    // 2. Free Tier vs Pro Enforcement
    const isPro = isProTeam(team);

    if (!isPro) {
      // Quota B: Max 1 slide on Free tier (multi-phase slides require Pro)
      if (Array.isArray(slides) && slides.length > 1) {
        return res.status(403).json({
          message: 'Free tier includes 1 tactical map slide. Upgrade to Rosterly Pro to add unlimited multi-phase slides!',
          code: 'SLIDE_LIMIT_REACHED'
        });
      }
    }

    if (title) strat.title = title.trim();
    if (game) strat.game = game;
    if (mapName) strat.mapName = mapName;
    if (customImage !== undefined) strat.customImage = customImage;
    if (notes !== undefined) strat.notes = notes.trim();
    if (slides) strat.slides = slides;
    if (markers) strat.markers = markers;
    if (arrows) strat.arrows = arrows;
    if (zones) strat.zones = zones;
    if (labeledCircles) strat.labeledCircles = labeledCircles;
    if (pencilPaths) strat.pencilPaths = pencilPaths;
    if (textAnnotations) strat.textAnnotations = textAnnotations;
    strat.updatedAt = new Date();

    team.markModified('strategies');
    await team.save();

    res.json({
      message: 'Strategy updated successfully',
      strategy: strat,
      strategies: team.strategies
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a strategy from the squad playbook
exports.deleteStrategy = async (req, res) => {
  try {
    const { strategyId } = req.params;
    const { teamId } = req.body;

    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only squad captain or co-captains can delete strategies' });
    }

    const strat = team.strategies.id(strategyId);
    if (!strat) return res.status(404).json({ message: 'Strategy not found' });

    team.strategies.pull(strategyId);
    team.markModified('strategies');
    await team.save();

    res.json({
      message: 'Strategy deleted from squad playbook',
      strategies: team.strategies
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
