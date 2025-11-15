/**
 * 갓생 제조기 - 학습 일기(Diary) 관리 API 라우터 (CRUD 및 캘린더 조회)
 * - 특정 날짜의 일기 조회/작성/수정/삭제 담당
 */
const express = require('express');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ----------------------------------------------------------------
// [GET] /api/diaries/date/:date : 특정 날짜의 일기 조회 (캘린더 뷰 핵심)
// ----------------------------------------------------------------
router.get('/date/:date', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const diaryDate = req.params.date; 

    try {
        // 1. 해당 날짜에 작성된 일기 조회
        const diarySql = 'SELECT id, title, content FROM Diaries WHERE userId = ? AND diaryDate = ?';
        const [diaries] = await pool.execute(diarySql, [userId, diaryDate]);

        const todoSql = `
            SELECT id, title, memo, isCompleted 
            FROM Todos 
            WHERE userId = ? AND dueDate = ? 
            ORDER BY isCompleted ASC, createdAt DESC 
            LIMIT 5
        `;
        // --- (memo가 SELECT 목록에 포함되었습니다) ---
        
        const [todos] = await pool.execute(todoSql, [userId, diaryDate]);

        res.status(200).json({
            diary: diaries[0] || null, 
            todos: todos
        });

    } catch (error) {
        console.error('특정 날짜 데이터 조회 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// ----------------------------------------------------------------
// [POST] /api/diaries : 새로운 일기 작성
// ----------------------------------------------------------------
router.post('/', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { title, content, diaryDate } = req.body;

    // diaryDate는 필수이며, YYYY-MM-DD 형식이라고 가정
    if (!diaryDate || !title) {
        return res.status(400).json({ message: '날짜와 제목을 입력해주세요.' });
    }

    try {
        // 이미 해당 날짜에 일기가 있는지 확인 (Users 테이블 설계에 UNIQUE 제약이 있다면 필요 없음)
        const [existing] = await pool.execute(
            'SELECT id FROM Diaries WHERE userId = ? AND diaryDate = ?',
            [userId, diaryDate]
        );

        if (existing.length > 0) {
            return res.status(409).json({ message: '해당 날짜에 이미 일기가 존재합니다. 수정을 사용해주세요.' });
        }

        const sql = 'INSERT INTO Diaries (userId, title, content, diaryDate) VALUES (?, ?, ?, ?)';
        const [result] = await pool.execute(sql, [userId, title, content || '', diaryDate]);

        res.status(201).json({ 
            id: result.insertId,
            message: '일기가 성공적으로 작성되었습니다.' 
        });

    } catch (error) {
        console.error('일기 작성 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// ----------------------------------------------------------------
// [PUT] /api/diaries/:id : 일기 수정
// ----------------------------------------------------------------
router.put('/:id', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const diaryId = req.params.id;
    const { title, content } = req.body;
    
    // 최소한 하나 이상의 수정할 필드가 있는지 확인
    if (!title && !content) {
        return res.status(400).json({ message: '수정할 내용을 입력해주세요.' });
    }

    try {
        const sql = 'UPDATE Diaries SET title = ?, content = ? WHERE id = ? AND userId = ?';
        const [result] = await pool.execute(sql, [title, content, diaryId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '일기를 찾을 수 없거나 수정 권한이 없습니다.' });
        }

        res.status(200).json({ message: '일기가 성공적으로 수정되었습니다.' });

    } catch (error) {
        console.error('일기 수정 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// ----------------------------------------------------------------
// [DELETE] /api/diaries/:id : 일기 삭제
// ----------------------------------------------------------------
router.delete('/:id', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const diaryId = req.params.id;

    try {
        const sql = 'DELETE FROM Diaries WHERE id = ? AND userId = ?';
        const [result] = await pool.execute(sql, [diaryId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '일기를 찾을 수 없거나 삭제 권한이 없습니다.' });
        }

        res.status(200).json({ message: '일기가 성공적으로 삭제되었습니다.' });

    } catch (error) {
        console.error('일기 삭제 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;