import prisma from '../utils/prisma.js';

export const getLogsByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (date) {
      const logs = await prisma.foodLog.findMany({
        where: {
          userId: req.userId,
          date
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
      return res.json({ logs });
    }

    const logs = await prisma.foodLog.findMany({
      where: {
        userId: req.userId
      },
      orderBy: {
        date: 'desc'
      }
    });

    return res.json({ logs });
  } catch (error) {
    console.error('Get logs error:', error);
    return res.status(500).json({ error: 'Failed to retrieve food logs' });
  }
};

export const createLogEntry = async (req, res) => {
  try {
    const { date, mealSlot, foodName, quantity, unit, calories, protein, carbs, fat, gramEquivalent } = req.body;

    if (!date || !mealSlot || !foodName || quantity === undefined || !unit || calories === undefined || protein === undefined || carbs === undefined || fat === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const log = await prisma.foodLog.create({
      data: {
        userId: req.userId,
        date,
        mealSlot,
        foodName,
        quantity: parseFloat(quantity),
        unit,
        calories: parseFloat(calories),
        protein: parseFloat(protein),
        carbs: parseFloat(carbs),
        fat: parseFloat(fat),
        gramEquivalent: gramEquivalent !== undefined ? parseFloat(gramEquivalent) : parseFloat(quantity)
      }
    });

    return res.status(201).json({ log });
  } catch (error) {
    console.error('Create log error:', error);
    return res.status(500).json({ error: 'Failed to create log entry' });
  }
};

export const updateLogEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { foodName, quantity, unit, calories, protein, carbs, fat, gramEquivalent, mealSlot } = req.body;

    const logId = parseInt(id);
    const existingLog = await prisma.foodLog.findUnique({ where: { id: logId } });

    if (!existingLog) {
      return res.status(404).json({ error: 'Log entry not found' });
    }

    if (existingLog.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized operation' });
    }

    const updatedLog = await prisma.foodLog.update({
      where: { id: logId },
      data: {
        foodName,
        mealSlot: mealSlot || existingLog.mealSlot,
        quantity: quantity !== undefined ? parseFloat(quantity) : undefined,
        unit,
        calories: calories !== undefined ? parseFloat(calories) : undefined,
        protein: protein !== undefined ? parseFloat(protein) : undefined,
        carbs: carbs !== undefined ? parseFloat(carbs) : undefined,
        fat: fat !== undefined ? parseFloat(fat) : undefined,
        gramEquivalent: gramEquivalent !== undefined ? parseFloat(gramEquivalent) : undefined
      }
    });

    return res.json({ log: updatedLog });
  } catch (error) {
    console.error('Update log error:', error);
    return res.status(500).json({ error: 'Failed to update log entry' });
  }
};

export const deleteLogEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const logId = parseInt(id);

    const existingLog = await prisma.foodLog.findUnique({ where: { id: logId } });

    if (!existingLog) {
      return res.status(404).json({ error: 'Log entry not found' });
    }

    if (existingLog.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized operation' });
    }

    await prisma.foodLog.delete({ where: { id: logId } });

    return res.json({ success: true, message: 'Log entry deleted successfully' });
  } catch (error) {
    console.error('Delete log error:', error);
    return res.status(500).json({ error: 'Failed to delete log entry' });
  }
};

export const clearMealSlot = async (req, res) => {
  try {
    const { date, mealSlot } = req.query;

    if (!date || !mealSlot) {
      return res.status(400).json({ error: 'Date and mealSlot query parameters are required' });
    }

    await prisma.foodLog.deleteMany({
      where: {
        userId: req.userId,
        date,
        mealSlot
      }
    });

    return res.json({ success: true, message: `Cleared logs for ${mealSlot} on ${date}` });
  } catch (error) {
    console.error('Clear meal slot error:', error);
    return res.status(500).json({ error: 'Failed to clear meal slot' });
  }
};
