const express = require('express')
const router = express.Router()
const Team = require('../models/Team')
const authMiddleware = require('../middleware/auth')

// Create team
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body
    const code = Math.random().toString(36).substring(2, 7).toUpperCase()

    const team = new Team({
      name,
      code,
      members: [req.userId]
    })

    await team.save()

    res.json({ message: 'Team created', team })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/join', authMiddleware, async (req ,res)=>{
    try {
        const { code } = req.body
        const team = await Team.findOne({
        "code": code
    });
    if (!team) return res.status(404).json({ message: 'Team not found' })
    team.members.push(req.userId)
    await team.save();
    res.json({message: "successfully joined " + team.name})
    
    } catch (error) {
        res.json({message: error.message})
    }
})

router.post('/deposit', authMiddleware, async (req, res)=>{
   
try {
        const {amount , teamId, description} = req.body
         const team = await Team.findOne({
            "_id": teamId
        });
        if (!team) return res.status(404).json({ message: 'Team not found' })
        team.balance = team.balance + amount;
        team.transactions.push({
        type: 'deposit',
        amount: amount,
        description: description,
        performedBy: req.userId,
        status: 'completed'
        })
        await team.save();
        res.json({Balance: team.balance})
} catch (error) {
    res.json({message: error.message})
}
})

router.post('/withdraw', authMiddleware, async (req, res)=>{
   
try {
        const {amount , teamId, description} = req.body
         const team = await Team.findOne({
            "_id": teamId
        });
        if (!team) return res.status(404).json({ message: 'Team not found' })
        if (amount > team.balance) return res.status(400).json({ message: 'Insufficient funds' })
        team.balance -= amount
        team.transactions.push({
        type: 'withdraw',
        amount: amount,
        description: description,
        performedBy: req.userId,
        status: 'completed'
        })
        await team.save();
        res.json({Balance: team.balance})
} catch (error) {
    res.json({message: error.message})
}
})

router.post('/lobby', authMiddleware, async (req, res)=>{
try {
    const {teamId, entryFee, profit, description, status} = req.body
    const team = await Team.findOne({
            "_id": teamId
        });
        if (!team) return res.status(404).json({ message: 'Team not found' })
        
    team.transactions.push({
  type: 'lobby',
  entryFee: entryFee,
  description: description,
  performedBy: req.userId,
  profit: profit,
  status: status
})
await team.save()
if(status != 'completed') return res.json({message: "Transaction still pending"})
    team.balance = team.balance + ((profit || 0) - (entryFee || 0))
await team.save()
res.json({Balance: team.balance})
}
catch(err){
    res.json({message: err.message})
}
})

router.put('/lobby/:transactionId', authMiddleware, async (req, res)=>{
    try {
        const {teamId, profit, entryFee}= req.body;
        const { transactionId } = req.params;
        const team = await Team.findOne({
                "_id": teamId
            });
            if (!team) return res.status(404).json({ message: 'Team not found' })
        const transaction = team.transactions.id(transactionId)
        transaction.profit = profit;
        transaction.status = 'completed'
        transaction.entryFee = entryFee;
    
        team.balance = team.balance + (profit - entryFee)
        await team.save();
    
        res.json({Balance: team.balance})
    } catch (error) {
        res.json({message: error.message})
    }
})

router.post('/tournaments', authMiddleware, async (req, res)=>{
    try {
        const {teamId, name, date, entryFee} = req.body;
        const team = await Team.findOne({
                    "_id": teamId
                })
        if (!team) return res.status(404).json({ message: 'Team not found' })
        team.tournaments.push({
        name: name,
        date: date,
        entryFee: entryFee
    })
    await team.save();
    res.json({message: "Tournament added Successfully  details "})
    } catch (error) {
        res.json({message: error.message})
    }
})

router.put('/tournaments/:tournamentId', authMiddleware, async (req, res)=>{
    try {
        const {teamId, status}= req.body;
        const { tournamentId } = req.params;
        const team = await Team.findOne({
                "_id": teamId
            });
            if (!team) return res.status(404).json({ message: 'Team not found' })
        const tournament = team.tournaments.id(tournamentId)
        
        tournament.status = status
        await team.save();
    
        res.json({message: "Tournament saved"})
    } catch (error) {
        res.json({message: error.message})
    }
})

router.get('/:teamId', authMiddleware, async (req, res)=>{
    try {
        const {teamId} = req.params
        const team = await Team.findOne({
            "_id": teamId
        })
        res.json(team)
    } catch (error) {
       res.json({message: error.message}) 
    }
})
router.get('/', authMiddleware, async (req, res)=>{
    try {
        const teams = await Team.find({members: req.userId})
        res.json(teams)
    } catch (error) {
       res.json({message: error.message}) 
    }
})
module.exports = router