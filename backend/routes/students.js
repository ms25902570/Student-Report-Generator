import { Router } from 'express';
import { addStudent, getStudents } from '../services/students.js';
import { readStudent } from '../validate.js';

const router = Router();

// GET /api/students — all students, alphabetical.
router.get('/', async (req, res) => {
  res.json({ students: await getStudents() });
});

// POST /api/students — adds a student ({ name, studentCode }).
router.post('/', async (req, res) => {
  const { student, error } = readStudent(req.body);
  if (error) return res.status(400).json({ error });

  const result = await addStudent(student);
  if (result.conflict) {
    return res.status(409).json({ error: `A student with the ID "${student.studentCode}" already exists.` });
  }
  res.status(201).json({ student: result.student });
});

export default router;
