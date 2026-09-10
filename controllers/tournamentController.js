const Team = require('../models/Team');
const { canWrite } = require('../middleware/permissions');

// Add new tournament to squad schedule
exports.addTournament = async (req, res) => {
  try {
    const { teamId, name, date, entryFee } = req.body;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only team captain or co-captains can schedule tournaments' });
    }

    team.tournaments.push({
      name,
      date,
      entryFee: Number(entryFee || 0)
    });

    await team.save();
    res.json({ message: 'Tournament added Successfully  details ' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update tournament details
exports.updateTournament = async (req, res) => {
  try {
    const { teamId, name, date, entryFee } = req.body;
    const { tournamentId } = req.params;

    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only team captain or co-captains can edit tournaments' });
    }

    const tournament = team.tournaments.id(tournamentId);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    tournament.name = name;
    tournament.date = date;
    tournament.entryFee = Number(entryFee || 0);

    await team.save();
    res.json({ message: 'Tournament saved' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete tournament from squad schedule
exports.deleteTournament = async (req, res) => {
  try {
    const { teamId } = req.body;
    const { tournamentId } = req.params;

    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only team captain or co-captains can delete tournaments' });
    }

    team.tournaments = team.tournaments.filter(
      (t) => t._id.toString() !== tournamentId
    );

    await team.save();
    res.json({ message: 'Tournament saved' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
