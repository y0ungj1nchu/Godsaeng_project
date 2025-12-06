/**
 * 갓생 제조기 - 할 일(Todo) 관리 API 라우터
 * CalendarPage와 호환되도록 date → dueDate 매핑 포함
 */
const express = require('express');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/* ============================================================
   [POST] /api/todos
   새로운 할 일 생성
   - CalendarPage: date 전달
   - 기존 코드: dueDate 사용
   → date 또는 dueDate 모두 지원
============================================================ */
router.post('/', authMiddleware, async (req, res) => {
    const userId = req.user.id;

    // ⭐ CalendarPage는 date로 보냄 → dueDate로 자동 변환
    const dueDate = req.body.dueDate || req.body.date || null;
    const { title, memo } = req.body;

    try {
        if (!title || title.trim().length === 0) {
            return res.status(400).json({ message: '할 일 내용을 입력해주세요.' });
        }

        const sql = `
            INSERT INTO Todos (userId, title, memo, dueDate, isCompleted)
            VALUES (?, ?, ?, ?, ?)
        `;
        const [result] = await pool.execute(sql, [
            userId,
            title,
            memo || null,
            dueDate,
            false
        ]);

        res.status(201).json({
            id: result.insertId,
            title,
            memo: memo || null,
            dueDate,
            isCompleted: false,
            message: '할 일이 성공적으로 생성되었습니다.'
        });

    } catch (error) {
        console.error('🔥 할 일 생성 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


/* ============================================================
   [GET] /api/todos
   할 일 조회 (날짜 필터 지원)
   - ?date=YYYY-MM-DD 로 조회 가능
============================================================ */
router.get('/', authMiddleware, async (req, res) => {
    const userId = req.user.id;

    // ⭐ date 또는 dueDate 둘 다 지원
    const date = req.query.date || req.query.dueDate || null;
    const includeCompleted = req.query.includeCompleted;

    try {
        let sql = `
            SELECT id, title, memo, isCompleted, dueDate, createdAt, updatedAt
            FROM Todos
            WHERE userId = ?
        `;
        const params = [userId];

        if (date) {
            sql += ' AND DATE(dueDate) = ?';
            params.push(date);
        }

        if (includeCompleted !== 'true') {
            sql += ' AND isCompleted = FALSE';
        }

        sql += ' ORDER BY dueDate ASC, createdAt DESC';

        const [todos] = await pool.execute(sql, params);

        res.status(200).json(todos);

    } catch (error) {
        console.error('🔥 할 일 조회 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


/* ============================================================
   [PUT] /api/todos/:id
   할 일 수정 (date 또는 dueDate 허용)
============================================================ */
router.put('/:id', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const todoId = req.params.id;

    const { title, memo } = req.body;

    // ⭐ date → dueDate로 자동 변환
    const dueDate = (req.body.dueDate || req.body.date) ?? undefined;

    try {
        const fields = [];
        const params = [];

        if (title !== undefined) {
            if (title.trim().length === 0) {
                return res.status(400).json({ message: '내용은 비워둘 수 없습니다.' });
            }
            fields.push("title = ?");
            params.push(title);
        }

        if (dueDate !== undefined) {
            fields.push("dueDate = ?");
            params.push(dueDate || null);
        }

        if (memo !== undefined) {
            fields.push("memo = ?");
            params.push(memo || null);
        }

        if (fields.length === 0) {
            return res.status(400).json({ message: '수정할 내용이 없습니다.' });
        }

        const sql = `
            UPDATE Todos 
            SET ${fields.join(', ')}
            WHERE id = ? AND userId = ?
        `;
        params.push(todoId, userId);

        const [result] = await pool.execute(sql, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '할 일을 찾을 수 없거나 권한이 없습니다.' });
        }

        res.status(200).json({ message: '할 일이 수정되었습니다.' });

    } catch (error) {
        console.error('🔥 할 일 수정 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


/* ============================================================
   [PUT] /api/todos/:id/toggle
   완료 여부 변경
============================================================ */
router.put('/:id/toggle', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const todoId = req.params.id;
    const { isCompleted } = req.body;

    if (typeof isCompleted !== 'boolean') {
        return res.status(400).json({ message: 'isCompleted 값은 true 또는 false여야 합니다.' });
    }

    try {
        const sql = `UPDATE Todos SET isCompleted = ? WHERE id = ? AND userId = ?`;
        const [result] = await pool.execute(sql, [isCompleted, todoId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '할 일을 찾을 수 없거나 권한이 없습니다.' });
        }

        res.status(200).json({
            message: `할 일이 ${isCompleted ? '완료됨' : '미완료됨'}`,
            isCompleted
        });

    } catch (error) {
        console.error('🔥 할 일 토글 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


/* ============================================================
   [DELETE] /api/todos/:id
   할 일 삭제
============================================================ */
router.delete('/:id', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const todoId = req.params.id;

    try {
        const sql = `DELETE FROM Todos WHERE id = ? AND userId = ?`;
        const [result] = await pool.execute(sql, [todoId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '할 일을 찾을 수 없거나 권한이 없습니다.' });
        }

        res.status(200).json({ message: '할 일이 삭제되었습니다.' });

    } catch (error) {
        console.error('🔥 할 일 삭제 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;
