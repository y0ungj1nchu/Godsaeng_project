/**
 * 갓생 제조기 - 할 일(Todo) 관리 API 라우터 (CRUD 전체)
 */
const express = require('express');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ----------------------------------------------------------------
// [POST] /api/todos : 새로운 할 일을 생성 (memo 추가)
// ----------------------------------------------------------------
router.post('/', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    // --- 🔥 1. memo 필드 가져오기 ---
    const { title, dueDate, memo } = req.body;

    try {
        if (!title || title.trim().length === 0) {
            return res.status(400).json({ message: '할 일 내용을 입력해주세요.' });
        }
        
        const finalDueDate = dueDate || null;
        const finalMemo = memo || null; // memo가 없으면 NULL

        // --- 🔥 2. memo 컬럼에 INSERT ---
        const sql = 'INSERT INTO Todos (userId, title, memo, dueDate, isCompleted) VALUES (?, ?, ?, ?, ?)';
        const [result] = await pool.execute(sql, [userId, title, finalMemo, finalDueDate, false]); 

        res.status(201).json({ 
            id: result.insertId,
            title,
            memo: finalMemo, // --- 🔥 3. memo 응답에 포함 ---
            dueDate: finalDueDate,
            isCompleted: false,
            message: '할 일이 성공적으로 생성되었습니다.' 
        });

    } catch (error) {
        console.error('할 일 생성 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// ----------------------------------------------------------------
// [GET] /api/todos : 할 일 조회 (memo 추가)
// ----------------------------------------------------------------
router.get('/', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { date, includeCompleted } = req.query; 

    try {
        // --- 🔥 4. SELECT에 memo 추가 ---
        let sql = 'SELECT id, title, memo, isCompleted, dueDate, createdAt, updatedAt FROM Todos WHERE userId = ?';
        let params = [userId];

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
        console.error('할 일 조회 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// ----------------------------------------------------------------
// [PUT] /api/todos/:id : 할 일 내용 수정 (memo 추가)
// ----------------------------------------------------------------
router.put('/:id', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const todoId = req.params.id;
    // --- 🔥 5. memo 필드 가져오기 ---
    const { title, dueDate, memo } = req.body;
    
    if (!title && !dueDate && memo === undefined) { // memo가 undefined인 경우(수정 안 함)는 제외
        return res.status(400).json({ message: '수정할 내용을 입력해주세요.' });
    }

    try {
        let updateFields = [];
        let params = [];

        if (title) {
            if (title.trim().length === 0) {
                 return res.status(400).json({ message: '할 일 내용은 비워둘 수 없습니다.' });
            }
            updateFields.push('title = ?');
            params.push(title);
        }
        
        if (dueDate !== undefined) {
             updateFields.push('dueDate = ?');
             params.push(dueDate || null);
        }

        // --- 🔥 6. memo 수정 로직 추가 ---
        // (memo는 빈 문자열 ""로 저장하는 것도 허용)
        if (memo !== undefined) {
            updateFields.push('memo = ?');
            params.push(memo || null); // 빈 문자열이 오면 null로 저장
        }
        // -----------------------------

        // 업데이트할 필드가 하나도 없으면 400 반환 (예: body: {})
        if (updateFields.length === 0) {
             return res.status(400).json({ message: '수정할 내용이 없습니다.' });
        }

        const sql = `UPDATE Todos SET ${updateFields.join(', ')} WHERE id = ? AND userId = ?`;
        params.push(todoId, userId);

        const [result] = await pool.execute(sql, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '할 일을 찾을 수 없거나 수정 권한이 없습니다.' });
        }

        res.status(200).json({ message: '할 일이 성공적으로 수정되었습니다.' });

    } catch (error) {
        console.error('할 일 수정 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// ----------------------------------------------------------------
// [PUT] /api/todos/:id/toggle : (수정 불필요)
// ----------------------------------------------------------------
router.put('/:id/toggle', authMiddleware, async (req, res) => {
    // (이하 코드 동일)
    const userId = req.user.id;
    const todoId = req.params.id;
    const { isCompleted } = req.body; 

    if (typeof isCompleted !== 'boolean') {
        return res.status(400).json({ message: 'isCompleted 값은 true 또는 false여야 합니다.' });
    }
    
    try {
        const sql = 'UPDATE Todos SET isCompleted = ? WHERE id = ? AND userId = ?';
        const [result] = await pool.execute(sql, [isCompleted, todoId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '할 일을 찾을 수 없거나 권한이 없습니다.' });
        }
        
        // (경험치 로직...)

        res.status(200).json({ 
            message: `할 일이 ${isCompleted ? '완료' : '미완료'} 처리되었습니다.`,
            isCompleted: isCompleted 
        });

    } catch (error) {
        console.error('할 일 토글 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// ----------------------------------------------------------------
// [DELETE] /api/todos/:id : (수정 불필요)
// ----------------------------------------------------------------
router.delete('/:id', authMiddleware, async (req, res) => {
    // (이하 코드 동일)
    const userId = req.user.id;
    const todoId = req.params.id;

    try {
        const sql = 'DELETE FROM Todos WHERE id = ? AND userId = ?';
        const [result] = await pool.execute(sql, [todoId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '할 일을 찾을 수 없거나 삭제 권한이 없습니다.' });
        }

        res.status(200).json({ message: '할 일이 성공적으로 삭제되었습니다.' });

    } catch (error) {
        console.error('할 일 삭제 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;