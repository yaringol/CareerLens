import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';

const router = Router();

function signToken(id: string, email: string, role: string): string {
  const secret = process.env.JWT_SECRET!;
  const expiry = process.env.JWT_EXPIRY || '7d';
  return jwt.sign({ id, email, role }, secret, { expiresIn: expiry } as jwt.SignOptions);
}

router.post('/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    const passwordHash = await bcrypt.hash(password, rounds);
    const user = await User.create({ email, passwordHash, role: 'user' });

    const token = signToken(user._id.toString(), user.email, user.role);
    res.status(201).json({ token, role: user.role, email: user.email });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signToken(user._id.toString(), user.email, user.role);
    res.json({ token, role: user.role, email: user.email });
  } catch (err) {
    next(err);
  }
});

router.put('/password', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const token = authHeader.slice(7);
    let payload: { id: string };
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    } catch {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'currentPassword and newPassword are required' });
      return;
    }
    if (newPassword.length < 4) {
      res.status(400).json({ error: 'New password must be at least 4 characters' });
      return;
    }

    const user = await User.findById(payload.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    user.passwordHash = await bcrypt.hash(newPassword, rounds);
    await user.save();

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
